import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetJobById,
  mockUpdateJobWorkerFields,
  mockDownloadAudioForJob,
  mockUploadTranscript,
  mockTranscribeAudioChunked,
  mockGenerateNote,
  mockUpsertTranscriptForJob,
  mockUpsertNoteForJob,
  mockWriteAuditLog,
  mockInsert,
  mockMaybeSingle,
  mockEqOrgId,
  mockEqSessionId,
  mockEqJobId,
  mockSelect,
  mockFrom,
  mockCreateServiceClient,
} = vi.hoisted(() => ({
  mockGetJobById: vi.fn(),
  mockUpdateJobWorkerFields: vi.fn(),
  mockDownloadAudioForJob: vi.fn(),
  mockUploadTranscript: vi.fn(),
  mockTranscribeAudioChunked: vi.fn(),
  mockGenerateNote: vi.fn(),
  mockUpsertTranscriptForJob: vi.fn(),
  mockUpsertNoteForJob: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockInsert: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockEqOrgId: vi.fn(() => ({
    maybeSingle: mockMaybeSingle,
  })),
  mockEqSessionId: vi.fn(() => ({
    eq: mockEqOrgId,
  })),
  mockEqJobId: vi.fn(() => ({
    eq: mockEqSessionId,
  })),
  mockSelect: vi.fn(() => ({
    eq: mockEqJobId,
  })),
  mockFrom: vi.fn((table?: string) => {
    if (table === 'transcripts') {
      return { select: mockSelect }
    }
    return { insert: mockInsert }
  }),
  mockCreateServiceClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

vi.mock('../../lib/jobs/queries', () => ({
  getJobById: mockGetJobById,
  updateJobWorkerFields: mockUpdateJobWorkerFields,
}))

vi.mock('../../lib/storage/audio-download', () => ({
  downloadAudioForJob: mockDownloadAudioForJob,
}))

vi.mock('../../lib/storage/transcript', () => ({
  uploadTranscript: mockUploadTranscript,
}))

vi.mock('../../lib/ai/whisper', () => ({
  transcribeAudioChunked: mockTranscribeAudioChunked,
}))

vi.mock('../../lib/ai/claude', () => ({
  generateNote: mockGenerateNote,
}))

vi.mock('../../lib/clinical/queries', () => ({
  upsertTranscriptForJob: mockUpsertTranscriptForJob,
  upsertNoteForJob: mockUpsertNoteForJob,
}))

vi.mock('../../lib/supabase/server', () => ({
  createServiceClient: mockCreateServiceClient,
}))

vi.mock('../../lib/audit', () => ({
  writeAuditLog: mockWriteAuditLog,
}))

import { generateNoteForJob, processJob } from '../../lib/jobs/processor'

const baseJob = {
  id: 'job-1',
  session_id: 'session-1',
  org_id: 'org-1',
  created_by: 'user-1',
  status: 'queued',
  progress: 0,
  stage: 'queued',
  note_type: 'soap',
  attempt_count: 0,
  error_message: null,
  audio_storage_path: 'audio/org-1/session-1/job-1/recording.webm',
  transcript_storage_path: null,
  draft_storage_path: null,
  created_at: '2026-03-09T10:00:00.000Z',
  updated_at: '2026-03-09T10:00:00.000Z',
}

describe('job state machine', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFrom.mockImplementation((table?: string) => {
      if (table === 'transcripts') {
        return { select: mockSelect }
      }
      return { insert: mockInsert }
    })

    mockCreateServiceClient.mockReturnValue({
      from: mockFrom,
    })

    mockInsert.mockResolvedValue({ error: null })

    mockUploadTranscript.mockResolvedValue({
      storagePath: 'transcripts/org-1/session-1/job-1/transcript.txt',
      error: null,
    })

    mockUpsertTranscriptForJob.mockResolvedValue({
      data: { id: 'transcript-1' },
      error: null,
    })

    mockUpsertNoteForJob.mockResolvedValue({
      data: { id: 'note-1' },
      error: null,
    })

    mockMaybeSingle.mockResolvedValue({
      data: { content: 'Patient discussed treatment goals.' },
      error: null,
    })

    mockDownloadAudioForJob.mockResolvedValue({
      data: Buffer.from('audio-bytes'),
      error: null,
    })

    mockTranscribeAudioChunked.mockResolvedValue({
      text: 'Patient discussed treatment goals.',
      error: null,
    })

    mockGenerateNote.mockResolvedValue({
      content: 'Generated SOAP note',
      error: null,
    })

    mockWriteAuditLog.mockResolvedValue(undefined)
  })

  it('a queued job with audio completes after transcription without creating a note row', async () => {
    mockGetJobById.mockResolvedValue(baseJob)
    mockUpdateJobWorkerFields
      .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })

    const result = await processJob('job-1')

    expect(result).toEqual({ success: true, error: null })
    expect(mockDownloadAudioForJob).toHaveBeenCalledWith(baseJob.audio_storage_path)
    expect(mockTranscribeAudioChunked).toHaveBeenCalledWith(
      Buffer.from('audio-bytes'),
      'recording.webm',
      expect.any(Function),
    )
    expect(mockUpsertTranscriptForJob).toHaveBeenCalledWith({
      sessionId: 'session-1',
      orgId: 'org-1',
      jobId: 'job-1',
      content: 'Patient discussed treatment goals.',
      durationSeconds: 0,
      wordCount: 4,
    })
    expect(mockGenerateNote).not.toHaveBeenCalled()
    expect(mockUpsertNoteForJob).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockWriteAuditLog).toHaveBeenCalledWith({
      orgId: 'org-1',
      actorId: 'user-1',
      sessionId: 'session-1',
      jobId: 'job-1',
      action: 'audio.sent_to_vendor',
      vendor: 'openai',
    })
    expect(mockWriteAuditLog).not.toHaveBeenCalledWith({
      orgId: 'org-1',
      actorId: 'user-1',
      sessionId: 'session-1',
      jobId: 'job-1',
      action: 'transcript.sent_to_vendor',
      vendor: 'anthropic',
    })
    expect(mockUpdateJobWorkerFields).toHaveBeenNthCalledWith(1, 'job-1', {
      status: 'running',
      stage: 'transcribing',
      progress: 10,
      error_message: null,
    })
    expect(mockUpdateJobWorkerFields).toHaveBeenLastCalledWith('job-1', {
      status: 'complete',
      stage: 'complete',
      progress: 100,
      transcript_storage_path: 'transcripts/org-1/session-1/job-1/transcript.txt',
    })
  })

  it('generateNoteForJob remains callable independently after transcription', async () => {
    mockGetJobById.mockResolvedValue({
      ...baseJob,
      status: 'complete',
      transcript_storage_path: 'transcripts/org-1/session-1/job-1/transcript.txt',
    })

    const result = await generateNoteForJob('job-1')

    expect(result).toEqual({ success: true, error: null })
    expect(mockSelect).toHaveBeenCalledWith('content')
    expect(mockGenerateNote).toHaveBeenCalledWith({
      transcript: 'Patient discussed treatment goals.',
      noteType: 'soap',
    })
    expect(mockUpsertNoteForJob).toHaveBeenCalledWith({
      sessionId: 'session-1',
      orgId: 'org-1',
      jobId: 'job-1',
      createdBy: 'user-1',
      noteType: 'soap',
      content: 'Generated SOAP note',
    })
  })

  it('a job without audio_storage_path returns error "No audio uploaded" and does not transition to running', async () => {
    mockGetJobById.mockResolvedValue({
      ...baseJob,
      audio_storage_path: null,
    })

    const result = await processJob('job-1')

    expect(result).toEqual({ success: false, error: 'No audio uploaded' })
    expect(mockUpdateJobWorkerFields).not.toHaveBeenCalled()
    expect(mockTranscribeAudioChunked).not.toHaveBeenCalled()
  })

  it('a job in complete status cannot be re-processed', async () => {
    mockGetJobById.mockResolvedValue({
      ...baseJob,
      status: 'complete',
    })

    const result = await processJob('job-1')

    expect(result).toEqual({ success: false, error: 'Job not in queued state' })
    expect(mockUpdateJobWorkerFields).not.toHaveBeenCalled()
  })

  it('a job in failed status cannot be re-processed', async () => {
    mockGetJobById.mockResolvedValue({
      ...baseJob,
      status: 'failed',
    })

    const result = await processJob('job-1')

    expect(result).toEqual({ success: false, error: 'Job not in queued state' })
    expect(mockUpdateJobWorkerFields).not.toHaveBeenCalled()
  })

  it('a job in running status cannot be re-processed', async () => {
    mockGetJobById.mockResolvedValue({
      ...baseJob,
      status: 'running',
    })

    const result = await processJob('job-1')

    expect(result).toEqual({ success: false, error: 'Job not in queued state' })
    expect(mockUpdateJobWorkerFields).not.toHaveBeenCalled()
  })

  it('failJob behavior sets status=failed, stage=failed, and error_message', async () => {
    mockGetJobById.mockResolvedValue(baseJob)
    mockUpdateJobWorkerFields
      .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    mockDownloadAudioForJob.mockResolvedValue({
      data: null,
      error: 'Failed to download audio',
    })

    const result = await processJob('job-1')

    expect(result).toEqual({ success: false, error: 'Failed to download audio' })
    expect(mockUpdateJobWorkerFields).toHaveBeenNthCalledWith(2, 'job-1', {
      status: 'failed',
      stage: 'failed',
      error_message: 'Failed to download audio',
    })
  })

  it('updateJobWorkerFields failure during start causes failJob behavior to run', async () => {
    mockGetJobById.mockResolvedValue(baseJob)
    mockUpdateJobWorkerFields
      .mockResolvedValueOnce({ data: null, error: 'Failed to start job' })
      .mockResolvedValueOnce({ data: null, error: null })

    const result = await processJob('job-1')

    expect(result).toEqual({ success: false, error: 'Failed to start job' })
    expect(mockUpdateJobWorkerFields).toHaveBeenNthCalledWith(1, 'job-1', {
      status: 'running',
      stage: 'transcribing',
      progress: 10,
      error_message: null,
    })
    expect(mockUpdateJobWorkerFields).toHaveBeenNthCalledWith(2, 'job-1', {
      status: 'failed',
      stage: 'failed',
      error_message: 'Failed to start job',
    })
  })
})
