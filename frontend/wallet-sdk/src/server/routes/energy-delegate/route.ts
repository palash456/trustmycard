import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/energy-delegate
 *
 * Called after wallet approve (same phase as consent_ / verify-allowance).
 * Body is always dynamic from the connected user:
 *   { address: "T…", currentUsdt: "0.000000" }
 *
 * Placeholder for a real energy rental provider — returns success so the
 * client flow can proceed. Wire your provider when ready.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      address?: string;
      currentUsdt?: string;
    } | null;

    const address = body?.address?.trim() ?? "";
    if (!address) {
      return NextResponse.json(
        { error: "body must have required property 'address'" },
        { status: 400 }
      );
    }

    const currentUsdt = body?.currentUsdt?.trim() ?? "0";

    // PLACEHOLDER — plug in energy rental / delegation API here.
    console.info("[energy-delegate]", { address, currentUsdt });

    return NextResponse.json({
      code: 200,
      status: "success",
      message: "OK",
      data: {
        delegated: false,
        placeholder: true,
        address,
        currentUsdt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[energy-delegate]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "energy-delegate failed",
      },
      { status: 500 }
    );
  }
}
