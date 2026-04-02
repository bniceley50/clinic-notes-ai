import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMyJob } from "@/lib/jobs/queries";
import { withLogging } from "@/lib/logger";
import { apiLimit, checkRateLimit, getIdentifier } from "@/lib/rate-limit";
import { getSignedAudioUrlForOrg } from "@/lib/storage/audio";

type RouteContext = { params: Promise<{ id: string }> };

function deriveDownloadName(storagePath: string): string {
  const fileName = storagePath.split("/").pop();
  return fileName && fileName.length > 0 ? fileName : "session-recording.webm";
}

export const GET = withLogging(
  async (request: NextRequest, ctx: RouteContext) => {
    const result = await loadCurrentUser();

    if (result.status !== "authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const identifier = getIdentifier(request, result.user.userId);
    const limited = await checkRateLimit(apiLimit, identifier);
    if (limited) return limited;

    const { id } = await ctx.params;
    const { data: job, error } = await getMyJob(result.user, id);

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.audio_storage_path) {
      return NextResponse.json({ error: "No audio file" }, { status: 404 });
    }

    try {
      const url = await getSignedAudioUrlForOrg(
        result.user.orgId,
        job.audio_storage_path,
      );
      return NextResponse.json({
        url,
        filename: deriveDownloadName(job.audio_storage_path),
      });
    } catch (signedUrlError) {
      return NextResponse.json(
        {
          error:
            signedUrlError instanceof Error
              ? signedUrlError.message
              : "Failed to generate audio URL",
        },
        { status: 500 },
      );
    }
  },
);
