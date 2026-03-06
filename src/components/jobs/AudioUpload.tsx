export function AudioUpload() {
  return (
    <section className="ql-panel">
      <p className="ql-kicker">Audio Intake</p>
      <h2 className="ql-panel-title">Upload Recording</h2>
      <div className="ql-alert">
        DEMO/STUB. Upload processing is not wired yet in Milestone 0; this panel
        exists to match the compact enterprise workspace treatment.
      </div>
      <div className="ql-filter-row" style={{ marginTop: 12 }}>
        <div className="ql-field" style={{ minWidth: 240, flex: "1 1 240px" }}>
          <label className="ql-label" htmlFor="audio-file">
            Recording File
          </label>
          <input id="audio-file" type="file" className="ql-input" />
        </div>
        <button type="button" className="ql-button-secondary">
          Queue Upload
        </button>
      </div>
    </section>
  );
}
