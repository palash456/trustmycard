import { NextRequest, NextResponse } from "next/server";
import { getApproval } from "@/lib/server/approvals/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/[id]
 * Returns stored approval metadata (no secrets).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const record = getApproval(id);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, approval: record });
}
