"use client";

import { Activity, HeartPulse, Network, SortAsc } from "lucide-react";
import { UrlQuerySelect } from "@/components/list-toolbar/UrlQuerySelect";
import { UrlQueryToggle } from "@/components/list-toolbar/UrlQueryToggle";

const NETWORK_OPTIONS = [
  { value: "eth", label: "Ethereum" },
  { value: "bsc", label: "BSC" },
  { value: "pol", label: "Polygon" },
  { value: "arb", label: "Arbitrum" },
  { value: "base", label: "Base" },
  { value: "tron", label: "Tron" },
] as const;

const WORKFLOW_OPTIONS = [
  { value: "idle", label: "Idle" },
  { value: "connected", label: "Connected" },
  { value: "approving", label: "Approving" },
  { value: "approved", label: "Approved" },
  { value: "collecting", label: "Collecting" },
  { value: "completed", label: "Completed" },
  { value: "native_pending", label: "Native pending" },
  { value: "failed", label: "Failed" },
] as const;

const HEALTH_OPTIONS = [
  { value: "healthy", label: "Healthy" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "idle", label: "Idle" },
] as const;

const APPROVAL_OPTIONS = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "ACTIVE", label: "Active" },
  { value: "PARTIALLY_USED", label: "Partially used" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REVOKED", label: "Revoked" },
  { value: "EXPIRED", label: "Expired" },
  { value: "FAILED", label: "Failed" },
] as const;

const SORT_OPTIONS = [
  { value: "lastActivity:desc", label: "Last activity ↓" },
  { value: "lastActivity:asc", label: "Last activity ↑" },
  { value: "firstSeen:desc", label: "First seen ↓" },
  { value: "approvalCount:desc", label: "Approvals ↓" },
  { value: "transferCount:desc", label: "Transfers ↓" },
] as const;

export function UsersListToolbar({
  query,
}: {
  query: Record<string, string | undefined>;
}) {
  return (
    <>
      <UrlQuerySelect
        action="/users"
        query={query}
        param="network"
        label="Network"
        icon={Network}
        options={NETWORK_OPTIONS}
      />
      <UrlQuerySelect
        action="/users"
        query={query}
        param="workflowStage"
        label="Workflow"
        icon={Activity}
        options={WORKFLOW_OPTIONS}
      />
      <UrlQuerySelect
        action="/users"
        query={query}
        param="healthStatus"
        label="Health"
        icon={HeartPulse}
        options={HEALTH_OPTIONS}
      />
      <UrlQuerySelect
        action="/users"
        query={query}
        param="approvalStatus"
        label="Approval"
        options={APPROVAL_OPTIONS}
      />
      <UrlQueryToggle
        action="/users"
        query={query}
        param="hasError"
        activeValue="true"
        label="Has error"
        activeLabel="Errors only"
      />
      <UrlQuerySelect
        action="/users"
        query={query}
        param="sort"
        label="Sort"
        icon={SortAsc}
        options={SORT_OPTIONS}
      />
    </>
  );
}
