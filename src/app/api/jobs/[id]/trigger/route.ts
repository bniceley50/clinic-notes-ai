import { NextResponse, type NextRequest } from "next/server";
import { loadCurrentUser } from "@/lib/auth/loader";
import { getMyJob } from "@/lib/jobs/queries";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, ctx: RouteContext) {
  const result = await loadCurrentUser();

  if (result.status !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await ctx.params;
  const { data: job, error } = await getMyJob(result.user, jobId);

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const processUrl = `${baseUrl}/api/jobs/${jobId}/process`;

  void fetch(processUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.JOBS_RUNNER_TOKEN}`,
    },
  }).catch(() => {
    // Trigger failures are intentionally non-blocking for the client.
  });

  return NextResponse.json({ job_id: jobId, status: "processing" }, { status: 202 });
}
