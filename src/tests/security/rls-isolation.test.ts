import { beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type ExtractionRow = {
  id: string
  session_id: string
  org_id: string
  job_id: string
  transcript_id: string
  generated_by: string
}

const supabaseUrl = process.env.TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const anonKey = process.env.TEST_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY

const orgAEmail = process.env.TEST_ORG_A_EMAIL
const orgAPassword = process.env.TEST_ORG_A_PASSWORD
const orgBEmail = process.env.TEST_ORG_B_EMAIL
const orgBPassword = process.env.TEST_ORG_B_PASSWORD

const envReady = Boolean(
  anonKey &&
  serviceRoleKey &&
  orgAEmail &&
  orgAPassword &&
  orgBEmail &&
  orgBPassword,
)

const describeIntegration = envReady ? describe : describe.skip

let admin: SupabaseClient
let orgAClient: SupabaseClient
let orgBClient: SupabaseClient

let orgAUserId: string
let orgBUserId: string
let orgAOrgId: string
let orgBOrgId: string

let orgASessionId: string
let orgBSessionId: string
let orgAJobId: string
let orgBJobId: string
let orgAAltSessionId: string
let orgAAltJobId: string
let orgANoteId: string
let orgBNoteId: string
let orgATranscriptId: string
let orgAExtractionId: string
let orgBTranscriptId: string
let orgBExtractionId: string
let orgASoftDeletedTranscriptId: string
let orgASoftDeletedExtractionId: string
let orgAStoragePath: string

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl, anonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    throw new Error(`Failed sign in for ${email}: ${error?.message ?? 'unknown error'}`)
  }

  return client
}

