import { db } from "@/db";
import { socialAccounts } from "@/db/schema";
import {
  decryptSecret,
  encryptSecret,
  refreshAccessToken,
} from "@/lib/google-auth";
import { eq } from "drizzle-orm";

export type AccountRow = typeof socialAccounts.$inferSelect;

/** Returns a live access token, refreshing + persisting when needed. */
export async function getAccessToken(
  account: AccountRow,
): Promise<{ token: string; account: AccountRow }> {
  const expiresAt = account.tokenExpiresAt
    ? new Date(account.tokenExpiresAt).getTime()
    : 0;
  let current = account;

  if (expiresAt - 120_000 > Date.now()) {
    return { token: decryptSecret(account.accessTokenEnc), account: current };
  }

  const refreshToken = decryptSecret(account.refreshTokenEnc);
  if (!refreshToken) {
    throw new Error(
      "Access token expired aur refresh token available nahi. Channel ko reconnect karo.",
    );
  }

  const refreshed = await refreshAccessToken(refreshToken);
  const [updated] = await db
    .update(socialAccounts)
    .set({
      accessTokenEnc: encryptSecret(refreshed.access_token),
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      lastError: "",
      updatedAt: new Date(),
    })
    .where(eq(socialAccounts.id, account.id))
    .returning();

  return { token: refreshed.access_token, account: updated ?? current };
}

/**
 * Creates a resumable upload session with Google and returns the session URI.
 * We send metadata up-front so the upload finishes as a fully titled Short.
 */
export async function createUploadSession(opts: {
  accessToken: string;
  title: string;
  description: string;
  tags: string[];
  privacy: string;
  madeForKids: boolean;
  publishAt?: string | null;
  fileSize: number;
}): Promise<string> {
  const metadata: Record<string, unknown> = {
    snippet: {
      title: opts.title.slice(0, 100),
      description: opts.description.slice(0, 4900),
      tags: opts.tags.slice(0, 15),
      categoryId: "22", // People & Blogs (safe default for shorts)
    },
    status: {
      privacyStatus: opts.publishAt ? "private" : opts.privacy,
      selfDeclaredMadeForKids: opts.madeForKids,
      ...(opts.publishAt ? { publishAt: opts.publishAt } : {}),
    },
  };

  const res = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${opts.accessToken}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-length": String(opts.fileSize),
        "x-upload-content-type": "video/mp4",
      },
      body: JSON.stringify(metadata),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Upload session fail (${res.status}): ${text.slice(0, 400) || "no body"}`,
    );
  }

  const uri = res.headers.get("location");
  if (!uri) throw new Error("Google ne session URI nahi bheja.");
  return uri;
}

export type ChunkResult = {
  done: boolean;
  uploaded: number;
  videoId?: string;
  videoUrl?: string;
};

/** PUTs one chunk (8 MiB) to the resumable session. */
export async function uploadChunk(opts: {
  sessionUri: string;
  chunk: ArrayBuffer;
  offset: number;
  total: number;
}): Promise<ChunkResult> {
  const { sessionUri, chunk, offset, total } = opts;
  const last = offset + chunk.byteLength >= total;

  const res = await fetch(sessionUri, {
    method: "PUT",
    headers: {
      "content-length": String(chunk.byteLength),
      // A plain 0-total range lets a small file go in a single request.
      ...(offset === 0 && last
        ? {}
        : { "content-range": `bytes ${offset}-${offset + chunk.byteLength - 1}/${total}` }),
    },
    body: chunk,
    cache: "no-store",
  });

  if (res.status === 308) {
    const range = res.headers.get("range"); // bytes=0-N
    const uploaded = range
      ? Number(range.split("-")[1]) + 1
      : offset + chunk.byteLength;
    return { done: false, uploaded };
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chunk upload fail (${res.status}): ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Upload complete but video id missing.");
  return {
    done: true,
    uploaded: total,
    videoId: data.id,
    videoUrl: `https://www.youtube.com/shorts/${data.id}`,
  };
}

/** Ask Google how much it already has (used to resume / verify). */
export async function querySession(
  sessionUri: string,
  total: number,
): Promise<number> {
  const res = await fetch(sessionUri, {
    method: "PUT",
    headers: {
      "content-length": "0",
      "content-range": `bytes */${total}`,
    },
    cache: "no-store",
  });
  if (res.status === 308) {
    const range = res.headers.get("range");
    return range ? Number(range.split("-")[1]) + 1 : 0;
  }
  return total;
}
