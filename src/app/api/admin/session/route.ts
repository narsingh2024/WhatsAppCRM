import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/auth/account";
import {
  platformAdminConfigured,
  platformAdminCredentialsMatch,
  readPlatformAdminCreds,
} from "@/lib/auth/platform-admin";
import {
  attachPlatformAdminCookie,
  clearPlatformAdminCookie,
  hasPlatformAdminSession,
} from "@/lib/auth/platform-admin-session";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return "local";
}

/** Sidebar and the admin shell ask this. No CRM session required. */
export async function GET() {
  try {
    const platformAdmin = await hasPlatformAdminSession();
    return NextResponse.json({ platformAdmin });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const limit = checkRateLimit(
      `platform-admin:login:${clientIp(request)}`,
      RATE_LIMITS.platformAdminLogin,
    );
    if (!limit.success) return rateLimitResponse(limit);

    if (!platformAdminConfigured(readPlatformAdminCreds())) {
      return NextResponse.json(
        { error: "Platform admin is not configured" },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { email?: unknown; password?: unknown }
      | null;
    const email = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!platformAdminCredentialsMatch(email, password)) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });
    attachPlatformAdminCookie(response);
    return response;
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearPlatformAdminCookie(response);
  return response;
}
