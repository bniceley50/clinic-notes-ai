# Lessons Log
_Updated by agent after each user correction. Read at session start._

---
### 2026-03-07 — buildStubNote failed on uppercase note types
**Pattern:** resolveSupportedNoteType() matched against lowercase keys 
but callers passed uppercase ('DAP', 'SOAP'). Silent fallback to soap template.
**Rule:** Always normalize string inputs to lowercase at the boundary 
of any key lookup. Never assume call-site casing.
