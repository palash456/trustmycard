import { NextResponse } from "next/server";
import { getApproval } from "../../../approvals/store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const approval = getApproval(id);
  if (!approval) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ approval });
}
