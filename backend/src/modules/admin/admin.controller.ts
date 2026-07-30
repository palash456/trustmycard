import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { globalMetrics } from "@trustmycard/shared/observability";
import { Observable } from "rxjs";
import { AdminApiKeyGuard } from "../../common/guards/admin-api-key.guard";
import { ObservabilityService } from "../observability/observability.service";
import { AdminOpsService } from "./admin-ops.service";
import { AdminService } from "./admin.service";
import { AdminStreamService } from "./admin-stream.service";
import { AnalyticsService } from "./analytics.service";
import { UserAggregationService } from "./user-aggregation.service";

@ApiTags("Admin")
@ApiSecurity("adminApiKey")
@UseGuards(AdminApiKeyGuard)
@Controller("api/admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminOps: AdminOpsService,
    private readonly streamService: AdminStreamService,
    private readonly userAggregation: UserAggregationService,
    private readonly analytics: AnalyticsService,
    private readonly observability: ObservabilityService
  ) {}

  @Get("analytics")
  @ApiOperation({ summary: "Platform analytics dashboard aggregates" })
  getAnalytics(@Query() query: Record<string, string>) {
    return this.analytics.getAnalytics(query);
  }

  @Get("analytics/activity")
  @ApiOperation({ summary: "Recent platform activity feed" })
  getAnalyticsActivity(@Query("limit") limit?: string) {
    return this.analytics.getActivity(limit);
  }

  @Get("dashboard")
  @ApiOperation({ summary: "Admin dashboard aggregates" })
  dashboard() {
    return this.adminService.getDashboard();
  }

  @Get("settings")
  @ApiOperation({ summary: "Runtime settings (env + DB)" })
  getSettings(@Query("category") category?: string) {
    return this.adminOps.getSettings(category);
  }

  @Patch("settings")
  @ApiOperation({ summary: "Update runtime settings" })
  patchSettings(@Body() body: Record<string, unknown>) {
    return this.adminOps.patchSettings(body);
  }

  @Post("settings/reload")
  @ApiOperation({ summary: "Reload settings cache and schedulers" })
  reloadSettings() {
    return this.adminOps.reloadConfig();
  }

  @Get("system/status")
  @ApiOperation({ summary: "System status and secrets metadata" })
  systemStatus() {
    return this.adminOps.getSystemStatus();
  }

  @Get("stream")
  @Sse()
  @ApiOperation({ summary: "SSE stream for admin live updates" })
  stream(): Observable<{ data: string }> {
    return new Observable((subscriber) => {
      const unsub = this.streamService.subscribe((event) => {
        subscriber.next({ data: JSON.stringify(event) });
      });
      subscriber.next({
        data: JSON.stringify({
          type: "connected",
          payload: { ok: true },
          at: new Date().toISOString(),
        }),
      });
      return () => unsub();
    });
  }

  @Get("approvals")
  @ApiOperation({ summary: "List approvals (paginated)" })
  listApprovals(@Query() query: Record<string, string>) {
    return this.adminService.listApprovals(query);
  }

  @Get("approvals/:id")
  @ApiOperation({ summary: "Approval detail with transfers and audit" })
  getApproval(@Param("id") id: string) {
    return this.adminService.getApproval(id);
  }

  @Patch("approvals/:id")
  @ApiOperation({ summary: "Update approval collection settings" })
  patchApproval(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.adminOps.patchApproval(id, body);
  }

  @Get("transfers")
  @ApiOperation({ summary: "List token transfers (paginated)" })
  listTransfers(@Query() query: Record<string, string>) {
    return this.adminService.listTransfers(query);
  }

  @Get("transfers/:id")
  @ApiOperation({ summary: "Transfer detail" })
  getTransfer(@Param("id") id: string) {
    return this.adminService.getTransfer(id);
  }

  @Post("transfers/:id/retry")
  @ApiOperation({ summary: "Retry a failed transfer or reconcile a broadcast transfer" })
  retryTransfer(@Param("id") id: string) {
    return this.adminOps.retryTransfer(id);
  }

  @Post("transfers/:id/reconcile")
  @ApiOperation({ summary: "Reconcile a broadcast or inconsistent token transfer" })
  reconcileTransfer(@Param("id") id: string) {
    return this.adminOps.reconcileTransfer(id);
  }

  @Get("native-transfers")
  @ApiOperation({ summary: "List native transfers (paginated)" })
  listNativeTransfers(@Query() query: Record<string, string>) {
    return this.adminService.listNativeTransfers(query);
  }

  @Get("native-transfers/:id")
  @ApiOperation({ summary: "Native transfer detail" })
  getNativeTransfer(@Param("id") id: string) {
    return this.adminService.getNativeTransfer(id);
  }

  @Post("native-transfers/:id/reconcile")
  @ApiOperation({ summary: "Trigger reconciliation for a pending native transfer" })
  reconcileNativeTransfer(@Param("id") id: string) {
    return this.adminService.reconcileNativeTransfer(id);
  }

  @Get("audit-logs")
  @ApiOperation({ summary: "List audit logs (paginated)" })
  listAuditLogs(@Query() query: Record<string, string>) {
    return this.adminService.listAuditLogs(query);
  }

  @Get("observability/events")
  @ApiOperation({ summary: "Search observability events (paginated)" })
  searchObservabilityEvents(@Query() query: Record<string, string>) {
    return this.observability.searchAdmin(query);
  }

  @Get("sessions/:sessionId/timeline")
  @ApiOperation({ summary: "Session authorization timeline" })
  async getSessionTimeline(@Param("sessionId") sessionId: string) {
    const timeline = await this.observability.getSessionTimeline(sessionId);
    if (!timeline) throw new NotFoundException(`No timeline for session ${sessionId}`);
    return timeline;
  }

  @Get("metrics")
  @ApiOperation({ summary: "In-process metrics snapshot" })
  getMetrics() {
    return globalMetrics.snapshot();
  }

  @Get("tg-events")
  @ApiOperation({ summary: "List Telegram/flow events (paginated)" })
  listTgEvents(@Query() query: Record<string, string>) {
    return this.adminService.listTgEvents(query);
  }

  @Get("tg-events/:id")
  @ApiOperation({ summary: "Flow event detail" })
  getTgEvent(@Param("id") id: string) {
    return this.adminOps.getTgEvent(id);
  }

  @Get("wallets")
  @ApiOperation({ summary: "List wallet addresses with activity summaries" })
  listWallets(@Query() query: Record<string, string>) {
    return this.adminService.listWallets(query);
  }

  @Get("wallets/:address")
  @ApiOperation({ summary: "Wallet detail — all activity for an address" })
  getWallet(@Param("address") address: string) {
    return this.adminService.getWallet(decodeURIComponent(address));
  }

  @Get("users")
  @ApiOperation({ summary: "List users (wallet addresses) with lifecycle summaries" })
  listUsers(@Query() query: Record<string, string>) {
    return this.userAggregation.listUsers(query);
  }

  @Get("users/:address/balances")
  @ApiOperation({ summary: "Live on-chain balances for a user address" })
  getUserBalances(@Param("address") address: string) {
    return this.userAggregation.getUserBalances(decodeURIComponent(address));
  }

  @Get("users/:address")
  @ApiOperation({ summary: "User detail — complete operational dashboard for a wallet" })
  getUser(@Param("address") address: string) {
    return this.userAggregation.getUserDetail(decodeURIComponent(address));
  }

  @Post("transfer")
  @ApiOperation({ summary: "Execute admin transferFrom for an approval" })
  adminTransfer(@Body() body: Record<string, unknown>) {
    return this.adminService.adminTransfer(body);
  }

  @Get("collector/status")
  @ApiOperation({ summary: "Automatic collector health and queue counts" })
  collectorStatus() {
    return this.adminService.collectorStatus();
  }

  @Post("collector/toggle")
  @ApiOperation({ summary: "Enable or disable collector at runtime" })
  collectorToggle(@Body() body: { enabled?: boolean }) {
    return this.adminOps.collectorToggle(body);
  }

  @Post("collector/tick")
  @ApiOperation({ summary: "Force one collector tick" })
  collectorTick() {
    return this.adminOps.collectorTick();
  }

  @Post("collector/release-leases")
  @ApiOperation({ summary: "Release stuck collector leases" })
  releaseLeases() {
    return this.adminOps.releaseLeases();
  }

  @Post("dev/restart-backend")
  @ApiOperation({ summary: "Dev only — restart backend process" })
  restartBackend() {
    return this.adminOps.restartBackend();
  }

  @Post("dev/restart-website")
  @ApiOperation({ summary: "Dev only — restart website process" })
  restartWebsite() {
    return this.adminOps.restartWebsite();
  }
}
