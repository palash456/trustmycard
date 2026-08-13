import { NextRequest, NextResponse } from "next/server";
import {
  validateSpenderChangeInput,
  type SpenderChangeInput,
} from "@/lib/spender-change-test/inputs";
import {
  resolveRunnerSecrets,
  runSpenderChangeTests,
} from "@/lib/spender-change-test/runner";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RequestBody = Partial<SpenderChangeInput> & {
  prodAdminApiKey?: string;
};

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateSpenderChangeInput(body);
  if (!validation.ok || !validation.input) {
    const messages = Object.values(validation.errors).filter(Boolean);
    return NextResponse.json(
      { error: messages.join(" ") || "Invalid spender change input" },
      { status: 400 },
    );
  }

  const secrets = resolveRunnerSecrets({
    prodAdminApiKey: body.prodAdminApiKey,
  });

  const summary = await runSpenderChangeTests(validation.input, secrets);
  return NextResponse.json(summary);
}
