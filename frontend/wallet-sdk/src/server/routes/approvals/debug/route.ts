import { NextRequest, NextResponse } from "next/server";
import { flowLog, logStoreSnapshot } from "../../../approvals/flow-logger";
import { getStoreSnapshot } from "../../../approvals/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/debug
 *
 * Dumps in-memory approvals, audits, and transfers.
 * Also prints a snapshot to the npm run dev terminal.
 */
export async function GET(req: NextRequest) {
  const snapshot = getStoreSnapshot();
  const print = req.nextUrl.searchParams.get("print") !== "0";

  if (print) {
    logStoreSnapshot(snapshot);
  }

  return NextResponse.json({
    ok: true,
    note: "Funds are only moved by admin transferFrom — not by approve(). transfers[] will be empty until that is executed.",
    ...snapshot,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/approvals/debug
 * Body: { step, ...fields } — mirrors client flow events into the terminal.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      step?: string;
      [key: string]: unknown;
    };
    const step = (body.step ?? "CLIENT_EVENT").toString();
    const { step: _s, ...rest } = body;
    flowLog(step, rest as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "flow log failed",
      },
      { status: 400 }
    );
  }
}
