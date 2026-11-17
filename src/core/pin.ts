// PIN hashing with PBKDF2 (Web Crypto), so the same code runs in the browser
// for offline sign-in and on the server for device registration.

const ITERATIONS = 120_000;

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function newSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(salt), iterations: ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  const candidate = await hashPin(pin, salt);
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}
