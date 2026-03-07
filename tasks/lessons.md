# Lessons Log
_Updated by agent after each user correction. Read at session start._

---
### 2026-03-07 — buildStubNote failed on uppercase note types
**Pattern:** resolveSupportedNoteType() matched against lowercase keys 
but callers passed uppercase ('DAP', 'SOAP'). Silent fallback to soap template.
**Rule:** Always normalize string inputs to lowercase at the boundary 
of any key lookup. Never assume call-site casing.
### 2026-03-07 — buildStubNote interface changed, tests written against old signature
**Pattern:** Unit tests written against stub function before reading its 
current type signature. Tests used string arg; function expected TranscriptSeed object.
**Rule:** Always read the current function signature before writing tests 
against it. Never assume a stub interface matches its original spec.
