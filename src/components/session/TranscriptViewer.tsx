"use client";

type Props = {
  transcript: string;
};

export function TranscriptViewer({ transcript }: Props) {
  return (
    <section className="ql-panel" data-testid="session-transcript">
      <div className="ql-copy-row">
        <div>
          <p className="ql-kicker">Transcript</p>
          <h2 className="ql-panel-title">Session Transcript</h2>
        </div>
      </div>

      <div className="ql-alert ql-alert-warning">
        AI-generated transcript. Review for accuracy before clinical use.
      </div>

      <pre
        className="ql-note-copy mt-[10px] whitespace-pre-wrap [font-family:inherit]"
        data-testid="session-transcript-content"
      >
        {transcript}
      </pre>
    </section>
  );
}
