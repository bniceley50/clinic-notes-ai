"use client";

type Props = {
  transcript: string;
};

export function TranscriptViewer({ transcript }: Props) {
  return (
    <section className="ql-panel">
      <div className="ql-copy-row">
        <div>
          <p className="ql-kicker">Transcript</p>
          <h2 className="ql-panel-title">Session Transcript</h2>
        </div>
      </div>

      <div className="ql-alert ql-alert-warning">
        AI-GENERATED - REVIEW REQUIRED. Transcript content is stub data for
        Milestone A testing only.
      </div>

      <pre
        className="ql-note-copy"
        style={{
          marginTop: 10,
          whiteSpace: "pre-wrap",
          fontFamily: "inherit",
        }}
      >
        {transcript}
      </pre>
    </section>
  );
}
