import { UnauthorizedError } from "./account";
import { hasPlatformAdminSession, platformAdminEmail } from "./platform-admin-session";

export interface PlatformAdminContext {
  email: string;
}

/**
 * The caller must hold a valid platform-admin cookie from
 * POST /api/admin/login. A normal CRM session is not enough.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  if (!(await hasPlatformAdminSession())) {
    throw new UnauthorizedError();
  }
  return { email: platformAdminEmail() };
}
