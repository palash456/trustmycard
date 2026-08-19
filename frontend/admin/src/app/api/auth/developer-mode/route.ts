import { NextRequest, NextResponse } from "next/server";
import {
  type AdminProtectedSection,
  ADMIN_PROTECTED_SECTIONS,
  getAdminProtectedSectionPasswordEnv,
} from "@/lib/developer-mode";

function isAdminProtectedSection(value: unknown): value is AdminProtectedSection {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ADMIN_PROTECTED_SECTIONS, value)
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    password?: string;
    section?: string;
  };
  const password = String(body.password ?? "").trim();
  const section = body.section;

  if (!isAdminProtectedSection(section)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }

  const envKey = getAdminProtectedSectionPasswordEnv(section);
  const expected = process.env[envKey]?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: `${envKey} is not configured` },
      { status: 500 },
    );
  }

  if (password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
