import { db } from "@/db";
import { socialAccounts } from "@/db/schema";
import { callbackUrl, googleCredentials } from "@/lib/google-auth";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin =
    request.headers.get("x-forwarded-proto")?.split(",")[0] ??
    new URL(request.url).protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0] ??
    request.headers.get("host") ??
    new URL(request.url).host;

  const { configured } = googleCredentials();
  const rows = await db
    .select({
      id: socialAccounts.id,
      provider: socialAccounts.provider,
      channelId: socialAccounts.channelId,
      channelTitle: socialAccounts.channelTitle,
      channelThumb: socialAccounts.channelThumb,
      scope: socialAccounts.scope,
      uploads: socialAccounts.uploads,
      lastError: socialAccounts.lastError,
      tokenExpiresAt: socialAccounts.tokenExpiresAt,
    })
    .from(socialAccounts)
    .orderBy(desc(socialAccounts.id));

  return Response.json({
    accounts: rows.map((r) => ({
      ...r,
      connected: r.tokenExpiresAt
        ? new Date(r.tokenExpiresAt).getTime() > Date.now()
        : true,
    })),
    setup: {
      configured,
      redirectUri: callbackUrl(`${origin}://${host}`),
      scope: "https://www.googleapis.com/auth/youtube.upload",
    },
  });
}
