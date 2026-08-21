"use client";

import { Network, Route } from "lucide-react";
import { StructuredLogTimeRangeSelect } from "@/components/audit/StructuredLogTimeRangeSelect";
import { UrlQuerySelect } from "@/components/list-toolbar/UrlQuerySelect";
import { ADMIN_NETWORK_FILTER_OPTIONS } from "@/lib/network-options";

const STATUS_OPTIONS = [
  { value: "success", label: "Success" },
  { value: "in_progress", label: "In progress" },
  { value: "error", label: "Error" },
  { value: "failed", label: "Failed" },
  { value: "failure", label: "Failure" },
  { value: "rejected", label: "Rejected" },
] as const;

const STEP_OPTIONS = [
  { value: "connect", label: "Connect" },
  { value: "scan", label: "Scan" },
  { value: "approve", label: "Approve" },
  { value: "approval", label: "Approval" },
  { value: "payment", label: "Payment" },
  { value: "broadcast", label: "Broadcast" },
  { value: "connect_scan", label: "Connect & scan" },
  { value: "revoke", label: "Revoke" },
] as const;

export function ActivityListToolbar({
  query,
}: {
  query: Record<string, string | undefined>;
}) {
  return (
    <>
      <UrlQuerySelect
        action="/activity"
        query={query}
        param="network"
        label="Network"
        icon={Network}
        options={ADMIN_NETWORK_FILTER_OPTIONS}
      />
      <UrlQuerySelect
        action="/activity"
        query={query}
        param="status"
        label="Status"
        options={STATUS_OPTIONS}
      />
      <UrlQuerySelect
        action="/activity"
        query={query}
        param="type"
        label="Step"
        icon={Route}
        options={STEP_OPTIONS}
      />
      <StructuredLogTimeRangeSelect query={query} action="/activity" />
    </>
  );
}
