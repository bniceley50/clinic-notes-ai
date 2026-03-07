import "server-only";

import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  buildNoteHeaderLines,
  isAllCapsHeading,
  splitNoteContentLines,
  type NoteHeaderInput,
} from "./note-format";

export async function buildNoteDocxBuffer(
  input: NoteHeaderInput & { content: string },
): Promise<Buffer> {
  const headerParagraphs = buildNoteHeaderLines(input).map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line, bold: true })],
      }),
  );

  const contentParagraphs = splitNoteContentLines(input.content).map((line) => {
    if (!line.trim()) {
      return new Paragraph({ text: "" });
    }

    if (isAllCapsHeading(line)) {
      return new Paragraph({
        text: line.trim(),
        heading: HeadingLevel.HEADING_2,
      });
    }

    return new Paragraph({ text: line });
  });

  const document = new Document({
    sections: [
      {
        children: [
          ...headerParagraphs,
          new Paragraph({ text: "" }),
          ...contentParagraphs,
        ],
      },
    ],
  });

  return Packer.toBuffer(document);
}
