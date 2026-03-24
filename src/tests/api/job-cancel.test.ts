import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoadCurrentUser,
  mockGetMyJob,
  mockUpdateJobWorkerFields,
  mockCheckRateLimit,
  mockWriteAuditLog,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockGetMyJob: vi.fn(),
  mockUpdateJobWorkerFields: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWriteAuditLog: vi.fn(),
}))

vi.mock('../../lib/auth/loader', () => ({
  loadCurrentUser: mockLoadCurrentUser,
}))

vi.mock('../../lib/jobs/queries', () => ({
  getMyJob: mockGetMyJob,
  updateJobWorkerFields: mockUpdateJobWorkerFields,
}))

vi.mock('../../lib/rate-limit', () => ({
  apiLimit: null,
  getIdentifier: vi.fn(() => 'user:user-1'),
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('../../lib/audit', () => ({
  writeAuditLog: mockWriteAuditLog,
}))

import { POST } from '../../app/api/jobs/[id]/cancel/route'

const authenticatedResult = {
  status: 'authenticated' as const,
  user: {
    userId: 'user-1',
    orgId: 'org-1',
    role: 'provider',
    email: 'user@example.com',
    profile: {
      id: 'profile-1',
      user_id: 'user-1',
      org_id: 'org-1',
      display_name: 'User One',
      role: 'provider',
      created_at: '2026-03-09T10:00:00.000Z',
    },
    org: {
      id: 'org-1',
      name: 'Org One',
      created_at: '2026-03-09T10:00:00.000Z',
    },
  },
}

function makeRequest(): Request {
  return new Request('http://localhost:3000/api/jobs/job-1/cancel', {
    method: 'POST',
    headers: {
      'x-vercel-id': 'cancel-request-id',
    },
  })
}

describe('POST /api/jobs/[id]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadCurrentUser.mockResolvedValue(authenticatedResult)
    mockCheckRateLimit.mockResolvedValue(null)
    mockGetMyJob.mockResolvedValue({
      data: {
        id: 'job-1',
        session_id: 'session-1',
        status: 'running',
      },
      error: null,
    })
    mockUpdateJobWorkerFields.mockResolvedValue({
      data: { id: 'job-1', status: 'failed' },
      error: null,
    })
    mockWriteAuditLog.mockResolvedValue(undefined)
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockLoadCurrentUser.mockResolvedValue({ status: 'no_session' })

    const response = await POST(makeRequest() as never, {
      params: Promise.resolve({ id: 'job-1' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Unauthorized' })
  })

  it('returns 404 when the job is not owned by the authenticated user', async () => {
    mockGetMyJob.mockResolvedValue({
      data: null,
      error: 'not found',
    })

    const response = await POST(makeRequest() as never, {
      params: Promise.resolve({ id: 'job-1' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload).toEqual({ error: 'Job not found' })
    expect(mockUpdateJobWorkerFields).not.toHaveBeenCalled()
  })

  it('returns 409 when the job is already complete', async () => {
    mockGetMyJob.mockResolvedValue({
      data: {
        id: 'job-1',
        session_id: 'session-1',
        status: 'complete',
      },
      error: null,
    })

    const response = await POST(makeRequest() as never, {
      params: Promise.resolve({ id: 'job-1' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toEqual({
      error: 'Job cannot be cancelled in its current state',
    })
  })

  it('cancels an active job and writes an audit log', async () => {
    const response = await POST(makeRequest() as never, {
      params: Promise.resolve({ id: 'job-1' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      job: {
        id: 'job-1',
        status: 'failed',
      },
    })
    expect(mockUpdateJobWorkerFields).toHaveBeenCalledWith('job-1', {
      status: 'failed',
      stage: 'failed',
      error_message: 'Cancelled by user',
      claimed_at: null,
      lease_expires_at: null,
      run_token: null,
    })
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: 'org-1',
      actorId: 'user-1',
      sessionId: 'session-1',
      jobId: 'job-1',
      action: 'job.cancelled',
      requestId: 'cancel-request-id',
    })
  })
})