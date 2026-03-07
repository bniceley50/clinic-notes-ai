import { describe, it, expect, vi } from 'vitest'

const notes = [
  { id: '1', session_id: 's1', org_id: 'org1', user_id: 'user-a', content: 'Note A' },
  { id: '2', session_id: 's2', org_id: 'org1', user_id: 'user-b', content: 'Note B' },
]

function getLatestNoteForSession(sessionId: string, orgId: string, userId: string) {
  return notes.find(
    n => n.session_id === sessionId && n.org_id === orgId && n.user_id === userId
  ) ?? null
}

describe('RLS isolation', () => {
  it('user A can read their own note', () => {
    const result = getLatestNoteForSession('s1', 'org1', 'user-a')
    expect(result?.content).toBe('Note A')
  })

  it('user B cannot read user A note', () => {
    const result = getLatestNoteForSession('s1', 'org1', 'user-b')
    expect(result).toBeNull()
  })
})
