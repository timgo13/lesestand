import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isIncomingPath } from "@/lib/ids";
import { publicError } from "@/lib/errors";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 40 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const denied = await requireUser();
  if (denied) return denied;

  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!isIncomingPath(pathname)) throw new Error("Ungültiger Dateiname");
        return {
          allowedContentTypes: ["text/html", "application/xhtml+xml", "text/plain", "application/octet-stream"],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: publicError(error, "Upload abgelehnt") }, { status: 400 });
  }
}
