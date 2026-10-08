import { NextResponse } from "next/server";

import { getClient } from "@/lib/admin/clients";
import { toErrorResponse } from "@/lib/auth/account";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requirePlatformAdmin();
    const limit = checkRateLimit(
      `platform-admin:client:${ctx.email}`,
      RATE_LIMITS.platformAdminRead,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { id } = await context.params;
    if (!UUID.test(id)) {
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }

    const client = await getClient(id);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    return NextResponse.json({ client });
  } catch (err) {
    return toErrorResponse(err);
  }
}
