import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Placeholder for Tron energy rental / delegation (competitor: /api/energy-delegate).
 * Wire your energy provider later. For now this is a no-op success so the client
 * flow can call it without failing.
 *
 * Expected body (competitor-shaped): { address: "T…" }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    address?: string;
  } | null;

  if (!body?.address?.trim()) {
    return NextResponse.json(
      { error: "body must have required property 'address'" },
      { status: 400 }
    );
  }

  // PLACEHOLDER — plug in energy rental API here when ready.
  return NextResponse.json({
    code: 200,
    status: "success",
    message: "OK",
    data: {
      delegated: false,
      placeholder: true,
      address: body.address.trim(),
    },
    timestamp: new Date().toISOString(),
  });
}
