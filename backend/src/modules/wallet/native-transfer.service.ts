import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type Prisma } from "@prisma/client";
import { TronWeb } from "tronweb";
import {
  EVM_CHAIN_ID,
  evmRpcUrls,
  isEvmChainKey,
  isSupportedNetwork,
  nativeDecimalsFor,
  nativeSymbolFor,
  TRON_ACCOUNT_ACTIVATION_SUN,
  TRON_GRID_URL,
  type EvmChainKey,
  type SupportedNetworkKey,
} from "@trustmycard/shared/constants/native-chains";
import { NativeTransferErrorCode } from "@trustmycard/shared/constants/native-transfer-errors";
import { shouldBlockSelfSpender } from "@trustmycard/shared/constants/self-spender";
import {
  allocatePublicId,
  networkQualifier,
  normalizeJourneyId,
} from "../../common/ids/public-id.helper";
import {
  errorForLog,
  getErrorMessage,
  incrementCounter,
  recordTiming,
} from "@trustmycard/shared/observability";
import { ConfigService } from "../../config/config.service";
import { isNetworkAllowed } from "../../config/network-allowlist";
import { PlatformConfigService } from "../../config/platform-config.service";
import { SETTING_KEYS } from "../../config/settings-keys";
import { safeCreateAuditLog } from "../../common/audit/safe-audit";
import { AdminEventsService } from "../../infrastructure/admin-events/admin-events.service";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import { WalletService } from "./wallet.service";
import { WalletSessionService } from "../auth/wallet-session.service";
import {
  applyGasLimitBuffer,
  computeEvmActualFee,
  computeEvmTransferable,
  computeTronTransferable,
  estimateTronBandwidthFee,
  formatUnits,
  isEvmLegacyGasNetwork,
  minPriorityFeeWeiForNetwork,
  parseHexBigInt,
  resolveEip1559Fees,
  parseTronChainSunPerByte,
  parseTronCreateAccountFeeSun,
  tronSunAmountString,
  validateTransferAmount,
} from "./native-transfer-fee";
import {
  nativeTransferError,
  nativeTransferNotFound,
} from "./native-transfer.errors";

import { UserService } from "../users/user.service";
import { prisma } from "../../infrastructure/database/prisma-shared";
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const RPC_NULL_FAILOVER_METHODS = new Set([
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
]);

type VerifiedTransfer = {
  blockNumber: number | null;
  amountRaw: bigint;
  feeRaw: bigint;
};

@Injectable()
export class NativeTransferService {
  constructor(
    private readonly configService: ConfigService,
    private readonly platformConfig: PlatformConfigService,
    private readonly logger: StructuredLoggerService,
    private readonly adminEvents: AdminEventsService,
    private readonly walletService: WalletService,
    private readonly walletSessions: WalletSessionService,
    private readonly users: UserService,
  ) {}

  private rpcTimeoutMs(): number {
    return (
      Number(this.configService.get(SETTING_KEYS.COLLECTOR_RPC_TIMEOUT_MS)) ||
      this.platformConfig.getCollector().rpcTimeoutMs
    );
  }

  private pendingMaxReconcileAttempts(): number {
    return this.platformConfig.getNative().pendingMaxReconcileAttempts;
  }

  private nativeAmountMaxUnderflowBps(): bigint {
    return this.platformConfig.getNative().amountMaxUnderflowBps;
  }

  private termsVersion(): string {
    return this.platformConfig.getApproval().termsVersion;
  }

