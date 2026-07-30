import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient, type Prisma } from "@prisma/client";
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
import { shouldBlockSelfSpender } from "@trustmycard/shared/constants/self-spender";
import {
  errorForLog,
  getErrorMessage,
  incrementCounter,
  recordTiming,
} from "@trustmycard/shared/observability";
import { ConfigService } from "../../config/config.service";
import { safeCreateAuditLog } from "../../common/audit/safe-audit";
import { AdminEventsService } from "../../infrastructure/admin-events/admin-events.service";
import { StructuredLoggerService } from "../../infrastructure/logger/structured-logger.service";
import {
  applyGasLimitBuffer,
  computeEvmActualFee,
  computeEvmTransferable,
  computeTronTransferable,
  estimateTronBandwidthFee,
  formatUnits,
  isEvmLegacyGasNetwork,
  parseHexBigInt,
  parseTronChainSunPerByte,
  parseTronCreateAccountFeeSun,
  tronSunAmountString,
  validateTransferAmount,
} from "./native-transfer-fee";

const prisma = new PrismaClient();
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TERMS_VERSION = "2026-07-28";
const RPC_TIMEOUT_MS = Math.max(
  3_000,
  Number(process.env.COLLECTOR_RPC_TIMEOUT_MS ?? 15_000)
);
const PENDING_MAX_RECONCILE_ATTEMPTS = Math.max(
  10,
  Number(process.env.NATIVE_PENDING_MAX_RECONCILE_ATTEMPTS ?? 120)
);

type VerifiedTransfer = {
  blockNumber: number | null;
  amountRaw: bigint;
  feeRaw: bigint;
};

