import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** In-memory registry for this server process (resets on restart). */
const seen = new Set<string>();

const DEFAULT_LIMIT = 999;

/**
 * POST /api/register-approved
 *
 * Called after the user grants wallet permission on any chain.
 * Request: { network, address }
 * Response: { code, status, message, data: { registered, limit, alreadyExists }, timestamp }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      network?: string;
      address?: string;
      allowance?: string | null;
      txid?: string | null;
    };

    const network = body.network?.trim().toLowerCase() ?? "";
    const address = body.address?.trim() ?? "";

    if (!network || !address) {
      return NextResponse.json(
        { error: "network and address are required" },
        { status: 400 }
      );
    }

    const key = `${network}:${address.toLowerCase()}`;
    const alreadyExists = seen.has(key);
    if (!alreadyExists) {
      seen.add(key);
    }

    console.info("[register-approved]", {
      network,
      address,
      alreadyExists,
      allowance: body.allowance ?? null,
      txid: body.txid ?? null,
      at: new Date().toISOString(),
    });

    return NextResponse.json({
      code: 200,
      status: "success",
      message: "OK",
      data: {
        registered: true,
        limit: DEFAULT_LIMIT,
        alreadyExists,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[register-approved]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to register approval",
      },
      { status: 500 }
    );
  }
}