describeIntegration('RLS org isolation', () => {
  beforeAll(async () => {
    admin = createClient(supabaseUrl, serviceRoleKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    orgAClient = await signIn(orgAEmail!, orgAPassword!)
    orgBClient = await signIn(orgBEmail!, orgBPassword!)

    const {
      data: { user: orgAUser },
    } = await orgAClient.auth.getUser()
    const {
      data: { user: orgBUser },
    } = await orgBClient.auth.getUser()

    if (!orgAUser || !orgBUser) {
      throw new Error('Failed to resolve signed-in users')
    }

    orgAUserId = orgAUser.id
    orgBUserId = orgBUser.id

    const { data: orgAProfile, error: orgAProfileError } = await admin
      .from('profiles')
      .select('org_id')
      .eq('user_id', orgAUserId)
      .single()

    const { data: orgBProfile, error: orgBProfileError } = await admin
      .from('profiles')
      .select('org_id')
      .eq('user_id', orgBUserId)
      .single()

    if (orgAProfileError || !orgAProfile || orgBProfileError || !orgBProfile) {
      throw new Error('Failed to load test profiles')
    }

    orgAOrgId = orgAProfile.org_id
    orgBOrgId = orgBProfile.org_id

    const { error: crossOrgMembershipError } = await admin
      .from('profiles')
      .upsert({
        user_id: orgBUserId,
        org_id: orgAOrgId,
        display_name: 'Org B User (Org A Provider)',
        role: 'provider',
      }, { onConflict: 'user_id,org_id' })

    if (crossOrgMembershipError) {
      throw new Error(`Failed to grant same-org membership for storage test: ${crossOrgMembershipError.message}`)
    }

    const { data: orgASession, error: orgASessionError } = await admin
      .from('sessions')
      .insert({
        org_id: orgAOrgId,
        created_by: orgAUserId,
        patient_label: 'RLS Org A Patient',
        session_type: 'general',
      })
      .select('id, org_id, created_by')
      .single()

    const { data: orgBSession, error: orgBSessionError } = await admin
      .from('sessions')
      .insert({
        org_id: orgBOrgId,
        created_by: orgBUserId,
        patient_label: 'RLS Org B Patient',
        session_type: 'general',
      })
      .select('id, org_id, created_by')
      .single()

    if (orgASessionError || !orgASession || orgBSessionError || !orgBSession) {
      throw new Error('Failed to seed test sessions')
    }

    orgASessionId = orgASession.id
    orgBSessionId = orgBSession.id

    const { data: orgAAltSession, error: orgAAltSessionError } = await admin
      .from('sessions')
      .insert({
        org_id: orgAOrgId,
        created_by: orgAUserId,
        patient_label: 'RLS Org A Alternate Patient',
        session_type: 'general',
      })
      .select('id')
      .single()

    if (orgAAltSessionError || !orgAAltSession) {
      throw new Error('Failed to seed alternate Org A session')
    }

    orgAAltSessionId = orgAAltSession.id

    const { data: orgAJob, error: orgAJobError } = await admin
      .from('jobs')
      .insert({
        session_id: orgASessionId,
        org_id: orgAOrgId,
        created_by: orgAUserId,
        status: 'queued',
        stage: 'queued',
        note_type: 'soap',
      })
      .select('id, session_id, org_id, created_by, status, stage, note_type')
      .single()

    const { data: orgBJob, error: orgBJobError } = await admin
      .from('jobs')
      .insert({
        session_id: orgBSessionId,
        org_id: orgBOrgId,
        created_by: orgBUserId,
        status: 'queued',
        stage: 'queued',
        note_type: 'soap',
      })
      .select('id, session_id, org_id, created_by, status, stage, note_type')
      .single()

    if (orgAJobError || !orgAJob || orgBJobError || !orgBJob) {
      throw new Error('Failed to seed test jobs')
    }

    orgAJobId = orgAJob.id
    orgBJobId = orgBJob.id

    const { data: orgAAltJob, error: orgAAltJobError } = await admin
      .from('jobs')
      .insert({
        session_id: orgAAltSessionId,
        org_id: orgAOrgId,
        created_by: orgAUserId,
        status: 'queued',
        stage: 'queued',
        note_type: 'soap',
      })
      .select('id')
      .single()

    if (orgAAltJobError || !orgAAltJob) {
      throw new Error('Failed to seed alternate Org A job')
    }

    orgAAltJobId = orgAAltJob.id

    const { data: orgANote, error: orgANoteError } = await admin
      .from('notes')
      .insert({
        session_id: orgASessionId,
        org_id: orgAOrgId,
        created_by: orgAUserId,
        job_id: orgAJobId,
        note_type: 'soap',
        content: 'Org A note',
      })
      .select('id, session_id, org_id, created_by, content')
      .single()

    const { data: orgBNote, error: orgBNoteError } = await admin
      .from('notes')
      .insert({
        session_id: orgBSessionId,
        org_id: orgBOrgId,
        created_by: orgBUserId,
        job_id: orgBJobId,
        note_type: 'soap',
        content: 'Org B note',
      })
      .select('id, session_id, org_id, created_by, content')
      .single()

    if (orgANoteError || !orgANote || orgBNoteError || !orgBNote) {
      throw new Error('Failed to seed test notes')
    }

    orgANoteId = orgANote.id
    orgBNoteId = orgBNote.id
    orgAStoragePath = `${orgAOrgId}/${orgASessionId}/${orgAJobId}/rls-test.webm`

    const { data: orgATranscript, error: orgATranscriptError } = await admin
      .from('transcripts')
      .insert({
        session_id: orgASessionId,
        org_id: orgAOrgId,
        job_id: orgAJobId,
        content: 'Org A transcript',
      })
      .select('id')
      .single()

    if (orgATranscriptError || !orgATranscript) {
      throw new Error(`Failed to seed transcript: ${orgATranscriptError?.message ?? 'unknown error'}`)
    }

    orgATranscriptId = orgATranscript.id

    const { data: orgAExtraction, error: orgAExtractionError } = await admin
      .from('carelogic_field_extractions')
      .insert({
        session_id: orgASessionId,
        org_id: orgAOrgId,
        job_id: orgAJobId,
        transcript_id: orgATranscriptId,
        session_type: 'general',
        fields: {
          client_perspective: 'Org A extraction',
        },
        generated_by: orgAUserId,
      })
      .select('id, session_id, org_id, job_id, transcript_id, generated_by')
      .single()

    if (orgAExtractionError || !orgAExtraction) {
      throw new Error(`Failed to seed extraction: ${orgAExtractionError?.message ?? 'unknown error'}`)
    }

    orgAExtractionId = orgAExtraction.id

    const { data: orgBTranscript, error: orgBTranscriptError } = await admin
      .from('transcripts')
      .insert({
        session_id: orgBSessionId,
        org_id: orgBOrgId,
        job_id: orgBJobId,
        content: 'Org B transcript',
      })
      .select('id')
      .single()

    if (orgBTranscriptError || !orgBTranscript) {
      throw new Error(`Failed to seed Org B transcript: ${orgBTranscriptError?.message ?? 'unknown error'}`)
    }

    orgBTranscriptId = orgBTranscript.id

    const { data: orgBExtraction, error: orgBExtractionError } = await admin
      .from('carelogic_field_extractions')
      .insert({
        session_id: orgBSessionId,
        org_id: orgBOrgId,
        job_id: orgBJobId,
        transcript_id: orgBTranscriptId,
        session_type: 'general',
        fields: {
          client_perspective: 'Org B extraction',
        },
        generated_by: orgBUserId,
      })
      .select('id')
      .single()

    if (orgBExtractionError || !orgBExtraction) {
      throw new Error(`Failed to seed Org B extraction: ${orgBExtractionError?.message ?? 'unknown error'}`)
    }

    orgBExtractionId = orgBExtraction.id

    const { data: orgASoftDeletedTranscript, error: orgASoftDeletedTranscriptError } = await admin
      .from('transcripts')
      .insert({
        session_id: orgAAltSessionId,
        org_id: orgAOrgId,
        job_id: orgAAltJobId,
        content: 'Org A soft-deleted transcript',
      })
      .select('id')
      .single()

    if (orgASoftDeletedTranscriptError || !orgASoftDeletedTranscript) {
      throw new Error(
        `Failed to seed soft-deleted transcript: ${orgASoftDeletedTranscriptError?.message ?? 'unknown error'}`,
      )
    }

    orgASoftDeletedTranscriptId = orgASoftDeletedTranscript.id

    const { data: orgASoftDeletedExtraction, error: orgASoftDeletedExtractionError } = await admin
      .from('carelogic_field_extractions')
      .insert({
        session_id: orgAAltSessionId,
        org_id: orgAOrgId,
        job_id: orgAAltJobId,
        transcript_id: orgASoftDeletedTranscriptId,
        session_type: 'general',
        fields: {
          client_perspective: 'Soft-deleted extraction',
        },
        generated_by: orgAUserId,
        deleted_at: '2026-04-03T12:00:00.000Z',
      })
      .select('id')
      .single()

    if (orgASoftDeletedExtractionError || !orgASoftDeletedExtraction) {
      throw new Error(
        `Failed to seed soft-deleted extraction: ${orgASoftDeletedExtractionError?.message ?? 'unknown error'}`,
      )
    }

    orgASoftDeletedExtractionId = orgASoftDeletedExtraction.id

    const { error: uploadError } = await admin.storage
      .from('audio')
      .upload(orgAStoragePath, new Blob(['audio-test-bytes'], { type: 'audio/webm' }), {
        contentType: 'audio/webm',
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`Failed to seed storage object: ${uploadError.message}`)
    }

    await admin.from('session_consents').insert([
      {
        session_id: orgASessionId,
        org_id: orgAOrgId,
        clinician_id: orgAUserId,
        hipaa_consent: true,
        hipaa_consented_at: new Date().toISOString(),
      },
      {
        session_id: orgBSessionId,
        org_id: orgBOrgId,
        clinician_id: orgBUserId,
        hipaa_consent: true,
        hipaa_consented_at: new Date().toISOString(),
      },
    ])

    await admin.from('audit_log').insert([
      {
        org_id: orgAOrgId,
        actor_id: orgAUserId,
        action: 'session.created',
        entity_type: 'session',
        entity_id: orgASessionId,
      },
      {
        org_id: orgBOrgId,
        actor_id: orgBUserId,
        action: 'session.created',
        entity_type: 'session',
        entity_id: orgBSessionId,
      },
    ])
  })

  it('Org A user cannot SELECT sessions belonging to Org B', async () => {
    const { data, error } = await orgAClient
      .from('sessions')
      .select('id, org_id, created_by')
      .eq('id', orgBSessionId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('Org A user cannot SELECT jobs belonging to Org B', async () => {
    const { data, error } = await orgAClient
      .from('jobs')
      .select('id, session_id, org_id, created_by, status, stage, note_type')
      .eq('id', orgBJobId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('Org A user cannot SELECT notes belonging to Org B', async () => {
    const { data, error } = await orgAClient
      .from('notes')
      .select('id, session_id, org_id, created_by, content')
      .eq('id', orgBNoteId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('Org A user cannot SELECT session_consents belonging to Org B', async () => {
    const { data, error } = await orgAClient
      .from('session_consents')
      .select('id, session_id, org_id, clinician_id')
      .eq('session_id', orgBSessionId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('Org A user cannot INSERT a session with Org B org_id', async () => {
    const { data, error } = await orgAClient
      .from('sessions')
      .insert({
        org_id: orgBOrgId,
        created_by: orgAUserId,
        patient_label: 'Cross-org write attempt',
        session_type: 'general',
      })
      .select('id, org_id, created_by')

    expect(data ?? []).toEqual([])
    expect(error).not.toBeNull()
  })

  it('Org A admin cannot read Org B audit_log rows', async () => {
    const { error: roleError } = await admin
      .from('profiles')
      .update({ role: 'admin' })
      .eq('user_id', orgAUserId)
      .eq('org_id', orgAOrgId)

    if (roleError) {
      throw new Error(`Failed to promote Org A user to admin: ${roleError.message}`)
    }

    const adminClientA = await signIn(orgAEmail!, orgAPassword!)

    const { data, error } = await adminClientA
      .from('audit_log')
      .select('id, org_id, actor_id, action')
      .eq('org_id', orgBOrgId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('A same-org clinician cannot download another clinician\'s audio object from Storage', async () => {
    const { data, error } = await orgBClient.storage
      .from('audio')
      .download(orgAStoragePath)

    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('The extraction owner can read their own stored CareLogic extraction row', async () => {
    const { data, error } = await orgAClient
      .from('carelogic_field_extractions')
      .select('id, session_id, org_id, job_id, transcript_id, generated_by')
      .eq('id', orgAExtractionId)

    expect(error).toBeNull()
    expect(data).toEqual([
      {
        id: orgAExtractionId,
        session_id: orgASessionId,
        org_id: orgAOrgId,
        job_id: orgAJobId,
        transcript_id: orgATranscriptId,
        generated_by: orgAUserId,
      } satisfies ExtractionRow,
    ])
  })

  it('A same-org provider cannot read another provider\'s stored CareLogic extraction row', async () => {
    const { data, error } = await orgBClient
      .from('carelogic_field_extractions')
      .select('id, session_id, org_id, job_id, transcript_id, generated_by')
      .eq('id', orgAExtractionId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('A cross-tenant provider cannot read another tenant\'s stored CareLogic extraction row', async () => {
    const { data, error } = await orgAClient
      .from('carelogic_field_extractions')
      .select('id, session_id, org_id, job_id, transcript_id, generated_by')
      .eq('id', orgBExtractionId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('A provider cannot rebind their note to a different session/job via direct Supabase UPDATE', async () => {
    const { data, error } = await orgAClient
      .from('notes')
      .update({
        session_id: orgAAltSessionId,
        job_id: orgAAltJobId,
      })
      .eq('id', orgANoteId)
      .select('id')

    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('A provider cannot mutate note_type via direct Supabase UPDATE', async () => {
    const { data, error } = await orgAClient
      .from('notes')
      .update({
        note_type: 'dap',
      })
      .eq('id', orgANoteId)
      .select('id')

    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('A provider cannot mutate org_id or created_by via direct Supabase UPDATE', async () => {
    const { data, error } = await orgAClient
      .from('notes')
      .update({
        org_id: orgBOrgId,
        created_by: orgBUserId,
      })
      .eq('id', orgANoteId)
      .select('id')

    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('A same-org admin can read another provider\'s stored CareLogic extraction row', async () => {
    const { error: roleError } = await admin
      .from('profiles')
      .update({ role: 'admin' })
      .eq('user_id', orgBUserId)
      .eq('org_id', orgAOrgId)

    if (roleError) {
      throw new Error(`Failed to promote same-org user to admin: ${roleError.message}`)
    }

    const { data, error } = await orgBClient
      .from('carelogic_field_extractions')
      .select('id, session_id, org_id, job_id, transcript_id, generated_by')
      .eq('id', orgAExtractionId)

    expect(error).toBeNull()
    expect(data).toEqual([
      {
        id: orgAExtractionId,
        session_id: orgASessionId,
        org_id: orgAOrgId,
        job_id: orgAJobId,
        transcript_id: orgATranscriptId,
        generated_by: orgAUserId,
      } satisfies ExtractionRow,
    ])
  })

  it('Soft-deleted CareLogic extraction rows stay hidden from both owners and same-org admins', async () => {
    const { data: ownerData, error: ownerError } = await orgAClient
      .from('carelogic_field_extractions')
      .select('id, session_id, org_id, job_id, transcript_id, generated_by')
      .eq('id', orgASoftDeletedExtractionId)

    expect(ownerError).toBeNull()
    expect(ownerData).toEqual([])

    const { error: roleError } = await admin
      .from('profiles')
      .update({ role: 'admin' })
      .eq('user_id', orgBUserId)
      .eq('org_id', orgAOrgId)

    if (roleError) {
      throw new Error(`Failed to promote same-org user to admin for soft-delete test: ${roleError.message}`)
    }

    const { data: adminData, error: adminError } = await orgBClient
      .from('carelogic_field_extractions')
      .select('id, session_id, org_id, job_id, transcript_id, generated_by')
      .eq('id', orgASoftDeletedExtractionId)

    expect(adminError).toBeNull()
    expect(adminData).toEqual([])
  })
})