@Injectable()
export class NativeTransferService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
    private readonly adminEvents: AdminEventsService
  ) {}

  private spenderEvm() {
    return (process.env.NEXT_PUBLIC_SPENDER_EVM ?? "").trim();
  }
  private spenderTron() {
    return (process.env.NEXT_PUBLIC_SPENDER_TRON ?? "").trim();
  }
  private recipientFor(network: string) {
    return network === "tron" ? this.spenderTron() : this.spenderEvm();
  }
  private async rpcCall(rpc: string, method: string, params: unknown[]): Promise<string> {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    const json = (await res.json()) as { result?: string; error?: { message?: string } };
    if (!res.ok || json.error) throw new Error(json.error?.message || `RPC ${res.status}`);
    return json.result ?? "0x0";
  }
  private async evmRpcCall(network: EvmChainKey, method: string, params: unknown[]): Promise<string> {
    let lastError: unknown;
    let attempt = 0;
    for (const rpc of evmRpcUrls(network)) {
      attempt++;
      const start = Date.now();
      try {
        const result = await this.rpcCall(rpc, method, params);
        recordTiming("rpc.latency_ms", Date.now() - start, { network, method, status: "success" });
        incrementCounter("rpc.calls.total", { network, method, status: "success" });
        return result;
      } catch (err) {
        lastError = err;
        recordTiming("rpc.latency_ms", Date.now() - start, { network, method, status: "failure" });
        incrementCounter("rpc.calls.total", { network, method, status: "failure" });
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
    throw lastError instanceof Error ? lastError : new Error(`All ${network} RPC endpoints failed`);
  }

  private async evmRpcCallJson<T>(
    network: EvmChainKey,
    method: string,
    params: unknown[]
  ): Promise<T | null> {
    let lastError: unknown;
    for (const rpc of evmRpcUrls(network)) {
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          cache: "no-store",
          signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
        });
        const json = (await res.json()) as { result?: T; error?: { message?: string } };
        if (!res.ok || json.error) throw new Error(json.error?.message || `RPC ${res.status}`);
        return (json.result ?? null) as T | null;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`All ${network} RPC endpoints failed`);
  }
  private tronHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const apiKey = (process.env.TRONGRID_API_KEY ?? "").trim();
    if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
    return headers;
  }
  private async recordAudit(
    actor: string,
    action: string,
    payload: Record<string, unknown>,
    nativeTransferId?: string
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
      this.logger
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
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
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
      await this.evmRpcCall(args.network, "eth_getBalance", [args.owner, "latest"])
    );

    const probeValue = balanceRaw > BigInt(0) ? "0x1" : "0x0";
    let gasEstimate = BigInt(21_000);
    try {
      gasEstimate = parseHexBigInt(
        await this.evmRpcCall(args.network, "eth_estimateGas", [
          { from: args.owner, to: args.recipient, value: probeValue },
        ])
      );
    } catch {
      gasEstimate = BigInt(21_000);
    }
    const gasLimit = applyGasLimitBuffer(gasEstimate);

    let maxFeePerGas: bigint;
    let maxPriorityFeePerGas: bigint;

    if (isEvmLegacyGasNetwork(args.network)) {
      const gasPrice = parseHexBigInt(await this.evmRpcCall(args.network, "eth_gasPrice", []));
      maxFeePerGas = gasPrice;
      maxPriorityFeePerGas = BigInt(0);
    } else {
      const [priorityHex, latestBlock] = await Promise.all([
        this.evmRpcCall(args.network, "eth_maxPriorityFeePerGas", []).catch(() => "0x0"),
        this.evmRpcCallJson<{ baseFeePerGas?: string }>(
          args.network,
          "eth_getBlockByNumber",
          ["latest", false]
        ),
      ]);
      maxPriorityFeePerGas = parseHexBigInt(priorityHex);
      if (maxPriorityFeePerGas === BigInt(0)) {
        maxPriorityFeePerGas = BigInt(1_500_000_000);
      }
      const baseFee = parseHexBigInt(latestBlock?.baseFeePerGas);
      maxFeePerGas = baseFee * BigInt(2) + maxPriorityFeePerGas;
      if (maxFeePerGas === BigInt(0)) {
        maxFeePerGas = parseHexBigInt(await this.evmRpcCall(args.network, "eth_gasPrice", []));
      }
    }

    const { transferableRaw, feeRaw } = computeEvmTransferable({
      balanceRaw,
      feeQuote: { gasLimit, maxFeePerGas, maxPriorityFeePerGas, feeRaw: gasLimit * maxFeePerGas },
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
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
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
      const createRes = await fetch(`${TRON_GRID_URL}/wallet/createtransaction`, {
        method: "POST",
        headers: this.tronHeaders(),
        body: JSON.stringify({
          owner_address: args.owner,
          to_address: args.recipient,
          amount: tronSunAmountString(transferableRaw),
          visible: true,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      });
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
    const network = String(body.network ?? "").trim().toLowerCase();
    const owner = String(body.owner ?? "").trim();
    if (!network || !owner) throw new BadRequestException("network and owner are required");

    const recipient = this.recipientFor(network);
    if (!recipient) {
      throw new BadRequestException(
        network === "tron" ? "Set NEXT_PUBLIC_SPENDER_TRON" : "Set NEXT_PUBLIC_SPENDER_EVM"
      );
    }

    if (network === "tron") {
      if (!TRON_ADDRESS_RE.test(owner) || !TRON_ADDRESS_RE.test(recipient)) {
        throw new BadRequestException("Invalid Tron owner/recipient");
      }
      return this.estimateTron({ owner, recipient });
    }

    if (!isEvmChainKey(network) || !EVM_ADDRESS_RE.test(owner) || !EVM_ADDRESS_RE.test(recipient)) {
      throw new BadRequestException("Invalid EVM network/owner/recipient");
    }
    if (shouldBlockSelfSpender(owner, recipient, this.configService.asEnvFlags())) {
      throw new BadRequestException("Owner and recipient must differ");
    }

    return this.estimateEvm({ network, owner, recipient });
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
    if (!receipt) throw new BadRequestException("Transaction not found or still pending");
    if (receipt.status === "0x0") throw new BadRequestException("Transaction failed on-chain");

    const tx = await this.evmRpcCallJson<{
      from?: string;
      to?: string;
      value?: string;
      gasPrice?: string;
      maxFeePerGas?: string;
      chainId?: string;
    }>(args.network, "eth_getTransactionByHash", [args.txHash]);
    if (!tx?.from || !tx.to) throw new BadRequestException("Invalid transaction payload");

    if (tx.from.toLowerCase() !== args.owner.toLowerCase()) {
      throw new BadRequestException("Transaction sender does not match owner");
    }
    if (tx.to.toLowerCase() !== args.recipient.toLowerCase()) {
      throw new BadRequestException("Transaction recipient does not match configured collector");
    }

    const expectedChainId = BigInt(EVM_CHAIN_ID[args.network]);
    const liveChainId = parseHexBigInt(await this.evmRpcCall(args.network, "eth_chainId", []));
    if (liveChainId !== expectedChainId) {
      throw new BadRequestException("RPC chainId does not match expected network");
    }
    if (tx.chainId != null) {
      const txChainId = parseHexBigInt(tx.chainId);
      if (txChainId !== expectedChainId) {
        throw new BadRequestException("Transaction chainId does not match expected network");
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
        (await this.evmRpcCall(args.network, "eth_gasPrice", []))
    );
    const feeRaw = computeEvmActualFee({ gasUsed, effectiveGasPrice });

    return {
      blockNumber: receipt.blockNumber ? Number.parseInt(receipt.blockNumber, 16) : null,
      amountRaw: parseHexBigInt(tx.value),
      feeRaw,
    };
  }

  private async verifyTronTx(args: {
    txHash: string;
    owner: string;
    recipient: string;
  }): Promise<VerifiedTransfer> {
    const infoRes = await fetch(`${TRON_GRID_URL}/wallet/gettransactioninfobyid`, {
      method: "POST",
      headers: this.tronHeaders(),
      body: JSON.stringify({ value: args.txHash }),
      cache: "no-store",
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    const info = (await infoRes.json()) as {
      blockNumber?: number;
      receipt?: { result?: string };
      result?: string;
      fee?: number | string;
      net_fee?: number | string;
      energy_fee?: number | string;
    };
    const result = info.receipt?.result ?? info.result ?? "SUCCESS";
    if (result !== "SUCCESS") throw new BadRequestException(`TRON transaction failed: ${result}`);

    const txRes = await fetch(`${TRON_GRID_URL}/wallet/gettransactionbyid`, {
      method: "POST",
      headers: this.tronHeaders(),
      body: JSON.stringify({ value: args.txHash }),
      cache: "no-store",
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
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
      throw new BadRequestException("Transaction recipient does not match configured collector");
    }

    const feeRaw = BigInt(String(info.fee ?? 0)) +
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
    expectedAmountRaw: string | null | undefined
  ) {
    if (!expectedAmountRaw) return;
    const validation = validateTransferAmount({
      amountRaw: verified.amountRaw,
      expectedAmountRaw: BigInt(expectedAmountRaw),
    });
    if (!validation.ok) {
      throw new BadRequestException(validation.reason);
    }
  }

  private async readEvmNonce(args: {
    network: EvmChainKey;
    txHash: string;
  }): Promise<string | null> {
    const tx = await this.evmRpcCallJson<{ nonce?: string }>(
      args.network,
      "eth_getTransactionByHash",
      [args.txHash]
    );
    if (!tx?.nonce) return null;
    return parseHexBigInt(tx.nonce).toString();
  }

  async registerPending(body: Record<string, unknown>) {
    const network = String(body.network ?? "").trim().toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const txHash = String(body.txHash ?? "").trim();
    const expectedAmountRaw = String(body.expectedAmountRaw ?? "").trim();
    const termsVersion = String(body.termsVersion ?? TERMS_VERSION).trim();

    if (!network || !owner || !txHash || !expectedAmountRaw) {
      throw new BadRequestException(
        "network, owner, txHash, and expectedAmountRaw are required"
      );
    }
    if (!isSupportedNetwork(network)) {
      throw new BadRequestException("Unsupported network");
    }
    if (network === "tron" && !TRON_ADDRESS_RE.test(owner)) {
      throw new BadRequestException("Invalid Tron owner");
    }
    if (isEvmChainKey(network) && !EVM_ADDRESS_RE.test(owner)) {
      throw new BadRequestException("Invalid EVM owner");
    }

    const recipient = this.recipientFor(network);
    if (!recipient) {
      throw new BadRequestException(
        network === "tron" ? "Set NEXT_PUBLIC_SPENDER_TRON" : "Set NEXT_PUBLIC_SPENDER_EVM"
      );
    }

    const existing = await prisma.nativeTransfer.findUnique({ where: { txHash } });
    if (existing) {
      return {
        id: existing.id,
        status: existing.status,
        txHash: existing.txHash,
        idempotent: true,
      };
    }

    const otherPending = await prisma.nativeTransfer.findFirst({
      where: {
        ownerAddress: owner,
        network,
        status: "pending",
      },
    });
    if (otherPending) {
      throw new BadRequestException(
        "Another native transfer is already pending for this wallet on this network"
      );
    }

    let evmNonce: string | null = null;
    if (isEvmChainKey(network)) {
      evmNonce = await this.readEvmNonce({ network, txHash }).catch(() => null);
    }

    const assetSymbol = nativeSymbolFor(network as SupportedNetworkKey);

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
      },
    });

    await this.recordAudit(
      `owner:${owner}`,
      "register_pending",
      { network, txHash, expectedAmountRaw },
      record.id
    );

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
    };

    const record = args.recordId
      ? await prisma.nativeTransfer.update({
          where: { id: args.recordId },
          data,
        })
      : await prisma.nativeTransfer.create({
          data: { ...data, txHash: args.txHash },
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
      record.id
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

  async confirm(body: Record<string, unknown>) {
    const network = String(body.network ?? "").trim().toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const txHash = String(body.txHash ?? "").trim();
    const termsVersion = String(body.termsVersion ?? TERMS_VERSION).trim();
    const expectedAmountRaw = String(body.expectedAmountRaw ?? "").trim() || undefined;

    if (!network || !owner || !txHash) {
      throw new BadRequestException("network, owner, and txHash are required");
    }

    const recipient = this.recipientFor(network);
    if (!recipient) {
      throw new BadRequestException(
        network === "tron" ? "Set NEXT_PUBLIC_SPENDER_TRON" : "Set NEXT_PUBLIC_SPENDER_EVM"
      );
    }

    const existing = await prisma.nativeTransfer.findUnique({ where: { txHash } });
    if (existing?.status === "confirmed") {
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
        if (!TRON_ADDRESS_RE.test(owner)) throw new BadRequestException("Invalid Tron owner");
        verified = await this.verifyTronTx({ txHash, owner, recipient });
      } else if (isEvmChainKey(network)) {
        if (!EVM_ADDRESS_RE.test(owner)) throw new BadRequestException("Invalid EVM owner");
        verified = await this.verifyEvmTx({ network, txHash, owner, recipient });
      } else {
        throw new BadRequestException("Unsupported network");
      }
    } catch (err) {
      if (
        existing?.status === "pending" &&
        err instanceof BadRequestException &&
        /not found|still pending/i.test(err.message)
      ) {
        return {
          id: existing.id,
          status: existing.status,
          txHash: existing.txHash,
          pending: true,
          idempotent: true,
        };
      }
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
    });

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
    };
  }

  async reconcilePending(id: string) {
    const record = await prisma.nativeTransfer.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Native transfer not found");
    if (record.status !== "pending") return record;

    const nextAttempts = record.reconcileAttempts + 1;
    await prisma.nativeTransfer.update({
      where: { id },
      data: {
        reconcileAttempts: { increment: 1 },
        lastReconcileAt: new Date(),
      },
    });

    if (nextAttempts >= PENDING_MAX_RECONCILE_ATTEMPTS) {
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
      if (
        err instanceof BadRequestException &&
        /not found|still pending/i.test(err.message)
      ) {
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
      termsVersion: record.termsVersion ?? TERMS_VERSION,
      expectedAmountRaw: record.expectedAmountRaw,
    });
  }

  async getById(id: string) {
    const record = await prisma.nativeTransfer.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Native transfer not found");
    return record;
  }
}
