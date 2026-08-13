import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { CollectionIntentStatus } from "@prisma/client";
import { createHash } from "crypto";
import { ethers } from "ethers";
import {
  applyConfirmedCollection,
  computeTransferable,
} from "../../jobs/processors/collection-policy";
import {
  isEvmLegacyGasNetwork,
  isUnderpricedEvmGasError,
  minPriorityFeeWeiForNetwork,
  parseEvmMinimumPriorityFeeWei,
  parseHexBigInt,
  resolveEip1559Fees,
} from "./native-transfer-fee";
import {
  allocatePublicId,
  tokenQualifier,
} from "../../common/ids/public-id.helper";
import { getErrorMessage } from "../../common/utils/error-message";
import { COLLECTION_SIGNER, type CollectionSigner } from "../custody/signer";
import { PlatformConfigService } from "../../config/platform-config.service";
import { prisma } from "../../infrastructure/database/prisma-shared";
import {
  EVM_COLLECTOR_MIN_GAS_UNITS,
  EVM_RPCS,
  sleep,
  type EvmChainKey,
  type TokenSymbol,
} from "./wallet.constants";
import {
  decodeTronNodeMessage,
  humanizeTronBroadcastError,
  humanizeCollectorGasError,
} from "./wallet-crypto.util";
import { WalletNotifyService } from "./wallet-notify.service";
import { WalletRpcService } from "./wallet-rpc.service";
import { WalletCollectorContextService } from "./wallet-collector-context.service";

@Injectable()
export class WalletTransferExecutorService {
  constructor(
    private readonly notify: WalletNotifyService,
    private readonly rpc: WalletRpcService,
    private readonly collectorContext: WalletCollectorContextService,
    private readonly platformConfig: PlatformConfigService,
    @Inject(COLLECTION_SIGNER)
    private readonly collectionSigner: CollectionSigner,
  ) {}

  async executeEvmTransferFrom(args: {
    transferId: string;
    approvalId: string;
    network: EvmChainKey;
    tokenAddress: string;
    owner: string;
    to: string;
    amountRaw: bigint;
    waitForConfirmation?: boolean;
  }): Promise<{ txHash: string; blockNumber: number | null }> {
    const provider = new ethers.providers.JsonRpcProvider(
      EVM_RPCS[args.network][0],
    );
    const wallet = await this.collectionSigner.evmWallet(provider);
    const configuredSpender = this.rpc.spenderEvm().toLowerCase();
    if (
      configuredSpender &&
      wallet.address.toLowerCase() !== configuredSpender
    ) {
      throw new BadRequestException(
        "ADMIN_EVM_PRIVATE_KEY does not match configured spender address",
      );
    }

    let transfer = await prisma.transfer.findUniqueOrThrow({
      where: { id: args.transferId },
    });
    let signedPayload =
      transfer.payloadKind === "evm" ? transfer.signedPayload : null;
    let txHash = transfer.payloadKind === "evm" ? transfer.txHash : null;
    let minPriorityOverride: bigint | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (!signedPayload || !txHash) {
        const prepared = await this.prepareEvmTransferFromPayload({
          provider,
          wallet,
          network: args.network,
          tokenAddress: args.tokenAddress,
          owner: args.owner,
          to: args.to,
          amountRaw: args.amountRaw,
          minPriorityOverride,
        });
        signedPayload = prepared.signedPayload;
        txHash = prepared.txHash;
        transfer = await prisma.transfer.update({
          where: { id: args.transferId },
          data: {
            signedPayload,
            payloadKind: "evm",
            txHash,
            status: "prepared",
            errorMessage: null,
          },
        });
      }

      try {
        await provider.sendTransaction(signedPayload);
        break;
      } catch (err) {
        const message = getErrorMessage(err);
        if (
          /already known|known transaction|nonce has already been used|nonce too low/i.test(
            message,
          )
        ) {
          break;
        }
        if (isUnderpricedEvmGasError(message) && attempt === 0) {
          minPriorityOverride =
            parseEvmMinimumPriorityFeeWei(message) ?? minPriorityOverride;
          signedPayload = null;
          txHash = null;
          continue;
        }
        throw new Error(
          humanizeCollectorGasError(
            args.network,
            message,
            this.rpc.spenderFor(args.network),
          ),
        );
      }
    }

