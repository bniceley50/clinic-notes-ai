import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetJobById,
  mockUpdateJobWorkerFields,
  mockDownloadAudioForJob,
  mockUploadTranscript,
  mockTranscribeAudio,
  mockGenerateNote,
  mockUpsertTranscriptForJob,
  mockWriteAuditLog,
  mockInsert,
  mockFrom,
  mockCreateServiceClient,
} = vi.hoisted(() => ({
  mockGetJobById: vi.fn(),
  mockUpdateJobWorkerFields: vi.fn(),
  mockDownloadAudioForJob: vi.fn(),
  mockUploadTranscript: vi.fn(),
  mockTranscribeAudio: vi.fn(),
  mockGenerateNote: vi.fn(),
  mockUpsertTranscriptForJob: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockInsert: vi.fn(),
  mockFrom: vi.fn(() => ({
    insert: mockInsert,
  })),
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
  transcribeAudio: mockTranscribeAudio,
}))

vi.mock('../../lib/ai/claude', () => ({
  generateNote: mockGenerateNote,
}))

vi.mock('../../lib/clinical/queries', () => ({
  upsertTranscriptForJob: mockUpsertTranscriptForJob,
}))

vi.mock('../../lib/supabase/server', () => ({
  createServiceClient: mockCreateServiceClient,
}))

vi.mock('../../lib/audit', () => ({
  writeAuditLog: mockWriteAuditLog,
}))

import { processJob } from '../../lib/jobs/processor'

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

    mockFrom.mockReturnValue({
      insert: mockInsert,
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

    mockDownloadAudioForJob.mockResolvedValue({
      data: Buffer.from('audio-bytes'),
      error: null,
    })

    mockTranscribeAudio.mockResolvedValue({
      text: 'Patient discussed treatment goals.',
      error: null,
    })

    mockGenerateNote.mockResolvedValue({
      content: 'Generated SOAP note',
      error: null,
    })

    mockWriteAuditLog.mockResolvedValue(undefined)
  })

  it('a queued job with audio can be processed successfully', async () => {
    mockGetJobById.mockResolvedValue(baseJob)
    mockUpdateJobWorkerFields
      .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })

    const result = await processJob('job-1')

    expect(result).toEqual({ success: true, error: null })
    expect(mockDownloadAudioForJob).toHaveBeenCalledWith(baseJob.audio_storage_path)
    expect(mockTranscribeAudio).toHaveBeenCalledWith(Buffer.from('audio-bytes'), 'recording.webm')
    expect(mockGenerateNote).toHaveBeenCalledWith({
      transcript: 'Patient discussed treatment goals.',
      noteType: 'soap',
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

  it('a job without audio_storage_path returns error "No audio uploaded" and does not transition to running', async () => {
    mockGetJobById.mockResolvedValue({
      ...baseJob,
      audio_storage_path: null,
    })

    const result = await processJob('job-1')

    expect(result).toEqual({ success: false, error: 'No audio uploaded' })
    expect(mockUpdateJobWorkerFields).not.toHaveBeenCalled()
    expect(mockTranscribeAudio).not.toHaveBeenCalled()
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