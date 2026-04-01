"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deriveJobState,
  isJobActive,
} from "@/lib/models/job-lifecycle";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { CreateJobForm } from "@/components/jobs/CreateJobForm";
import {
  JobStatusPanel,
  type JobSnapshot,
} from "@/components/jobs/JobStatusPanel";
import type { ConsentStatus } from "@/lib/models/consent";

type Props = {
  sessionId: string;
  initialJobs: JobSnapshot[];
  completedAudioJobs: JobSnapshot[];
  consentStatus: ConsentStatus;
};

function hasActiveJob(jobs: JobSnapshot[]): boolean {
  return jobs.some((job) => isJobActive(deriveJobState(job)));
}

export function SessionJobsClientSection({
  sessionId,
  initialJobs,
  completedAudioJobs,
  consentStatus,
}: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobSnapshot[]>(initialJobs);

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  const handleJobStarted = useCallback((job: JobSnapshot) => {
    setJobs((currentJobs) => [job, ...currentJobs.filter((currentJob) => currentJob.id !== job.id)]);
  }, []);

  const handleJobComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleJobCancelled = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <>
      <div className="card-ql overflow-hidden">
        <div
          className="border-b px-3 py-2 text-xs font-bold uppercase tracking-wider"
          style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC", color: "#517AB7" }}
        >
          Session Capture
        </div>
        <div className="p-3">
          <p className="mb-3 text-xs text-text-muted">
            Record or upload session audio to create a reviewable transcript.
          </p>
          <CreateJobForm
            sessionId={sessionId}
            hasActiveJob={hasActiveJob(jobs)}
            consentStatus={consentStatus}
            onJobStarted={handleJobStarted}
          />
        </div>
      </div>

      <div className="card-ql overflow-hidden">
        <div
          className="border-b px-3 py-2 text-xs font-bold uppercase tracking-wider"
          style={{ backgroundColor: "#F9F9F9", borderColor: "#E7E9EC", color: "#517AB7" }}
        >
          Job History
        </div>
        <div className="space-y-3 p-3">
          <JobStatusPanel
            initialJobs={jobs}
            onJobComplete={handleJobComplete}
            onJobCancelled={handleJobCancelled}
          />
          {completedAudioJobs.length > 0 ? (
            <div className="space-y-3 border-t pt-3 border-border-subtle">
              {completedAudioJobs.map((job) => (
                <div
                  key={job.id}
                  className="space-y-2 rounded border p-3 border-border-subtle"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className="text-xs font-semibold uppercase tracking-wide text-primary"
                      >
                        Recorded audio
                      </p>
                      <p className="text-xs text-text-muted">
                        {new Date(job.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="inline-block rounded-[2px] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide chip-complete">
                      {job.status}
                    </span>
                  </div>
                  <AudioPlayer jobId={job.id} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
