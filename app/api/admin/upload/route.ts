import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/guard";

/**
 * Token broker for admin image uploads.
 *
 * The browser sends the file straight to Vercel Blob, so uploads are not
 * limited by the 4.5 MB body cap on serverless functions. This route only
 * hands out a short-lived upload token, and only to a signed-in admin.
 */

export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
];

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Uploads are not configured. Create a Blob store in Vercel → Storage." },
      { status: 501 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Runs before every upload: no admin session, no token.
        const session = await getAdminSession();
        if (!session) throw new Error("Not signed in.");
        return {
          allowedContentTypes: ACCEPTED_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ by: session.sub }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log(`[upload] stored ${blob.pathname}`);
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * Lets the admin UI show whether uploading is available before offering it,
 * and — when it is not — which of the two setups is missing here.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ enabled: false, where: "signedOut" }, { status: 401 });
  return NextResponse.json({
    enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    where: process.env.VERCEL ? "deployed" : "local",
  });
}
