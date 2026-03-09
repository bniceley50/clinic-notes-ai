# audit-write

Audit call patterns:

- Route success:
  `void writeAuditLog({ orgId, actorId, sessionId, jobId, action, requestId, metadata })`
- Upload success:
  include `metadata: { file_size_bytes: file.size }`
- Trigger success:
  audit after the fire-and-forget trigger request is queued
- Worker / processor:
  pass `actorId: job.created_by`
  use vendor tags like `openai` and `anthropic`
- Stub pipeline:
  mirror vendor audit events with `metadata: { stub: true }`
- Logout:
  if decoded session exists, audit `auth.logout` after revocation and before returning the redirect
- Never emit audit writes before the primary operation succeeds