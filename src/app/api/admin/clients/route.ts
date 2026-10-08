import { NextResponse } from "next/server";

import { listClients } from "@/lib/admin/clients";
import { toErrorResponse } from "@/lib/auth/account";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

export async function GET() {
  try {
    const ctx = await requirePlatformAdmin();
    const limit = checkRateLimit(
      `platform-admin:clients:${ctx.email}`,
      RATE_LIMITS.platformAdminRead,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const directory = await listClients();
    return NextResponse.json(directory);
  } catch (err) {
    return toErrorResponse(err);
  }
}
