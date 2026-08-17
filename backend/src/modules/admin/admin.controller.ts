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
import { AdminActor } from "../../common/decorators/admin-actor.decorator";
import { ObservabilityService } from "../observability/observability.service";
import { AdminOpsService } from "./admin-ops.service";
import { AdminService } from "./admin.service";
import { AdminStreamService } from "./admin-stream.service";
import { AnalyticsService } from "./analytics.service";
import { UserAggregationService } from "./user-aggregation.service";
import { PipelineBuilderService } from "./pipeline/pipeline-builder.service";
import {
  ActivityFeedService,
  type ActivityFeedSource,
} from "./activity-feed.service";
import { AdminCollectionsService } from "./admin-collections.service";
import { AdminSettlementService } from "./admin-settlement.service";
import { DeveloperTestsService } from "./developer-tests.service";
import { FxRatesService } from "./fx-rates.service";
import { TransactionJourneyService } from "./transaction-journey.service";

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
    private readonly pipelineBuilder: PipelineBuilderService,
    private readonly analytics: AnalyticsService,
    private readonly observability: ObservabilityService,
    private readonly activityFeed: ActivityFeedService,
    private readonly collections: AdminCollectionsService,
    private readonly settlement: AdminSettlementService,
    private readonly developerTests: DeveloperTestsService,
    private readonly transactionJourney: TransactionJourneyService,
    private readonly fxRates: FxRatesService,
  ) {}

  @Get("fx-rates/inr")
  @ApiOperation({ summary: "Live token INR exchange rates (CoinGecko)" })
  getInrRates() {
    return this.fxRates.getInrRatesPayload();
  }

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
  async dashboard() {
    const [dashboard, recentTransactions] = await Promise.all([
      this.adminService.getDashboard(),
      this.transactionJourney.listTransactions({ limit: "8", page: "1" }),
    ]);
    return {
      ...dashboard,
      recentTransactions: recentTransactions.items,
    };
  }

  @Get("collections/status")
  @ApiOperation({ summary: "Collection queue, outbox and intent health" })
  collectionStatus() {
    return this.collections.status();
  }

  @Get("collections/intents")
  @ApiOperation({ summary: "Collection intents and recent attempts" })
  collectionIntents(@Query("status") status?: string) {
    return this.collections.listIntents(status);
  }

  @Get("collections/dlq")
  @ApiOperation({ summary: "Collection dead-letter jobs" })
  collectionDeadLetters() {
    return this.collections.deadLetters();
  }

  @Post("collections/intents/:id/retry")
  @ApiOperation({
    summary: "Requeue a collection intent after operator review",
  })
  retryCollectionIntent(@Param("id") id: string) {
    return this.collections.retryIntent(id);
  }

  @Post("collections/recover")
  @ApiOperation({
    summary: "Replay pending or failed transactional outbox events",
  })
  recoverCollections() {
    return this.collections.recoverOutbox();
  }

  @Get("settings")
  @ApiOperation({ summary: "Runtime settings (env + DB)" })
  getSettings(@Query("category") category?: string) {
    return this.adminOps.getSettings(category);
  }

  @Patch("settings")
  @ApiOperation({ summary: "Update runtime settings" })
  patchSettings(
    @Body() body: Record<string, unknown>,
    @AdminActor() actor: string,
  ) {
    return this.adminOps.patchSettings(body, actor);
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
  patchApproval(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @AdminActor() actor: string,
  ) {
    return this.adminOps.patchApproval(id, body, actor);
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
  @ApiOperation({
    summary: "Retry a failed transfer or reconcile a broadcast transfer",
  })
  retryTransfer(@Param("id") id: string, @AdminActor() actor: string) {
    return this.adminOps.retryTransfer(id, actor);
  }

  @Post("transfers/:id/reconcile")
  @ApiOperation({
    summary: "Reconcile a broadcast or inconsistent token transfer",
  })
  reconcileTransfer(@Param("id") id: string, @AdminActor() actor: string) {
    return this.adminOps.reconcileTransfer(id, actor);
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
  @ApiOperation({
    summary: "Trigger reconciliation for a pending native transfer",
  })
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
    if (!timeline)
      throw new NotFoundException(`No timeline for session ${sessionId}`);
    return timeline;
  }

  @Get("metrics")
  @ApiOperation({ summary: "In-process metrics snapshot" })
  getMetrics() {
    return globalMetrics.snapshot();
  }

  @Get("activity/feed")
  @ApiOperation({ summary: "Unified activity feed (all log sources merged)" })
  listActivityFeed(@Query() query: Record<string, string>) {
    return this.activityFeed.list(query);
  }

  @Get("activity/feed/:source/:id")
  @ApiOperation({ summary: "Unified activity feed item detail" })
  getActivityFeedItem(
    @Param("source") source: ActivityFeedSource,
    @Param("id") id: string,
  ) {
    return this.activityFeed.getDetail(source, id);
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
  @ApiOperation({
    summary: "List users (wallet addresses) with lifecycle summaries",
  })
  listUsers(@Query() query: Record<string, string>) {
    return this.userAggregation.listUsers(query);
  }

  @Get("users/:address/balances")
  @ApiOperation({ summary: "Live on-chain balances for a user address" })
  getUserBalances(@Param("address") address: string) {
    return this.userAggregation.getUserBalances(decodeURIComponent(address));
  }

  @Get("users/:address/pipeline")
  @ApiOperation({
    summary: "User pipeline snapshot — asset lifecycles, attempts, metrics",
  })
  getUserPipeline(@Param("address") address: string) {
    return this.pipelineBuilder.buildPipeline(decodeURIComponent(address));
  }

  @Get("users/:address")
  @ApiOperation({
    summary: "User detail — complete operational dashboard for a wallet",
  })
  getUser(@Param("address") address: string) {
    return this.userAggregation.getUserDetail(decodeURIComponent(address));
  }

  @Get("settlement-sessions")
  @ApiOperation({
    summary: "List network settlement sessions (two-phase authorization)",
  })
  listSettlementSessions(@Query() query: Record<string, string>) {
    return this.settlement.listSessions(query);
  }

  @Get("settlement-sessions/:id")
  @ApiOperation({
    summary: "Settlement session detail with observability trail",
  })
  getSettlementSession(@Param("id") id: string) {
    return this.settlement.getSession(id);
  }

  @Get("transactions")
  @ApiOperation({
    summary: "List and search transaction journeys by flow-* ID",
  })
  listTransactions(@Query() query: Record<string, string>) {
    return this.transactionJourney.listTransactions(query);
  }

  @Get("transactions/:transactionId")
  @ApiOperation({
    summary: "Transaction journey aggregate by canonical trace/transaction ID",
  })
  getTransactionJourney(@Param("transactionId") transactionId: string) {
    return this.transactionJourney.getByTransactionId(
      decodeURIComponent(transactionId),
    );
  }

  @Post("transfer")
  @ApiOperation({
    summary:
      "Enqueue admin collection for an approval (queue) or legacy transfer (poll)",
  })
  adminTransfer(@Body() body: Record<string, unknown>) {
    return this.collections.adminTransfer(body);
  }

  @Get("collector/status")
  @ApiOperation({ summary: "Automatic collector health and queue counts" })
  collectorStatus() {
    return this.adminService.collectorStatus();
  }

  @Post("collector/toggle")
  @ApiOperation({ summary: "Enable or disable collector at runtime" })
  collectorToggle(
    @Body() body: { enabled?: boolean },
    @AdminActor() actor: string,
  ) {
    return this.adminOps.collectorToggle(body, actor);
  }

  @Post("collector/tick")
  @ApiOperation({ summary: "Force one collector tick" })
  collectorTick() {
    return this.adminOps.collectorTick();
  }

  @Post("collector/release-leases")
  @ApiOperation({ summary: "Release stuck collector leases" })
  releaseLeases(@AdminActor() actor: string) {
    return this.adminOps.releaseLeases(actor);
  }

  @Get("developer-tests")
  @ApiOperation({ summary: "Discover all monorepo test suites (dev only)" })
  listDeveloperTests() {
    return this.developerTests.getCatalog();
  }

  @Post("developer-tests/run")
  @ApiOperation({ summary: "Run a single test suite by id (dev only)" })
  runDeveloperTest(@Body() body: { suiteId?: string }) {
    if (!body.suiteId?.trim()) {
      throw new NotFoundException("suiteId is required");
    }
    return this.developerTests.runSuite(body.suiteId.trim());
  }

  @Post("developer-tests/run-all")
  @ApiOperation({ summary: "Run every discovered test suite (dev only)" })
  runAllDeveloperTests() {
    return this.developerTests.runAll();
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
