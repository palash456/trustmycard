import { NextRequest, NextResponse } from "next/server";
import { validateMigrationDomains } from "@/lib/migration-test/domains";
import { runMigrationTests } from "@/lib/migration-test/runner";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { oldDomain?: string; newDomain?: string; testSecret?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateMigrationDomains(
    body.oldDomain ?? "",
    body.newDomain ?? "",
  );
  if (!validation.ok || !validation.domains) {
    const messages = [
      validation.errors.oldDomain,
      validation.errors.newDomain,
    ].filter(Boolean);
    return NextResponse.json(
      { error: messages.join(" ") || "Invalid domains" },
      { status: 400 },
    );
  }

  const summary = await runMigrationTests(validation.domains);
  return NextResponse.json(summary);
}
