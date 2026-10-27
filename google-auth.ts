import crypto from "node:crypto";

export const YOUTUBE_UPLOAD_SCOPE =
  "https://www.googleapis.com/auth/youtube.upload";

/** The one and only permission this app ever asks for. */
export const OAUTH_SCOPES = [YOUTUBE_UPLOAD_SCOPE];

export const GOOGLE_AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";

export function googleCredentials() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ??
    process.env.YOUTUBE_CLIENT_ID ??
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ??
    process.env.YOUTUBE_CLIENT_SECRET;
  return {
    clientId: (clientId ?? "").trim(),
    clientSecret: (clientSecret ?? "").trim(),
    configured: Boolean((clientId ?? "").trim() && (clientSecret ?? "").trim()),
  };
}

export function callbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/auth/youtube/callback`;
}

/* ------------------------------------------------------------------ */
/* Token encryption at rest                                            */
/* ------------------------------------------------------------------ */

function key(): Buffer {
  const material =
    process.env.CREDENTIAL_ENC_KEY ??
    process.env.DATABASE_URL ??
    "shortslab-fallback-key";
  return crypto.createHash("sha256").update(material).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(
    ".",
  );
}

export function decryptSecret(payload: string): string {
  if (!payload) return "";
  try {
    const [ivB, tagB, dataB] = payload.split(".");
    if (!ivB || !tagB || !dataB) return "";
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(ivB, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

export function randomState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const { clientId, clientSecret } = googleCredentials();
  const res = await fetch(GOOGLE_TOKEN_URI, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as TokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    throw new Error(
      data.error_description || data.error || "Token exchange failed",
    );
  }
  return data;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const { clientId, clientSecret } = googleCredentials();
  const res = await fetch(GOOGLE_TOKEN_URI, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as TokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    throw new Error(
      data.error_description || data.error || "Token refresh failed",
    );
  }
  return data;
}

export function consentUrl(redirectUri: string, state: string): string {
  const { clientId } = googleCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: OAUTH_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "false",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URI}?${params.toString()}`;
}
