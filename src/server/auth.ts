import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Db } from "@/core/db.ts";

const COOKIE = "bms_device";
const ONE_YEAR = 60 * 60 * 24 * 365;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value === "change-me") {
    if (process.env.NODE_ENV === "production") throw new Error("Set AUTH_SECRET before running in production.");
    return new TextEncoder().encode("dev-only-secret-not-for-production-use");
  }
  return new TextEncoder().encode(value);
}

/** Devices (the shop phone, tablet or PC) hold a long-lived signed token; people sign in on the device with their PIN. */
export async function issueDeviceToken(deviceId: string): Promise<void> {
  const token = await new SignJWT({ device: deviceId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ONE_YEAR}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function currentDevice(db: Db): Promise<{ id: string; code: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const device = await db.get<{ id: string; code: string; revoked_at: string | null }>(
      "SELECT id, code, revoked_at FROM devices WHERE id = ?",
      [payload.device],
    );
    if (!device || device.revoked_at) return null;
    return { id: device.id, code: device.code };
  } catch {
    return null;
  }
}

// Simple in-memory brake on PIN guessing against the server.
const attempts = new Map<string, { count: number; until: number }>();

export function tooManyAttempts(key: string): boolean {
  const a = attempts.get(key);
  return !!a && a.count >= 5 && a.until > Date.now();
}

export function recordAttempt(key: string, ok: boolean): void {
  if (ok) {
    attempts.delete(key);
    return;
  }
  const a = attempts.get(key);
  const count = a && a.until > Date.now() ? a.count + 1 : 1;
  attempts.set(key, { count, until: Date.now() + 5 * 60_000 });
}
