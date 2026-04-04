import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoadCurrentUser,
  mockGetMySession,
  mockGetActiveJobForSession,
  mockCreateJob,
  mockCheckRateLimit,
  mockWriteAuditLog,
  mockMaybeSingle,
  mockLimit,
  mockIsDeleted,
  mockEqOrg,
  mockEqSession,
  mockSelect,
  mockFrom,
  mockCreateServiceClient,
} = vi.hoisted(() => ({
  mockLoadCurrentUser: vi.fn(),
  mockGetMySession: vi.fn(),
  mockGetActiveJobForSession: vi.fn(),
  mockCreateJob: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockLimit: vi.fn(() => ({
    maybeSingle: mockMaybeSingle,
  })),
  mockIsDeleted: vi.fn(() => ({
    limit: mockLimit,
  })),
  mockEqOrg: vi.fn(() => ({
    is: mockIsDeleted,
  })),
  mockEqSession: vi.fn(() => ({
    eq: mockEqOrg,
  })),
  mockSelect: vi.fn(() => ({
    eq: mockEqSession,
  })),
  mockFrom: vi.fn(() => ({
    select: mockSelect,
  })),
  mockCreateServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

vi.mock('../../lib/auth/loader', () => ({
  loadCurrentUser: mockLoadCurrentUser,
}))

vi.mock('../../lib/sessions/queries', () => ({
  getMySession: mockGetMySession,
}))

vi.mock('../../lib/jobs/queries', () => ({
  createJob: mockCreateJob,
  getActiveJobForSession: mockGetActiveJobForSession,
  getJobsForSession: vi.fn(),
  JOB_NOTE_TYPES: ['soap', 'dap', 'birp', 'girp', 'intake', 'progress'],
}))

vi.mock('../../lib/supabase/server', () => ({
  createServiceClient: mockCreateServiceClient,
}))

vi.mock('../../lib/rate-limit', () => ({
  apiLimit: null,
  getIdentifier: vi.fn(() => 'user:user-1'),
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('../../lib/audit', () => ({
  writeAuditLog: mockWriteAuditLog,
}))

import { POST } from '../../app/api/jobs/route'

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

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/jobs', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-vercel-id': 'test-request-id',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/jobs consent enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockLoadCurrentUser.mockResolvedValue(authenticatedResult)
    mockCheckRateLimit.mockResolvedValue(null)
    mockGetMySession.mockResolvedValue({
      data: { id: 'session-1' },
      error: null,
    })
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'consent-1' },
      error: null,
    })
    mockGetActiveJobForSession.mockResolvedValue({
      data: null,
      error: null,
    })
    mockCreateJob.mockResolvedValue({
      data: { id: 'job-1' },
      error: null,
    })
    mockWriteAuditLog.mockResolvedValue(undefined)
  })

  it('request with no consent row returns 403 with correct error message', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    })

    const response = await POST(
      makeRequest({ session_id: 'session-1', note_type: 'soap' }) as never,
    )
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toEqual({
      error: 'Patient consent must be recorded before starting a job',
    })
    expect(mockCreateJob).not.toHaveBeenCalled()
  })

  it('request with consent DB error returns 500', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'db failed' },
    })

    const response = await POST(
      makeRequest({ session_id: 'session-1', note_type: 'soap' }) as never,
    )
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({
      error: 'Failed to verify patient consent',
    })
    expect(mockCreateJob).not.toHaveBeenCalled()
  })

  it('request with valid consent row proceeds to job creation and returns 201', async () => {
    mockCreateJob.mockResolvedValue({
      data: { id: 'job-1', status: 'queued' },
      error: null,
    })

    const response = await POST(
      makeRequest({ session_id: 'session-1', note_type: 'soap' }) as never,
    )
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(payload).toEqual({
      job: {
        id: 'job-1',
        status: 'queued',
        errorCode: null,
        hasAudio: false,
        hasDraft: false,
        hasTranscript: false,
      },
    })
    expect(mockCreateJob).toHaveBeenCalledWith(authenticatedResult.user, {
      session_id: 'session-1',
      note_type: 'soap',
    })
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: 'org-1',
      actorId: 'user-1',
      sessionId: 'session-1',
      jobId: 'job-1',
      action: 'job.created',
      requestId: 'test-request-id',
      metadata: { note_type: 'soap' },
    })
  })

  it('request with no session_id returns 400', async () => {
    const response = await POST(
      makeRequest({ note_type: 'soap' }) as never,
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'session_id is required',
    })
    expect(mockGetMySession).not.toHaveBeenCalled()
  })

  it('request with invalid note_type returns 400', async () => {
    const response = await POST(
      makeRequest({ session_id: 'session-1', note_type: 'invalid' }) as never,
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'note_type must be one of: soap, dap, birp, girp, intake, progress',
    })
    expect(mockGetMySession).not.toHaveBeenCalled()
  })

  it('request with malformed JSON body returns 400 before consent check runs', async () => {
    const request = new Request('http://localhost:3000/api/jobs', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{',
    })

    const response = await POST(request as never)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'Invalid JSON body',
    })
    expect(mockGetMySession).not.toHaveBeenCalled()
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  it('request with no consent row for the authenticated org returns 403', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    })

    const response = await POST(
      makeRequest({ session_id: 'session-1', note_type: 'soap' }) as never,
    )
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toEqual({
      error: 'Patient consent must be recorded before starting a job',
    })
    expect(mockEqSession).toHaveBeenCalledWith('session_id', 'session-1')
    expect(mockEqOrg).toHaveBeenCalledWith('org_id', 'org-1')
  })

  it('request with no consent row for the requested session_id returns 403', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    })

    const response = await POST(
      makeRequest({ session_id: 'session-other', note_type: 'soap' }) as never,
    )
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toEqual({
      error: 'Patient consent must be recorded before starting a job',
    })
    expect(mockEqSession).toHaveBeenCalledWith('session_id', 'session-other')
    expect(mockEqOrg).toHaveBeenCalledWith('org_id', 'org-1')
  })

  it('unauthenticated request returns 401', async () => {
    mockLoadCurrentUser.mockResolvedValue({ status: 'no_session' })

    const response = await POST(
      makeRequest({ session_id: 'session-1', note_type: 'soap' }) as never,
    )
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({
      error: 'Unauthorized',
    })
  })

  it('active job conflict returns 409', async () => {
    mockGetActiveJobForSession.mockResolvedValue({
      data: { id: 'job-existing', status: 'running' },
      error: null,
    })

    const response = await POST(
      makeRequest({ session_id: 'session-1', note_type: 'soap' }) as never,
    )
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toEqual({
      error: {
        code: 'JOB_CREATE_FAILED',
        message: 'This session already has an active job. Wait for it to finish or cancel it first.',
      },
      job: {
        id: 'job-existing',
        status: 'running',
        errorCode: null,
        hasAudio: false,
        hasDraft: false,
        hasTranscript: false,
      },
    })
    expect(mockCreateJob).not.toHaveBeenCalled()
  })
})
