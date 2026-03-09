# compliance-route

Use this pattern for PHI-touching API routes:

- `const result = await loadCurrentUser()`
- return `401` unless `result.status === "authenticated"`
- if the route starts work on a session job, verify a `session_consents` row exists for `session_id` + `org_id`
- perform the primary operation first
- after success, call `void writeAuditLog({...})`
- never block the main response on audit success