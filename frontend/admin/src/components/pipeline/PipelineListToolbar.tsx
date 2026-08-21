"use client";

import { Network } from "lucide-react";
import type { PipelineTab } from "@/components/pipeline/PipelineControls";
import { UrlQuerySelect } from "@/components/list-toolbar/UrlQuerySelect";
import { ADMIN_NETWORK_FILTER_OPTIONS } from "@/lib/network-options";

const APPROVAL_STATUS_OPTIONS = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "ACTIVE", label: "Active" },
  { value: "PARTIALLY_USED", label: "Partially used" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REVOKED", label: "Revoked" },
  { value: "EXPIRED", label: "Expired" },
  { value: "FAILED", label: "Failed" },
] as const;

const TRANSFER_STATUS_OPTIONS = [
  { value: "prepared", label: "Prepared" },
  { value: "broadcast", label: "Broadcast" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "failed", label: "Failed" },
] as const;

const NATIVE_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "failed", label: "Failed" },
] as const;

const COLLECTION_OPTIONS = [
  { value: "true", label: "Enabled" },
  { value: "false", label: "Disabled" },
] as const;

export function PipelineListToolbar({
  tab,
  query,
}: {
  tab: PipelineTab;
  query: Record<string, string | undefined>;
}) {
  const statusOptions =
    tab === "transfers"
      ? TRANSFER_STATUS_OPTIONS
      : tab === "native"
        ? NATIVE_STATUS_OPTIONS
        : APPROVAL_STATUS_OPTIONS;

  return (
    <>
      <UrlQuerySelect
        action="/pipeline"
        query={query}
        param="network"
        label="Network"
        icon={Network}
        options={ADMIN_NETWORK_FILTER_OPTIONS}
      />
      <UrlQuerySelect
        action="/pipeline"
        query={query}
        param="status"
        label="Status"
        options={statusOptions}
      />
      {tab === "approvals" ? (
        <UrlQuerySelect
          action="/pipeline"
          query={query}
          param="collectionEnabled"
          label="Collection"
          options={COLLECTION_OPTIONS}
        />
      ) : null}
    </>
  );
}
