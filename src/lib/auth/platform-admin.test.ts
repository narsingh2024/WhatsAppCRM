import { describe, expect, it } from "vitest";
import {
  platformAdminConfigured,
  platformAdminCredentialsMatch,
  readPlatformAdminCreds,
  signPlatformAdminToken,
  verifyPlatformAdminToken,
} from "./platform-admin";

const CREDS = { email: "admin@wacrm.local", password: "correct-horse" };

describe("readPlatformAdminCreds", () => {
  it("trims and lowercases the email", () => {
    expect(
      readPlatformAdminCreds({
        PLATFORM_ADMIN_EMAIL: "  Admin@Wacrm.Local ",
        PLATFORM_ADMIN_PASSWORD: "secret",
      }),
    ).toEqual({ email: "admin@wacrm.local", password: "secret" });
  });
});

describe("platformAdminConfigured", () => {
  it("requires both email and password", () => {
    expect(platformAdminConfigured({ email: "", password: "" })).toBe(false);
    expect(platformAdminConfigured({ email: "a@b.c", password: "" })).toBe(false);
    expect(platformAdminConfigured(CREDS)).toBe(true);
  });
});

describe("platformAdminCredentialsMatch", () => {
  it("accepts the env email and password, ignoring email case", () => {
    expect(
      platformAdminCredentialsMatch("  ADMIN@wacrm.local ", "correct-horse", CREDS),
    ).toBe(true);
  });

  it("rejects a client account and a wrong password", () => {
    expect(platformAdminCredentialsMatch("client@example.com", "correct-horse", CREDS)).toBe(
      false,
    );
    expect(platformAdminCredentialsMatch(CREDS.email, "wrong", CREDS)).toBe(false);
  });

  it("rejects everyone when credentials are unset", () => {
    expect(
      platformAdminCredentialsMatch(CREDS.email, CREDS.password, { email: "", password: "" }),
    ).toBe(false);
  });
});

describe("platform admin session token", () => {
  const now = 1_700_000_000_000;

  it("round-trips a token signed with the current credentials", () => {
    const token = signPlatformAdminToken(now, CREDS);
    expect(token).toBeTruthy();
    expect(verifyPlatformAdminToken(token, now + 1000, CREDS)).toBe(true);
  });

  it("rejects an expired token, a tampered token, and a different password", () => {
    const token = signPlatformAdminToken(now, CREDS)!;
    expect(verifyPlatformAdminToken(token, now + 13 * 60 * 60 * 1000, CREDS)).toBe(false);
    expect(verifyPlatformAdminToken(`${token}x`, now + 1000, CREDS)).toBe(false);
    expect(
      verifyPlatformAdminToken(token, now + 1000, { ...CREDS, password: "other" }),
    ).toBe(false);
  });
});
