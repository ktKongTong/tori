const ADMIN_SESSION_COOKIE = "tp_admin_session";
const ADMIN_SESSION_TTL_SEC = 60 * 60 * 12;

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createAdminSessionCookieValue(secret: string, adminKey: string) {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SEC;
  const sig = await hmacSha256(secret, `${exp}:${adminKey}`);
  return `${exp}.${sig}`;
}

export async function verifyAdminSessionCookieValue(
  secret: string,
  adminKey: string,
  cookieValue?: string | null,
) {
  if (!cookieValue) return false;
  const [expRaw, sig] = cookieValue.split(".");
  const exp = Number.parseInt(expRaw ?? "", 10);
  if (!Number.isFinite(exp) || !sig) return false;
  if (exp <= Math.floor(Date.now() / 1000)) return false;
  const expectedSig = await hmacSha256(secret, `${exp}:${adminKey}`);
  return expectedSig === sig;
}

export { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SEC };
