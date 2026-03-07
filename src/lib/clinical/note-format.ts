export type NoteHeaderInput = {
  noteType: string;
  dateLabel: string;
  patientLabel: string;
  providerName: string;
};

export function getNoteTypeLabel(noteType: string): string {
  return noteType.toUpperCase();
}

export function buildNoteHeaderLines(input: NoteHeaderInput): string[] {
  return [
    `${getNoteTypeLabel(input.noteType)} — ${input.dateLabel}`,
    `PATIENT LABEL: ${input.patientLabel}`,
    `PROVIDER: ${input.providerName}`,
    "SOURCE: CLINIC NOTES AI | AI-GENERATED - REVIEW REQUIRED",
  ];
}

export function buildCareLogicCopyText(
  input: NoteHeaderInput & { content: string },
): string {
  return [...buildNoteHeaderLines(input), "", input.content.trim()].join("\n");
}

export function buildDocxFilename(
  sessionType: string,
  date: Date,
): string {
  const safeSessionType = sessionType.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const dateLabel = date.toISOString().slice(0, 10);
  return `clinic-notes-${safeSessionType}-${dateLabel}.docx`;
}

export function splitNoteContentLines(content: string): string[] {
  return content.split(/\r?\n/);
}

export function isAllCapsHeading(line: string): boolean {
  return /^[A-Z][A-Z\s/-]*:$/.test(line.trim());
}