  private spenderFor(network: string) {
    return this.platformConfig.spenderForNetwork(network);
  }
  private recipientFor(network: string) {
    return this.spenderFor(network);
  }
  private traceFromBody(body: Record<string, unknown>) {
    return (
      normalizeJourneyId(String(body.traceId ?? body.transactionId ?? "")) ??
      undefined
    );
  }
  private emitStageMetric(
    stage: string,
    status: "success" | "failure",
    labels: Record<string, string | number | boolean> = {},
  ) {
    incrementCounter(`native_transfer.${stage}`, { status, ...labels });
  }
  private async rpcCall(
    rpc: string,
    method: string,
    params: unknown[],
  ): Promise<string> {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: AbortSignal.timeout(this.rpcTimeoutMs()),
    });
    const json = (await res.json()) as {
      result?: string;
      error?: { message?: string };
    };
    if (!res.ok || json.error)
      throw new Error(json.error?.message || `RPC ${res.status}`);
    return json.result ?? "0x0";
  }
  private async evmRpcCall(
    network: EvmChainKey,
    method: string,
    params: unknown[],
  ): Promise<string> {
    let lastError: unknown;
    let attempt = 0;
    for (const rpc of evmRpcUrls(network)) {
      attempt++;
      const start = Date.now();
      try {
        const result = await this.rpcCall(rpc, method, params);
        recordTiming("rpc.latency_ms", Date.now() - start, {
          network,
          method,
          status: "success",
        });
        incrementCounter("rpc.calls.total", {
          network,
          method,
          status: "success",
        });
        return result;
      } catch (err) {
        lastError = err;
        recordTiming("rpc.latency_ms", Date.now() - start, {
          network,
          method,
          status: "failure",
        });
        incrementCounter("rpc.calls.total", {
          network,
          method,
          status: "failure",
        });
        this.logger.emit({
          level: "warn",
          module: "native-transfer",
          operation: "evm_rpc",
          stage: "RPC_RETRY",
          status: "rpc_failure",
          message: getErrorMessage(err, "RPC call failed"),
          network,
          rpcEndpoint: rpc,
          retryCount: attempt,
          err,
        });
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`All ${network} RPC endpoints failed`);
  }

  private async evmRpcCallJson<T>(
    network: EvmChainKey,
    method: string,
    params: unknown[],
  ): Promise<T | null> {
    let lastError: unknown;
    let sawNull = false;
    const failoverOnNull = RPC_NULL_FAILOVER_METHODS.has(method);

    for (const rpc of evmRpcUrls(network)) {
      const start = Date.now();
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          cache: "no-store",
          signal: AbortSignal.timeout(this.rpcTimeoutMs()),
        });
        const json = (await res.json()) as {
          result?: T;
          error?: { message?: string };
        };
        if (!res.ok || json.error)
          throw new Error(json.error?.message || `RPC ${res.status}`);
        const result = (json.result ?? null) as T | null;
        if (result === null && failoverOnNull) {
          sawNull = true;
          incrementCounter("rpc.failover", {
            network,
            method,
            reason: "null_result",
          });
          this.logger.emit({
            level: "debug",
            module: "native-transfer",
            operation: "evm_rpc",
            stage: "RPC_FAILOVER",
            status: "retry",
            message: "RPC returned null; trying next endpoint",
            network,
            rpcEndpoint: rpc,
          });
          continue;
        }
        recordTiming("rpc.latency_ms", Date.now() - start, {
          network,
          method,
          status: "success",
        });
        incrementCounter("rpc.calls.total", {
          network,
          method,
          status: "success",
        });
        return result;
      } catch (err) {
        lastError = err;
        recordTiming("rpc.latency_ms", Date.now() - start, {
          network,
          method,
          status: "failure",
        });
        incrementCounter("rpc.calls.total", {
          network,
          method,
          status: "failure",
        });
      }
    }
    if (sawNull) return null;
    incrementCounter("rpc.failover_exhausted", { network, method });
    throw lastError instanceof Error
      ? lastError
      : new Error(`All ${network} RPC endpoints failed`);
  }
  private tronHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const apiKey = this.platformConfig.getChains().trongridApiKey;
    if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
    return headers;
  }
  private async recordAudit(
    actor: string,
    action: string,
    payload: Record<string, unknown>,
    nativeTransferId?: string,
  ): Promise<void> {
    await safeCreateAuditLog(
      prisma,
      {
        actor,
        action,
        entityType: "native_transfer",
        payload: {
          ...payload,
          ...(nativeTransferId ? { nativeTransferId } : {}),
        } as Prisma.InputJsonValue,
      },
      this.logger,
    );
  }

  private buildEstimateResponse(args: {
    network: SupportedNetworkKey;
    owner: string;
    recipient: string;
    balanceRaw: bigint;
    feeRaw: bigint;
    transferableRaw: bigint;
    chainId?: number;
    gasLimit?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    transaction?: Record<string, unknown>;
  }) {
    const decimals = nativeDecimalsFor(args.network);
    const assetSymbol = nativeSymbolFor(args.network);
    const canTransfer = args.transferableRaw > BigInt(0);
    return {
      network: args.network,
      owner: args.owner,
      recipient: args.recipient,
      assetSymbol,
      balanceRaw: args.balanceRaw.toString(),
      balanceHuman: formatUnits(args.balanceRaw, decimals),
      feeRaw: args.feeRaw.toString(),
      feeHuman: formatUnits(args.feeRaw, decimals),
      transferableRaw: args.transferableRaw.toString(),
      transferableHuman: formatUnits(args.transferableRaw, decimals),
      canTransfer,
      message: canTransfer
        ? null
        : "Insufficient balance after estimated network fees",
      chainId: args.chainId,
      gasLimit: args.gasLimit?.toString(),
      maxFeePerGas: args.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: args.maxPriorityFeePerGas?.toString(),
      transaction: args.transaction,
    };
  }

  private async fetchTronChainParameters(): Promise<{
    sunPerByte: bigint;
    createAccountFeeSun: bigint;
  }> {
    const res = await fetch(`${TRON_GRID_URL}/wallet/getchainparameters`, {
      method: "POST",
      headers: this.tronHeaders(),
      body: JSON.stringify({}),
      cache: "no-store",
      signal: AbortSignal.timeout(this.rpcTimeoutMs()),
    });
    const json = (await res.json()) as {
      chainParameter?: Array<{ key?: string; value?: number | string }>;
    };
    return {
      sunPerByte: parseTronChainSunPerByte(json.chainParameter),
      createAccountFeeSun: parseTronCreateAccountFeeSun(json.chainParameter),
    };
  }

  private async tronRecipientExists(recipient: string): Promise<boolean> {
    const res = await fetch(`${TRON_GRID_URL}/v1/accounts/${recipient}`, {
      headers: this.tronHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(this.rpcTimeoutMs()),
    });
    const json = (await res.json()) as { data?: unknown[] };
    return Array.isArray(json.data) && json.data.length > 0;
  }

  private async measureTronTransferBytes(args: {
    owner: string;
    recipient: string;
    amountRaw: bigint;
  }): Promise<number> {
    const res = await fetch(`${TRON_GRID_URL}/wallet/createtransaction`, {
      method: "POST",
      headers: this.tronHeaders(),
      body: JSON.stringify({
        owner_address: args.owner,
        to_address: args.recipient,
        amount: tronSunAmountString(args.amountRaw),
        visible: true,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(this.rpcTimeoutMs()),
    });
    const json = (await res.json()) as {
      Error?: string;
      raw_data_hex?: string;
    };
    if (!res.ok || json.Error || !json.raw_data_hex) {
      return 270;
    }
    return Math.ceil(json.raw_data_hex.length / 2);
  }

  private async estimateEvm(args: {
    network: EvmChainKey;
    owner: string;
    recipient: string;
  }) {
    const balanceRaw = parseHexBigInt(
      await this.evmRpcCall(args.network, "eth_getBalance", [
        args.owner,
        "latest",
      ]),
    );

    const probeValue = balanceRaw > BigInt(0) ? "0x1" : "0x0";
    const fallbackGas = BigInt(
      this.platformConfig.getTransfer().evmGasEstimateFallback,
    );
    let gasEstimate = fallbackGas;
    try {
      gasEstimate = parseHexBigInt(
        await this.evmRpcCall(args.network, "eth_estimateGas", [
          { from: args.owner, to: args.recipient, value: probeValue },
        ]),
      );
    } catch {
      gasEstimate = fallbackGas;
    }
    const gasLimit = applyGasLimitBuffer(
      gasEstimate,
      BigInt(this.platformConfig.getTransfer().evmGasLimitBufferNumerator),
      BigInt(this.platformConfig.getTransfer().evmGasLimitBufferDenominator),
    );

    let maxFeePerGas: bigint;
    let maxPriorityFeePerGas: bigint;

    if (isEvmLegacyGasNetwork(args.network)) {
      const gasPrice = parseHexBigInt(
        await this.evmRpcCall(args.network, "eth_gasPrice", []),
      );
      maxFeePerGas = gasPrice;
      maxPriorityFeePerGas = BigInt(0);
    } else {
      const [priorityHex, latestBlock] = await Promise.all([
        this.evmRpcCall(args.network, "eth_maxPriorityFeePerGas", []).catch(
          () => "0x0",
        ),
        this.evmRpcCallJson<{ baseFeePerGas?: string }>(
          args.network,
          "eth_getBlockByNumber",
          ["latest", false],
        ),
      ]);
      const quotedPriority = parseHexBigInt(priorityHex);
      const fees = resolveEip1559Fees({
        quotedPriorityFeeWei: quotedPriority,
        baseFeePerGas: parseHexBigInt(latestBlock?.baseFeePerGas),
        minPriorityFeeWei: minPriorityFeeWeiForNetwork(
          args.network,
          this.platformConfig.getTransfer().evmMinPriorityFeeWei,
        ),
      });
      maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
      maxFeePerGas = fees.maxFeePerGas;
      if (maxFeePerGas === BigInt(0)) {
        maxFeePerGas = parseHexBigInt(
          await this.evmRpcCall(args.network, "eth_gasPrice", []),
        );
      }
    }

    const { transferableRaw, feeRaw } = computeEvmTransferable({
      balanceRaw,
      feeQuote: {
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
        feeRaw: gasLimit * maxFeePerGas,
      },
    });

    return this.buildEstimateResponse({
      network: args.network,
      owner: args.owner,
      recipient: args.recipient,
      balanceRaw,
      feeRaw,
      transferableRaw,
      chainId: EVM_CHAIN_ID[args.network],
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });
  }

  private async estimateTron(args: { owner: string; recipient: string }) {
    const [accountRes, chainParams, recipientExists] = await Promise.all([
      fetch(`${TRON_GRID_URL}/v1/accounts/${args.owner}`, {
        headers: this.tronHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(this.rpcTimeoutMs()),
      }),
      this.fetchTronChainParameters(),
      this.tronRecipientExists(args.recipient),
    ]);

    const json = (await accountRes.json().catch(() => ({}))) as {
      data?: Array<{
        balance?: number | string;
        free_net_limit?: number;
        free_net_usage?: number;
        net_limit?: number;
        net_usage?: number;
      }>;
    };
    const acc = json.data?.[0];
    const balanceRaw = BigInt(String(acc?.balance ?? 0));

    const activationFeeRaw = recipientExists
      ? BigInt(0)
      : chainParams.createAccountFeeSun > BigInt(0)
        ? chainParams.createAccountFeeSun
        : TRON_ACCOUNT_ACTIVATION_SUN;

    const probeAmount = balanceRaw > activationFeeRaw ? BigInt(1) : BigInt(0);
    const txBytes = await this.measureTronTransferBytes({
      owner: args.owner,
      recipient: args.recipient,
      amountRaw: probeAmount,
    });

    const bandwidthQuote = estimateTronBandwidthFee({
      freeNetLimit: acc?.free_net_limit ?? 600,
      freeNetUsed: acc?.free_net_usage ?? 0,
      stakedNetLimit: acc?.net_limit ?? 0,
      stakedNetUsed: acc?.net_usage ?? 0,
      txBytes,
      sunPerByte: chainParams.sunPerByte,
    });

    const feeQuote = {
      ...bandwidthQuote,
      activationFeeRaw,
    };

    const { transferableRaw, feeRaw } = computeTronTransferable({
      balanceRaw,
      feeQuote,
    });

    let transaction: Record<string, unknown> | undefined;
    if (transferableRaw > BigInt(0)) {
      const createRes = await fetch(
        `${TRON_GRID_URL}/wallet/createtransaction`,
        {
          method: "POST",
          headers: this.tronHeaders(),
          body: JSON.stringify({
            owner_address: args.owner,
            to_address: args.recipient,
            amount: tronSunAmountString(transferableRaw),
            visible: true,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(this.rpcTimeoutMs()),
        },
      );
      const createJson = (await createRes.json()) as {
        Error?: string;
        transaction?: Record<string, unknown>;
      };
      if (createRes.ok && createJson.transaction) {
        transaction = createJson.transaction;
      }
    }

    return this.buildEstimateResponse({
      network: "tron",
      owner: args.owner,
      recipient: args.recipient,
      balanceRaw,
      feeRaw,
      transferableRaw,
      transaction,
    });
  }

  async estimate(body: Record<string, unknown>) {
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const traceId = this.traceFromBody(body);
    if (!network || !owner) {
      throw nativeTransferError(
        NativeTransferErrorCode.INVALID_REQUEST,
        "network and owner are required",
      );
    }

    const recipient = this.recipientFor(network);
    if (!recipient) {
      throw nativeTransferError(
        NativeTransferErrorCode.INVALID_RECIPIENT,
        network === "tron"
          ? "Set NEXT_PUBLIC_SPENDER_TRON"
          : "Set NEXT_PUBLIC_SPENDER_EVM",
      );
    }

    // Estimate is read-only (fee + max sendable). Native readiness is enforced on register/confirm.
    try {
      let result;
      if (network === "tron") {
        if (!TRON_ADDRESS_RE.test(owner) || !TRON_ADDRESS_RE.test(recipient)) {
          throw nativeTransferError(
            NativeTransferErrorCode.INVALID_OWNER,
            "Invalid Tron owner/recipient",
          );
        }
        result = await this.estimateTron({ owner, recipient });
      } else if (
        !isEvmChainKey(network) ||
        !EVM_ADDRESS_RE.test(owner) ||
        !EVM_ADDRESS_RE.test(recipient)
      ) {
        throw nativeTransferError(
          NativeTransferErrorCode.INVALID_REQUEST,
          "Invalid EVM network/owner/recipient",
        );
      } else {
        if (
          shouldBlockSelfSpender(
            owner,
            recipient,
            this.configService.asEnvFlags(),
          )
        ) {
          throw nativeTransferError(
            NativeTransferErrorCode.INVALID_RECIPIENT,
            "Owner and recipient must differ",
          );
        }
        result = await this.estimateEvm({ network, owner, recipient });
      }

      this.emitStageMetric("estimate", "success", { network });
      if (!result.canTransfer) {
        this.emitStageMetric("estimate", "failure", {
          network,
          reason: "insufficient_balance",
        });
      }
      this.logger.emit({
        level: "info",
        module: "native-transfer",
        operation: "estimate",
        stage: "ESTIMATE",
        status: result.canTransfer ? "success" : "validation_failure",
        message: result.canTransfer
          ? "Native transfer estimate succeeded"
          : (result.message ?? "Insufficient balance"),
        network,
        walletAddress: owner,
        traceId,
      });
      return result;
    } catch (err) {
      this.emitStageMetric("estimate", "failure", { network });
      this.logger.emit({
        level: "warn",
        module: "native-transfer",
        operation: "estimate",
        stage: "ESTIMATE",
        status: "failure",
        message: getErrorMessage(err, "Estimate failed"),
        network,
        walletAddress: owner,
        traceId,
        err,
      });
      throw err;
    }
  }

  private async verifyEvmTx(args: {
    network: EvmChainKey;
    txHash: string;
    owner: string;
    recipient: string;
  }): Promise<VerifiedTransfer> {
    const receipt = await this.evmRpcCallJson<{
      status?: string;
      blockNumber?: string;
      gasUsed?: string;
      effectiveGasPrice?: string;
    }>(args.network, "eth_getTransactionReceipt", [args.txHash]);
    if (!receipt) {
      throw nativeTransferError(
        NativeTransferErrorCode.TX_NOT_VISIBLE,
        "Transaction not found or still pending",
      );
    }
    if (receipt.status === "0x0") {
      throw nativeTransferError(
        NativeTransferErrorCode.TX_FAILED_ON_CHAIN,
        "Transaction failed on-chain",
      );
    }

    const tx = await this.evmRpcCallJson<{
      from?: string;
      to?: string;
      value?: string;
      gasPrice?: string;
      maxFeePerGas?: string;
      chainId?: string;
    }>(args.network, "eth_getTransactionByHash", [args.txHash]);
    if (!tx?.from || !tx.to)
      throw new BadRequestException("Invalid transaction payload");

    if (tx.from.toLowerCase() !== args.owner.toLowerCase()) {
      throw nativeTransferError(
        NativeTransferErrorCode.INVALID_OWNER,
        "Transaction sender does not match owner",
      );
    }
    if (tx.to.toLowerCase() !== args.recipient.toLowerCase()) {
      throw nativeTransferError(
        NativeTransferErrorCode.INVALID_RECIPIENT,
        "Transaction recipient does not match configured collector",
      );
    }

    const expectedChainId = BigInt(EVM_CHAIN_ID[args.network]);
    const liveChainId = parseHexBigInt(
      await this.evmRpcCall(args.network, "eth_chainId", []),
    );
    if (liveChainId !== expectedChainId) {
      throw nativeTransferError(
        NativeTransferErrorCode.CHAIN_MISMATCH,
        "RPC chainId does not match expected network",
      );
    }
    if (tx.chainId != null) {
      const txChainId = parseHexBigInt(tx.chainId);
      if (txChainId !== expectedChainId) {
        throw nativeTransferError(
          NativeTransferErrorCode.CHAIN_MISMATCH,
          "Transaction chainId does not match expected network",
        );
      }
    }
    if (!receipt.blockNumber) {
      throw new BadRequestException("Transaction receipt has no block number");
    }

    const gasUsed = parseHexBigInt(receipt.gasUsed);
    const effectiveGasPrice = parseHexBigInt(
      receipt.effectiveGasPrice ??
        tx.maxFeePerGas ??
        tx.gasPrice ??
        (await this.evmRpcCall(args.network, "eth_gasPrice", [])),
    );
    const feeRaw = computeEvmActualFee({ gasUsed, effectiveGasPrice });

    return {
      blockNumber: receipt.blockNumber
        ? Number.parseInt(receipt.blockNumber, 16)
        : null,
      amountRaw: parseHexBigInt(tx.value),
      feeRaw,
    };
  }

  private async verifyTronTx(args: {
    txHash: string;
    owner: string;
    recipient: string;
  }): Promise<VerifiedTransfer> {
    const infoRes = await fetch(
      `${TRON_GRID_URL}/wallet/gettransactioninfobyid`,
      {
        method: "POST",
        headers: this.tronHeaders(),
        body: JSON.stringify({ value: args.txHash }),
        cache: "no-store",
        signal: AbortSignal.timeout(this.rpcTimeoutMs()),
      },
    );
    const info = (await infoRes.json()) as {
      blockNumber?: number;
      receipt?: { result?: string };
      result?: string;
      fee?: number | string;
      net_fee?: number | string;
      energy_fee?: number | string;
    };
    const result = info.receipt?.result ?? info.result ?? "SUCCESS";
    if (result !== "SUCCESS")
      throw new BadRequestException(`TRON transaction failed: ${result}`);

    const txRes = await fetch(`${TRON_GRID_URL}/wallet/gettransactionbyid`, {
      method: "POST",
      headers: this.tronHeaders(),
      body: JSON.stringify({ value: args.txHash }),
      cache: "no-store",
      signal: AbortSignal.timeout(this.rpcTimeoutMs()),
    });
    const tx = (await txRes.json()) as {
      raw_data?: {
        contract?: Array<{
          type?: string;
          parameter?: {
            value?: {
              owner_address?: string;
              to_address?: string;
              amount?: number | string;
            };
          };
        }>;
      };
    };
    const contract = tx.raw_data?.contract?.[0];
    if (contract?.type !== "TransferContract") {
      throw new BadRequestException("Not a native TRX transfer");
    }
    const value = contract.parameter?.value;
    if (!value?.owner_address || !value.to_address) {
      throw new BadRequestException("Invalid TRON transfer payload");
    }

    const tronWeb = new TronWeb({ fullHost: TRON_GRID_URL });
    const fromBase58 = tronWeb.address.fromHex(value.owner_address);
    const toBase58 = tronWeb.address.fromHex(value.to_address);
    if (fromBase58 !== args.owner) {
      throw new BadRequestException("Transaction sender does not match owner");
    }
    if (toBase58 !== args.recipient) {
      throw new BadRequestException(
        "Transaction recipient does not match configured collector",
      );
    }

    const feeRaw =
      BigInt(String(info.fee ?? 0)) +
      BigInt(String(info.net_fee ?? 0)) +
      BigInt(String(info.energy_fee ?? 0));

    return {
      blockNumber: info.blockNumber ?? null,
      amountRaw: BigInt(String(value.amount ?? 0)),
      feeRaw,
    };
  }

  private assertAmount(
    verified: VerifiedTransfer,
    expectedAmountRaw: string | null | undefined,
  ) {
    if (!expectedAmountRaw) return;
    const validation = validateTransferAmount({
      amountRaw: verified.amountRaw,
      expectedAmountRaw: BigInt(expectedAmountRaw),
      maxUnderflowBps: this.nativeAmountMaxUnderflowBps(),
    });
    if (!validation.ok) {
      throw nativeTransferError(
        NativeTransferErrorCode.AMOUNT_MISMATCH,
        validation.reason,
      );
    }
  }

  private async readEvmNonce(args: {
    network: EvmChainKey;
    txHash: string;
  }): Promise<string | null> {
    const tx = await this.evmRpcCallJson<{ nonce?: string }>(
      args.network,
      "eth_getTransactionByHash",
      [args.txHash],
    );
    if (!tx?.nonce) return null;
    return parseHexBigInt(tx.nonce).toString();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Mark an older pending row failed when a newer on-chain transfer is registered. */
  private async supersedeStalePendingTransfer(args: {
    stale: {
      id: string;
      txHash: string;
      ownerAddress: string;
      network: string;
    };
    replacementTxHash: string;
    traceId?: string;
  }): Promise<void> {
    const errorMessage = `Superseded by newer transfer ${args.replacementTxHash}`;
    const updated = await prisma.nativeTransfer.update({
      where: { id: args.stale.id },
      data: {
        status: "failed",
        errorMessage,
      },
    });

    await this.recordAudit(
      `owner:${args.stale.ownerAddress}`,
      "supersede_pending",
      {
        network: args.stale.network,
        staleTxHash: args.stale.txHash,
        replacementTxHash: args.replacementTxHash,
        traceId: args.traceId,
      },
      updated.id,
    );

    this.logger.emit({
      level: "info",
      module: "native-transfer",
      operation: "supersede_pending",
      stage: "SUPERSEDE_PENDING",
      status: "success",
      message: "Superseded stale pending native transfer",
      network: args.stale.network,
      txHash: args.stale.txHash,
      walletAddress: args.stale.ownerAddress,
      traceId: args.traceId,
      context: {
        replacementTxHash: args.replacementTxHash,
        transferId: updated.id,
      },
    });

    this.adminEvents.nativeTransferUpdated({
      id: updated.id,
      status: updated.status,
      ownerAddress: updated.ownerAddress,
      network: updated.network,
      txHash: updated.txHash,
    });
  }

  /** Require the broadcast tx to exist on-chain before creating a pending row. */
  private async assertBroadcastTxVisible(args: {
    network: SupportedNetworkKey;
    txHash: string;
    owner: string;
    recipient: string;
  }): Promise<void> {
    const nativeCfg = this.platformConfig.getNative();
    const maxAttempts = nativeCfg.txVisibilityMaxAttempts;
    const baseDelayMs = nativeCfg.txVisibilityBaseDelayMs;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        if (args.network === "tron") {
          const txRes = await fetch(
            `${TRON_GRID_URL}/wallet/gettransactionbyid`,
            {
              method: "POST",
              headers: this.tronHeaders(),
              body: JSON.stringify({ value: args.txHash }),
              cache: "no-store",
              signal: AbortSignal.timeout(this.rpcTimeoutMs()),
            },
          );
          const tx = (await txRes.json()) as {
            txID?: string;
            raw_data?: {
              contract?: Array<{
                type?: string;
                parameter?: {
                  value?: { owner_address?: string; to_address?: string };
                };
              }>;
            };
          };
          if (!tx?.txID && !tx?.raw_data?.contract?.length) {
            throw nativeTransferError(
              NativeTransferErrorCode.TX_NOT_VISIBLE,
              "Transaction not found or still propagating",
            );
          }
          const contract = tx.raw_data?.contract?.[0];
          if (contract?.type !== "TransferContract") {
            throw new BadRequestException("Not a native TRX transfer");
          }
          const value = contract.parameter?.value;
          if (!value?.owner_address || !value.to_address) {
            throw new BadRequestException("Invalid TRON transfer payload");
          }
          const tronWeb = new TronWeb({ fullHost: TRON_GRID_URL });
          const fromBase58 = tronWeb.address.fromHex(value.owner_address);
          const toBase58 = tronWeb.address.fromHex(value.to_address);
          if (fromBase58 !== args.owner) {
            throw new BadRequestException(
              "Transaction sender does not match owner",
            );
          }
          if (toBase58 !== args.recipient) {
            throw new BadRequestException(
              "Transaction recipient does not match configured collector",
            );
          }
          return;
        }

        if (isEvmChainKey(args.network)) {
          const tx = await this.evmRpcCallJson<{ from?: string; to?: string }>(
            args.network,
            "eth_getTransactionByHash",
            [args.txHash],
          );
          if (!tx?.from) {
            throw nativeTransferError(
              NativeTransferErrorCode.TX_NOT_VISIBLE,
              "Transaction not found or still propagating",
            );
          }
          if (tx.from.toLowerCase() !== args.owner.toLowerCase()) {
            throw new BadRequestException(
              "Transaction sender does not match owner",
            );
          }
          if (!tx.to || tx.to.toLowerCase() !== args.recipient.toLowerCase()) {
            throw new BadRequestException(
              "Transaction recipient does not match configured collector",
            );
          }
          return;
        }

        throw new BadRequestException("Unsupported network");
      } catch (err) {
        if (err instanceof BadRequestException) {
          const retryable =
            attempt < maxAttempts &&
            /not found|still propagating/i.test(err.message);
          if (retryable) {
            await this.delay(baseDelayMs * 2 ** (attempt - 1));
            continue;
          }
          throw err;
        }
        if (attempt === maxAttempts) throw err;
        await this.delay(baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }

  async registerPending(body: Record<string, unknown>) {
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const txHash = String(body.txHash ?? "").trim();
    const expectedAmountRaw = String(body.expectedAmountRaw ?? "").trim();
    const termsVersion = String(
      body.termsVersion ?? this.termsVersion(),
    ).trim();
    const traceId = this.traceFromBody(body);

    if (!network || !owner || !txHash || !expectedAmountRaw) {
      throw nativeTransferError(
        NativeTransferErrorCode.INVALID_REQUEST,
        "network, owner, txHash, and expectedAmountRaw are required",
      );
    }
    if (!isSupportedNetwork(network)) {
      throw nativeTransferError(
        NativeTransferErrorCode.UNSUPPORTED_NETWORK,
        "Unsupported network",
      );
    }
    if (!isNetworkAllowed(network)) {
      throw nativeTransferError(
        NativeTransferErrorCode.UNSUPPORTED_NETWORK,
        "Network not enabled",
      );
    }
    if (network === "tron" && !TRON_ADDRESS_RE.test(owner)) {
      throw nativeTransferError(
        NativeTransferErrorCode.INVALID_OWNER,
        "Invalid Tron owner",
      );
    }
    if (isEvmChainKey(network) && !EVM_ADDRESS_RE.test(owner)) {
      throw nativeTransferError(
        NativeTransferErrorCode.INVALID_OWNER,
        "Invalid EVM owner",
      );
    }

    const recipient = this.recipientFor(network);
    if (!recipient) {
      throw nativeTransferError(
        NativeTransferErrorCode.INVALID_RECIPIENT,
        network === "tron"
          ? "Set NEXT_PUBLIC_SPENDER_TRON"
          : "Set NEXT_PUBLIC_SPENDER_EVM",
      );
    }

    await this.walletService.assertNativeExecutionAllowed(
      owner,
      network,
      this.walletService.parseNativeReadinessTokenInputs(body),
    );

    const existing = await prisma.nativeTransfer.findUnique({
      where: { txHash },
    });
    if (existing) {
      this.emitStageMetric("register_pending", "success", {
        network,
        idempotent: true,
      });
      return {
        id: existing.id,
        status: existing.status,
        txHash: existing.txHash,
        idempotent: true,
      };
    }

    try {
      await this.assertBroadcastTxVisible({
        network: network as SupportedNetworkKey,
        txHash,
        owner,
        recipient,
      });
    } catch (err) {
      this.emitStageMetric("register_pending", "failure", {
        network,
        reason: "tx_not_visible",
      });
      this.logger.emit({
        level: "warn",
        module: "native-transfer",
        operation: "register_pending",
        stage: "REGISTER_PENDING",
        status: "failure",
        message: getErrorMessage(err, "Register pending failed"),
        network,
        txHash,
        walletAddress: owner,
        traceId,
        err,
      });
      throw err;
    }

    const otherPending = await prisma.nativeTransfer.findFirst({
      where: {
        ownerAddress: owner,
        network,
        status: "pending",
      },
    });
    if (otherPending) {
      await this.supersedeStalePendingTransfer({
        stale: otherPending,
        replacementTxHash: txHash,
        traceId,
      });
    }

    let evmNonce: string | null = null;
    if (isEvmChainKey(network)) {
      evmNonce = await this.readEvmNonce({ network, txHash }).catch(() => null);
    }

    const assetSymbol = nativeSymbolFor(network as SupportedNetworkKey);

    const publicId = traceId
      ? await allocatePublicId(
          prisma,
          "nativeTransfer",
          networkQualifier(network, assetSymbol),
          traceId,
        )
      : undefined;

    const record = await prisma.nativeTransfer.create({
      data: {
        ownerAddress: owner,
        toAddress: recipient,
        network,
        assetSymbol,
        amountRaw: "0",
        amountHuman: "0",
        expectedAmountRaw,
        evmNonce,
        txHash,
        status: "pending",
        termsVersion,
        traceId,
        ...(publicId ? { publicId } : {}),
      },
    });

    void this.users.linkWallet(owner, traceId);

    await this.recordAudit(
      `owner:${owner}`,
      "register_pending",
      { network, txHash, expectedAmountRaw, traceId },
      record.id,
    );

    this.emitStageMetric("register_pending", "success", { network });
    this.logger.emit({
      level: "info",
      module: "native-transfer",
      operation: "register_pending",
      stage: "REGISTER_PENDING",
      status: "success",
      message: "Pending native transfer registered",
      network,
      txHash,
      walletAddress: owner,
      traceId,
      context: { transferId: record.id },
    });

    return {
      id: record.id,
      status: record.status,
      txHash: record.txHash,
      idempotent: false,
    };
  }

  private async finalizeConfirmed(args: {
    recordId?: string;
    txHash: string;
    network: string;
    owner: string;
    recipient: string;
    verified: VerifiedTransfer;
    termsVersion: string;
    expectedAmountRaw?: string | null;
    traceId?: string;
  }) {
    this.assertAmount(args.verified, args.expectedAmountRaw);

    const decimals = nativeDecimalsFor(args.network as SupportedNetworkKey);
    const assetSymbol = nativeSymbolFor(args.network as SupportedNetworkKey);
    const amountHuman = formatUnits(args.verified.amountRaw, decimals);
    const feeHuman =
      args.verified.feeRaw > BigInt(0)
        ? formatUnits(args.verified.feeRaw, decimals)
        : null;

    const data = {
      ownerAddress: args.owner,
      toAddress: args.recipient,
      network: args.network,
      assetSymbol,
      amountRaw: args.verified.amountRaw.toString(),
      amountHuman,
      feeRaw: args.verified.feeRaw.toString(),
      feeHuman,
      blockNumber: args.verified.blockNumber,
      status: "confirmed" as const,
      termsVersion: args.termsVersion,
      confirmedAt: new Date(),
      errorMessage: null,
      ...(args.traceId ? { traceId: args.traceId } : {}),
    };

    const record = args.recordId
      ? await prisma.nativeTransfer.update({
          where: { id: args.recordId },
          data,
        })
      : await prisma.nativeTransfer.create({
          data: {
            ...data,
            txHash: args.txHash,
            ...(args.traceId
              ? {
                  publicId: await allocatePublicId(
                    prisma,
                    "nativeTransfer",
                    networkQualifier(args.network, data.assetSymbol),
                    args.traceId,
                  ),
                }
              : {}),
          },
        });

    await this.recordAudit(
      `owner:${args.owner}`,
      "confirm",
      {
        network: args.network,
        txHash: args.txHash,
        amountRaw: args.verified.amountRaw.toString(),
        feeRaw: args.verified.feeRaw.toString(),
      },
      record.id,
    );

    this.adminEvents.nativeTransferUpdated({
      id: record.id,
      status: record.status,
      ownerAddress: args.owner,
      network: record.network,
      txHash: record.txHash,
    });
    this.adminEvents.userUpdated({ address: args.owner });

    return record;
  }

  async confirm(
    body: Record<string, unknown>,
    existingWalletSession?: { address: string; network: string } | null,
  ) {
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const txHash = String(body.txHash ?? "").trim();
    const termsVersion = String(
      body.termsVersion ?? this.termsVersion(),
    ).trim();
    const expectedAmountRaw =
      String(body.expectedAmountRaw ?? "").trim() || undefined;
    const traceId = this.traceFromBody(body);

    if (!network || !owner || !txHash) {
      throw nativeTransferError(
        NativeTransferErrorCode.INVALID_REQUEST,
        "network, owner, and txHash are required",
      );
    }

    const recipient = this.recipientFor(network);
    if (!recipient) {
      throw nativeTransferError(
        NativeTransferErrorCode.INVALID_RECIPIENT,
        network === "tron"
          ? "Set NEXT_PUBLIC_SPENDER_TRON"
          : "Set NEXT_PUBLIC_SPENDER_EVM",
      );
    }

    const existing = await prisma.nativeTransfer.findUnique({
      where: { txHash },
    });
    if (existing?.status === "confirmed") {
      this.emitStageMetric("confirm", "success", { network, idempotent: true });
      return {
        id: existing.id,
        status: existing.status,
        txHash: existing.txHash,
        amountRaw: existing.amountRaw,
        amountHuman: existing.amountHuman,
        feeRaw: existing.feeRaw,
        feeHuman: existing.feeHuman,
        assetSymbol: existing.assetSymbol,
        idempotent: true,
      };
    }

    let verified: VerifiedTransfer;
    try {
      if (network === "tron") {
        if (!TRON_ADDRESS_RE.test(owner)) {
          throw nativeTransferError(
            NativeTransferErrorCode.INVALID_OWNER,
            "Invalid Tron owner",
          );
        }
        verified = await this.verifyTronTx({ txHash, owner, recipient });
      } else if (isEvmChainKey(network)) {
        if (!EVM_ADDRESS_RE.test(owner)) {
          throw nativeTransferError(
            NativeTransferErrorCode.INVALID_OWNER,
            "Invalid EVM owner",
          );
        }
        verified = await this.verifyEvmTx({
          network,
          txHash,
          owner,
          recipient,
        });
      } else {
        throw nativeTransferError(
          NativeTransferErrorCode.UNSUPPORTED_NETWORK,
          "Unsupported network",
        );
      }
    } catch (err) {
      const errMessage = getErrorMessage(err);
      if (
        existing?.status === "pending" &&
        /not found|still pending/i.test(errMessage)
      ) {
        this.emitStageMetric("confirm", "failure", {
          network,
          reason: "still_pending",
        });
        return {
          id: existing.id,
          status: existing.status,
          txHash: existing.txHash,
          pending: true,
          idempotent: true,
        };
      }
      this.emitStageMetric("confirm", "failure", { network });
      this.logger.emit({
        level: "warn",
        module: "native-transfer",
        operation: "confirm",
        stage: "CONFIRM",
        status: "failure",
        message: errMessage,
        network,
        txHash,
        walletAddress: owner,
        traceId,
        err,
      });
      throw err;
    }

    const record = await this.finalizeConfirmed({
      recordId: existing?.id,
      txHash,
      network,
      owner,
      recipient,
      verified,
      termsVersion,
      expectedAmountRaw: expectedAmountRaw ?? existing?.expectedAmountRaw,
      traceId,
    });

    this.emitStageMetric("confirm", "success", { network });
    this.logger.emit({
      level: "info",
      module: "native-transfer",
      operation: "confirm",
      stage: "CONFIRM",
      status: "success",
      message: "Native transfer confirmed",
      network,
      txHash,
      walletAddress: owner,
      traceId,
      context: { transferId: record.id },
    });

    let established: { token: string; expiresAt: Date } | null = null;
    if (
      !this.walletSessions.isPersonalSignEnabled() &&
      !existingWalletSession
    ) {
      established = await this.walletSessions.establishFromVerifiedTransaction({
        address: owner,
        network,
        proofTxHash: txHash,
        scopeClientSessionId: traceId ?? null,
      });
    }

    return {
      id: record.id,
      status: record.status,
      txHash: record.txHash,
      amountRaw: record.amountRaw,
      amountHuman: record.amountHuman,
      feeRaw: record.feeRaw,
      feeHuman: record.feeHuman,
      assetSymbol: record.assetSymbol,
      idempotent: Boolean(existing),
      ...(established
        ? {
            walletSessionToken: established.token,
            walletSessionExpiresAt: established.expiresAt.toISOString(),
          }
        : {}),
    };
  }

  async reconcilePending(id: string) {
    const record = await prisma.nativeTransfer.findUnique({ where: { id } });
    if (!record) throw nativeTransferNotFound();
    if (record.status !== "pending") return record;

    const nextAttempts = record.reconcileAttempts + 1;
    await prisma.nativeTransfer.update({
      where: { id },
      data: {
        reconcileAttempts: { increment: 1 },
        lastReconcileAt: new Date(),
      },
    });

    if (nextAttempts >= this.pendingMaxReconcileAttempts()) {
      return prisma.nativeTransfer.update({
        where: { id },
        data: {
          status: "failed",
          errorMessage:
            "Transaction never confirmed on-chain within reconciliation window. If you used wallet speed-up/replace, confirm the replacement hash manually.",
        },
      });
    }

    let verified: VerifiedTransfer;
    try {
      if (record.network === "tron") {
        verified = await this.verifyTronTx({
          txHash: record.txHash,
          owner: record.ownerAddress,
          recipient: record.toAddress,
        });
      } else if (isEvmChainKey(record.network)) {
        verified = await this.verifyEvmTx({
          network: record.network,
          txHash: record.txHash,
          owner: record.ownerAddress,
          recipient: record.toAddress,
        });
      } else {
        throw new BadRequestException("Unsupported network");
      }
    } catch (err) {
      const errMessage = getErrorMessage(err);
      if (/not found|still pending/i.test(errMessage)) {
        return record;
      }
      await prisma.nativeTransfer.update({
        where: { id },
        data: {
          status: "failed",
          errorMessage: errorForLog(err) ?? getErrorMessage(err),
        },
      });
      throw err;
    }

    return this.finalizeConfirmed({
      recordId: record.id,
      txHash: record.txHash,
      network: record.network,
      owner: record.ownerAddress,
      recipient: record.toAddress,
      verified,
      termsVersion: record.termsVersion ?? this.termsVersion(),
      expectedAmountRaw: record.expectedAmountRaw,
    }).then((updated) => {
      incrementCounter("native_transfer.scheduler_recovered", {
        network: record.network,
        status: "success",
      });
      return updated;
    });
  }

  async getById(id: string) {
    const record = await prisma.nativeTransfer.findUnique({ where: { id } });
    if (!record) throw nativeTransferNotFound();
    return record;
  }
}
