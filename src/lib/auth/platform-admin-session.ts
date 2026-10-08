import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  readPlatformAdminCreds,
  signPlatformAdminToken,
  verifyPlatformAdminToken,
} from "./platform-admin";

export const PLATFORM_ADMIN_COOKIE = "wacrm_platform_admin";

const MAX_AGE_SECONDS = 12 * 60 * 60;

export async function hasPlatformAdminSession(): Promise<boolean> {
  const jar = await cookies();
  return verifyPlatformAdminToken(jar.get(PLATFORM_ADMIN_COOKIE)?.value);
}

export function attachPlatformAdminCookie(response: NextResponse): void {
  const token = signPlatformAdminToken();
  if (!token) return;
  response.cookies.set(PLATFORM_ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearPlatformAdminCookie(response: NextResponse): void {
  response.cookies.set(PLATFORM_ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function platformAdminEmail(): string {
  return readPlatformAdminCreds().email;
}
