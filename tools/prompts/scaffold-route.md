# scaffold-route.md — New API Route Scaffolding

Use this when adding a new API route to Clinic Notes AI.
Generates a route that follows all established patterns from day one.

---

## Prompt

Scaffold a new API route for Clinic Notes AI following all established patterns.
Ask me questions before generating any code if requirements are unclear.

**Route spec:**
- Path: [e.g. /api/sessions/[id]/export]
- Method: [GET / POST / PATCH / DELETE]
- Auth required: [yes / no]
- Rate limited: [yes — specify req/min, or no]
- Purpose: [describe what this route does]
- Input: [describe request body or params]
- Output: [describe response shape]

**Required patterns to apply:**

1. Zod schema for all inputs — validate before any processing
2. `requireAuth()` call at top of handler if auth required
3. Rate limiting via Upstash Redis if applicable
4. Consistent error shape: `{ error: string }`
5. Typed response — no `any`
6. Try/catch with structured error logging: `{ route, user_id, error }`
7. Return 400 for validation failure, 401 for auth failure, 500 for unexpected

**Template structure:**
```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { rateLimit } from '@/lib/redis'

const InputSchema = z.object({
  // define inputs
})

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = InputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  try {
    // implementation
  } catch (err) {
    console.error({ route: '/api/[path]', user_id: user.id, error: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

After generating, output:
- The complete route file
- Any new types to add to `src/lib/types.ts`
- Any new DECISIONS.md entry needed
- EDIT_OK required before writing to disk