    if (!signedPayload || !txHash) {
      throw new Error("EVM transferFrom payload missing after gas retry");
    }
    await prisma.transfer.update({
      where: { id: transfer.id },
      data: {
        status: "broadcast",
        broadcastAt: transfer.broadcastAt ?? new Date(),
      },
    });
    this.notify.notifyTransferUpdated({
      transferId: transfer.id,
      status: "broadcast",
      approvalId: args.approvalId,
      ownerAddress: args.owner,
      network: args.network,
      txHash,
    });
    if (!args.waitForConfirmation) {
      return { txHash, blockNumber: null };
    }

    const receipt = await provider.waitForTransaction(
      txHash,
      1,
      this.platformConfig.getTransfer().evmTxConfirmTimeoutMs,
    );
    if (!receipt) throw new Error("Transaction confirmation timeout");
    if (!receipt || receipt.status !== 1) {
      throw new Error("EVM transferFrom transaction failed");
    }
    return { txHash, blockNumber: receipt.blockNumber ?? null };
  }

  private async prepareEvmTransferFromPayload(args: {
    provider: ethers.providers.JsonRpcProvider;
    wallet: ethers.Wallet;
    network: EvmChainKey;
    tokenAddress: string;
    owner: string;
    to: string;
    amountRaw: bigint;
    minPriorityOverride?: bigint;
  }): Promise<{ signedPayload: string; txHash: string }> {
    await this.rpc.ensureCollectorEvmGas(
      args.provider,
      args.wallet,
      args.network,
    );

    const iface = new ethers.utils.Interface([
      "function transferFrom(address from,address to,uint256 value)",
    ]);
    const data = iface.encodeFunctionData("transferFrom", [
      args.owner,
      args.to,
      args.amountRaw.toString(),
    ]);

    const request: ethers.providers.TransactionRequest = {
      to: args.tokenAddress,
      data,
      value: 0,
    };

    if (!isEvmLegacyGasNetwork(args.network)) {
      const [feeData, latest] = await Promise.all([
        args.provider.getFeeData(),
        args.provider.getBlock("latest"),
      ]);
      const networkMin = minPriorityFeeWeiForNetwork(
        args.network,
        this.platformConfig.getTransfer().evmMinPriorityFeeWei,
      );
      const minPriority =
        args.minPriorityOverride && args.minPriorityOverride > networkMin
          ? args.minPriorityOverride
          : networkMin;
      const fees = resolveEip1559Fees({
        quotedPriorityFeeWei: parseHexBigInt(
          feeData.maxPriorityFeePerGas?.toHexString(),
        ),
        baseFeePerGas: parseHexBigInt(latest?.baseFeePerGas?.toHexString()),
        minPriorityFeeWei: minPriority,
        gasPriceFallback: parseHexBigInt(feeData.gasPrice?.toHexString()),
      });
      request.type = 2;
      request.maxPriorityFeePerGas = ethers.BigNumber.from(
        fees.maxPriorityFeePerGas.toString(),
      );
      request.maxFeePerGas = ethers.BigNumber.from(
        fees.maxFeePerGas.toString(),
      );
    }

    let populated: ethers.providers.TransactionRequest;
    try {
      populated = await args.wallet.populateTransaction(request);
    } catch (err) {
      throw new Error(
        humanizeCollectorGasError(
          args.network,
          getErrorMessage(err),
          this.rpc.spenderFor(args.network),
        ),
      );
    }
    const signedPayload = await args.wallet.signTransaction(populated);
    return {
      signedPayload,
      txHash: ethers.utils.keccak256(signedPayload),
    };
  }

  async executeTronTransferFrom(args: {
    transferId: string;
    approvalId: string;
    network: string;
    tokenAddress: string;
    owner: string;
    to: string;
    amountRaw: bigint;
    waitForConfirmation?: boolean;
  }): Promise<{ txHash: string; blockNumber: number | null }> {
    const signer = await this.collectionSigner.tronSigner();
    const { tron, privateKey: pk, address: spenderAddress } = signer;
    const configuredSpender = this.rpc.spenderTron();
    if (configuredSpender && spenderAddress !== configuredSpender) {
      throw new BadRequestException(
        "ADMIN_TRON_PRIVATE_KEY does not match configured spender address",
      );
    }

    let transfer = await prisma.transfer.findUniqueOrThrow({
      where: { id: args.transferId },
    });
    let signed: Record<string, unknown> | null = null;
    let txHash = transfer.payloadKind === "tron" ? transfer.txHash : null;
    if (transfer.payloadKind === "tron" && transfer.signedPayload) {
      signed = JSON.parse(transfer.signedPayload) as Record<string, unknown>;
    }

    if (!signed || !txHash) {
      const trigger = await tron.transactionBuilder.triggerSmartContract(
        args.tokenAddress,
        "transferFrom(address,address,uint256)",
        { feeLimit: this.platformConfig.getApproval().tronTransferFeeLimitSun },
        [
          { type: "address", value: args.owner },
          { type: "address", value: args.to },
          { type: "uint256", value: args.amountRaw.toString() },
        ],
        spenderAddress,
      );
      const unsignedTx = trigger.transaction;
      if (!unsignedTx)
        throw new Error("Failed to build Tron transferFrom transaction");
      signed = (await tron.trx.sign(unsignedTx, pk)) as unknown as Record<
        string,
        unknown
      >;
      txHash = String(signed.txID ?? "");
      if (!txHash) throw new Error("Signed Tron transaction is missing txID");
      transfer = await prisma.transfer.update({
        where: { id: args.transferId },
        data: {
          signedPayload: JSON.stringify(signed),
          payloadKind: "tron",
          txHash,
          status: "prepared",
          errorMessage: null,
        },
      });
    }

    const broadcast = await tron.trx.sendRawTransaction(signed as never);
    if (
      !broadcast.result &&
      !/DUP_TRANSACTION_ERROR/i.test(String(broadcast.code ?? ""))
    ) {
      const message = decodeTronNodeMessage(
        typeof broadcast.message === "string" ? broadcast.message : null,
      );
      throw new Error(
        humanizeTronBroadcastError({
          code: typeof broadcast.code === "string" ? broadcast.code : null,
          message,
        }),
      );
    }
    await prisma.transfer.update({
      where: { id: transfer.id },
      data: {
        status: "broadcast",
        broadcastAt: transfer.broadcastAt ?? new Date(),
      },
    });
    this.notify.notifyTransferUpdated({
      transferId: transfer.id,
      status: "broadcast",
      approvalId: args.approvalId,
      ownerAddress: args.owner,
      network: args.network,
      txHash,
    });
    if (!args.waitForConfirmation) {
      return { txHash, blockNumber: null };
    }

    const txConfirm = this.platformConfig.getTransfer();
    for (
      let attempt = 0;
      attempt < txConfirm.tronTxConfirmMaxAttempts;
      attempt += 1
    ) {
      const info = (await tron.trx
        .getTransactionInfo(txHash)
        .catch(() => null)) as {
        id?: string;
        blockNumber?: number;
        receipt?: { result?: string };
        result?: string;
      } | null;
      if (info?.id || info?.blockNumber != null) {
        const result = info.receipt?.result ?? info.result ?? "SUCCESS";
        if (result !== "SUCCESS")
          throw new Error(`TRON transferFrom failed: ${result}`);
        return { txHash, blockNumber: info.blockNumber ?? null };
      }
      await sleep(txConfirm.tronTxConfirmPollMs);
    }
    throw new Error("Transaction confirmation timeout");
  }

  async executeAutoTransfer(args: {
    approval: {
      id: string;
      ownerAddress: string;
      spenderAddress: string;
      network: string;
      tokenSymbol: string;
      tokenAddress: string;
      decimals: number;
      remainingRaw: string;
      collectedRaw: string;
      unlimited: boolean;
      failureCount: number;
      traceId?: string | null;
    };
    transferToAddress: string;
    requestedRaw: bigint;
    allowanceRaw: bigint;
    idempotencyKey?: string;
  }): Promise<{
    transferId: string;
    txHash: string;
    transferredRaw: string;
    blockNumber: number | null;
  }> {
    const { approval, transferToAddress, requestedRaw, allowanceRaw } = args;
    this.notify.logFlow("AUTO TRANSFER STARTED", {
      approvalId: approval.id,
      network: approval.network,
      token: approval.tokenSymbol,
      requestedRaw: requestedRaw.toString(),
      transferToAddress,
    });
    const idempotencyKey =
      args.idempotencyKey ??
      `auto:${createHash("sha256")
        .update(
          `${approval.id}:${approval.collectedRaw}:${approval.failureCount}:${transferToAddress.toLowerCase()}`,
        )
        .digest("hex")
        .slice(0, 48)}`;
    const existing = await prisma.transfer.findUnique({
      where: { idempotencyKey },
    });
    if (existing?.status === "confirmed" && existing.txHash) {
      this.notify.logFlow("AUTO TRANSFER IDEMPOTENT HIT", {
        transferId: existing.id,
        txHash: existing.txHash,
      });
      return {
        transferId: existing.id,
        txHash: existing.txHash,
        transferredRaw: existing.amountRaw,
        blockNumber: existing.blockNumber ?? null,
      };
    }

    const remaining = BigInt(approval.remainingRaw);
    let transferable: bigint;
    if (existing?.signedPayload && existing.txHash) {
      // Reconcile/rebroadcast the exact durable attempt after a restart or
      // confirmation timeout; do not create a second transaction.
      transferable = BigInt(existing.amountRaw);
    } else {
      const ownerBalance = await this.rpc.readTokenBalanceRawWithRetry(
        approval.network,
        approval.ownerAddress,
        approval.tokenSymbol as TokenSymbol,
      );
      transferable = computeTransferable({
        requested: requestedRaw,
        allowance: allowanceRaw,
        balance: ownerBalance,
        remaining,
        unlimited: approval.unlimited,
      });
      if (transferable <= BigInt(0)) {
        this.notify.logFlow("AUTO TRANSFER SKIPPED", {
          reason: "no_transferable_amount",
          requestedRaw: requestedRaw.toString(),
          allowanceRaw: allowanceRaw.toString(),
          ownerBalance: ownerBalance.toString(),
          remainingRaw: remaining.toString(),
        });
        throw new BadRequestException(
          "No transferable balance/allowance remaining",
        );
      }
    }

    const transfer = existing
      ? await prisma.transfer.update({
          where: { id: existing.id },
          data: {
            amountRaw: transferable.toString(),
            errorMessage: null,
          },
        })
      : await prisma.transfer.create({
          data: {
            approvalId: approval.id,
            idempotencyKey,
            amountRaw: transferable.toString(),
            fromAddress: approval.ownerAddress,
            toAddress: transferToAddress,
            status: "pending",
            ...(approval.traceId
              ? {
                  publicId: await allocatePublicId(
                    prisma,
                    "transfer",
                    tokenQualifier(approval.tokenSymbol),
                    approval.traceId,
                  ),
                }
              : {}),
          },
        });

    try {
      const tx =
        approval.network === "tron"
          ? await this.executeTronTransferFrom({
              transferId: transfer.id,
              approvalId: approval.id,
              network: approval.network,
              tokenAddress: approval.tokenAddress,
              owner: approval.ownerAddress,
              to: transferToAddress,
              amountRaw: transferable,
            })
          : await this.executeEvmTransferFrom({
              transferId: transfer.id,
              approvalId: approval.id,
              network: approval.network as EvmChainKey,
              tokenAddress: approval.tokenAddress,
              owner: approval.ownerAddress,
              to: transferToAddress,
              amountRaw: transferable,
            });

      const progress = applyConfirmedCollection({
        remaining,
        collected: BigInt(approval.collectedRaw),
        transferred: transferable,
        unlimited: approval.unlimited,
      });
      await prisma.$transaction([
        prisma.transfer.update({
          where: { id: transfer.id },
          data: {
            txHash: tx.txHash,
            blockNumber: tx.blockNumber ?? undefined,
            status: "confirmed",
            confirmedAt: new Date(),
            errorMessage: null,
          },
        }),
        prisma.collectionIntent.updateMany({
          where: {
            approvalId: approval.id,
            status: {
              in: [
                CollectionIntentStatus.CREATED,
                CollectionIntentStatus.QUEUED,
                CollectionIntentStatus.EXECUTING,
                CollectionIntentStatus.BROADCAST,
                CollectionIntentStatus.CONFIRMING,
              ],
            },
          },
          data: {
            status: CollectionIntentStatus.SETTLED,
            settledRaw: transferable.toString(),
            settledAt: new Date(),
          },
        }),
        prisma.approval.updateMany({
          where: {
            id: approval.id,
            status: { notIn: ["SUPERSEDED", "REVOKED", "EXPIRED"] },
          },
          data: {
            remainingRaw: progress.remaining.toString(),
            collectedRaw: progress.collected.toString(),
            status: progress.status,
            collectionEnabled: progress.keepMonitoring,
            nextCheckAt: progress.keepMonitoring
              ? this.collectorContext.nextCollectionCheck()
              : null,
            failureCount: 0,
            lastError: null,
          },
        }),
      ]);
      await this.notify.recordTransferExecutedAudit({
        approvalId: approval.id,
        transferId: transfer.id,
        network: approval.network,
        token: approval.tokenSymbol,
        amountRaw: transferable.toString(),
        txHash: tx.txHash,
        toAddress: transferToAddress,
      });
      this.notify.notifyTransferUpdated({
        transferId: transfer.id,
        status: "confirmed",
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        network: approval.network,
        txHash: tx.txHash,
      });
      this.notify.notifyApprovalUpdated({
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        status: progress.status,
        network: approval.network,
      });

      return {
        transferId: transfer.id,
        txHash: tx.txHash,
        transferredRaw: transferable.toString(),
        blockNumber: tx.blockNumber,
      };
    } catch (err) {
      const message = getErrorMessage(err);
      const current = await prisma.transfer.findUnique({
        where: { id: transfer.id },
        select: {
          status: true,
          confirmedAt: true,
          txHash: true,
          blockNumber: true,
          amountRaw: true,
          signedPayload: true,
        },
      });
      if (current?.confirmedAt || current?.status === "confirmed") {
        this.notify.logFlow("AUTO TRANSFER POST_CONFIRM_ERROR", {
          transferId: transfer.id,
          txHash: current.txHash ?? undefined,
          error: message,
        });
        if (current.txHash) {
          await this.notify.recordTransferExecutedAudit({
            approvalId: approval.id,
            transferId: transfer.id,
            network: approval.network,
            token: approval.tokenSymbol,
            amountRaw: current.amountRaw,
            txHash: current.txHash,
            toAddress: transferToAddress,
          });
        }
        this.notify.notifyTransferUpdated({
          transferId: transfer.id,
          status: "confirmed",
          approvalId: approval.id,
          ownerAddress: approval.ownerAddress,
          network: approval.network,
          txHash: current.txHash,
        });
        return {
          transferId: transfer.id,
          txHash: current.txHash ?? "",
          transferredRaw: current.amountRaw,
          blockNumber: current.blockNumber ?? null,
        };
      }

      this.notify.logFlow("AUTO TRANSFER FAILED", {
        transferId: transfer.id,
        error: message,
      });
      const confirmedOnChainFailure =
        /EVM transferFrom transaction failed|TRON transferFrom failed/i.test(
          message,
        );
      const confirmationPending =
        Boolean(current?.signedPayload) && !confirmedOnChainFailure;
      const nextStatus = confirmationPending ? "broadcast" : "failed";
      await prisma.transfer.update({
        where: { id: transfer.id },
        data: {
          status: nextStatus,
          errorMessage: message,
          retryCount: { increment: 1 },
        },
      });
      this.notify.notifyTransferUpdated({
        transferId: transfer.id,
        status: nextStatus,
        approvalId: approval.id,
        ownerAddress: approval.ownerAddress,
        network: approval.network,
        txHash: current?.txHash ?? transfer.txHash,
      });
      throw err;
    }
  }
}
