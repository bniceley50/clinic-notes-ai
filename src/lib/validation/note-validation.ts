// src/lib/validation/note-schemas.ts
// Zod schemas for all note generation API routes

import { z } from "zod";

// â”€â”€â”€ Shared primitives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NoteFormatSchema = z.enum(["SOAP", "DAP", "BIRP", "GIRP"], {
  error: "Format must be SOAP, DAP, BIRP, or GIRP",
});

const SessionDurationSchema = z
  .number()
  .int()
  .min(1, "Session must be at least 1 minute")
  .max(480, "Session cannot exceed 8 hours");

const ClientAgeSchema = z
  .number()
  .int()
  .min(0, "Age cannot be negative")
  .max(120, "Age out of range")
  .optional();

const SafeSummarySchema = z
  .string()
  .min(10, "Summary too short to generate a useful note")
  .max(5000, "Summary exceeds maximum length")
  .trim()
  .transform((val) => val.replace(/<[^>]*>/g, ""))
  .refine((val) => !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(val), {
    message: "Summary contains invalid characters",
  });

// â”€â”€â”€ Generate Note â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const GenerateNoteSchema = z.object({
  format: NoteFormatSchema,
  sessionSummary: SafeSummarySchema,
  sessionDurationMinutes: SessionDurationSchema,
  clientAge: ClientAgeSchema,
  presentingConcerns: z
    .string()
    .max(1000, "Presenting concerns too long")
    .optional()
    .transform((val) => val?.replace(/<[^>]*>/g, "")),
  interventionsUsed: z
    .array(z.string().max(100))
    .max(20, "Too many interventions listed")
    .optional(),
  clinicianId: z.string().uuid("Invalid clinician ID"),
  clientId: z.string().uuid("Invalid client ID"),
});

export type GenerateNoteInput = z.infer<typeof GenerateNoteSchema>;

// â”€â”€â”€ Save Note â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const SaveNoteSchema = z.object({
  noteContent: z
    .string()
    .min(1, "Note content cannot be empty")
    .max(20000, "Note content exceeds maximum length")
    .trim(),
  format: NoteFormatSchema,
  clientId: z.string().uuid("Invalid client ID"),
  sessionDate: z
    .string()
    .datetime({ message: "sessionDate must be ISO 8601" })
    .refine(
      (val) => new Date(val) <= new Date(),
      "Session date cannot be in the future"
    ),
  isFinalized: z.boolean().default(false),
});

export type SaveNoteInput = z.infer<typeof SaveNoteSchema>;

// â”€â”€â”€ Update Note â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const UpdateNoteSchema = z.object({
  noteContent: z.string().min(1).max(20000).trim().optional(),
  isFinalized: z.boolean().optional(),
  sessionDate: z
    .string()
    .datetime()
    .refine(
      (val) => new Date(val) <= new Date(),
      "Session date cannot be in the future"
    )
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  "At least one field must be provided to update"
);

export type UpdateNoteInput = z.infer<typeof UpdateNoteSchema>;

// â”€â”€â”€ Note ID param â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const NoteIdParamSchema = z.object({
  id: z.string().uuid("Note ID must be a valid UUID"),
});

// â”€â”€â”€ List Notes query â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const ListNotesQuerySchema = z.object({
  clientId: z.string().uuid("Invalid client ID").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  format: NoteFormatSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: "startDate must be before endDate", path: ["startDate"] }
);

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function validateBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new Response(
      JSON.stringify({ error: "Invalid JSON in request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Response(
      JSON.stringify({
        error: "Validation failed",
        issues: result.error.flatten().fieldErrors,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  return result.data;
}

export function validateQuery<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): z.infer<T> {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Response(
      JSON.stringify({
        error: "Invalid query parameters",
        issues: result.error.flatten().fieldErrors,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  return result.data;
}