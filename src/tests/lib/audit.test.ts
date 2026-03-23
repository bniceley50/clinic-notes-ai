import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockInsert,
  mockFrom,
  mockCreateServiceClient,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockFrom: vi.fn(() => ({
    insert: mockInsert,
  })),
  mockCreateServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

const mockConsoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined)

vi.mock('../../lib/supabase/server', () => ({
  createServiceClient: mockCreateServiceClient,
}))

import { writeAuditLog } from '../../lib/audit'

describe('writeAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      insert: mockInsert,
    })
    mockCreateServiceClient.mockReturnValue({
      from: mockFrom,
    })
    mockInsert.mockResolvedValue({ error: null })
  })

  it('returns void and does not throw when Supabase insert succeeds', async () => {
    await expect(
      writeAuditLog({
        orgId: 'org-1',
        actorId: 'user-1',
        action: 'job.created',
        jobId: 'job-1',
      }),
    ).resolves.toBeUndefined()

    expect(mockInsert).toHaveBeenCalledTimes(1)
  })

  it('returns void and does not throw when Supabase insert fails with error', async () => {
    mockInsert.mockResolvedValue({
      error: { message: 'insert failed' },
    })

    await expect(
      writeAuditLog({
        orgId: 'org-1',
        actorId: 'user-1',
        action: 'job.created',
        jobId: 'job-1',
      }),
    ).resolves.toBeUndefined()

    expect(mockConsoleError).toHaveBeenCalledWith(
      '[audit] write failed for action:',
      'job.created',
      'error:',
      'insert failed',
    )
  })

  it('returns void and does not throw when Supabase throws an exception', async () => {
    mockInsert.mockRejectedValue(new Error('boom'))

    await expect(
      writeAuditLog({
        orgId: 'org-1',
        actorId: 'user-1',
        action: 'job.created',
        jobId: 'job-1',
      }),
    ).resolves.toBeUndefined()

    expect(mockConsoleError).toHaveBeenCalledWith(
      '[audit] write failed for action:',
      'job.created',
    )
  })

  it('returns immediately and does not throw when actorId is undefined', async () => {
    await expect(
      writeAuditLog({
        orgId: 'org-1',
        action: 'job.created',
        jobId: 'job-1',
      }),
    ).resolves.toBeUndefined()

    expect(mockCreateServiceClient).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('correctly maps jobId to entity_type "job"', async () => {
    await writeAuditLog({
      orgId: 'org-1',
      actorId: 'user-1',
      action: 'job.created',
      jobId: 'job-1',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'job',
        entity_id: 'job-1',
      }),
    )
  })

  it('correctly maps sessionId without jobId to entity_type "session"', async () => {
    await writeAuditLog({
      orgId: 'org-1',
      actorId: 'user-1',
      action: 'session.viewed',
      sessionId: 'session-1',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'session',
        entity_id: 'session-1',
      }),
    )
  })

  it('correctly maps auth.logout action to entity_type "auth"', async () => {
    await writeAuditLog({
      orgId: 'org-1',
      actorId: 'user-1',
      action: 'auth.logout',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'auth',
        entity_id: null,
      }),
    )
  })

  it('correctly maps consent.recorded action to entity_type "consent"', async () => {
    await writeAuditLog({
      orgId: 'org-1',
      actorId: 'user-1',
      action: 'consent.recorded',
      sessionId: 'session-1',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'consent',
        entity_id: 'session-1',
      }),
    )
  })

  it('vendor field is passed through correctly when provided', async () => {
    await writeAuditLog({
      orgId: 'org-1',
      actorId: 'user-1',
      action: 'audio.sent_to_vendor',
      jobId: 'job-1',
      vendor: 'openai',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        vendor: 'openai',
      }),
    )
  })

  it('metadata is merged correctly including session_id and job_id', async () => {
    await writeAuditLog({
      orgId: 'org-1',
      actorId: 'user-1',
      action: 'job.created',
      sessionId: 'session-1',
      jobId: 'job-1',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      metadata: {
        note_type: 'soap',
        stub: true,
      },
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          note_type: 'soap',
          stub: true,
          session_id: 'session-1',
          job_id: 'job-1',
          ip_address: '127.0.0.1',
          user_agent: 'vitest',
          success: true,
        },
      }),
    )
  })
})
