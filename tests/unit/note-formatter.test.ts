import { describe, it, expect } from 'vitest'
import { buildStubNote } from '../../src/lib/jobs/stubs'

describe('note-formatter', () => {
  const seed = {
    patientLabel: 'Patient A',
    providerName: 'Provider A',
    sessionType: 'general',
  }

  it('SOAP note contains required sections', () => {
    const note = buildStubNote('soap', seed)
    expect(note).toContain('SUBJECTIVE')
    expect(note).toContain('OBJECTIVE')
    expect(note).toContain('ASSESSMENT')
    expect(note).toContain('PLAN')
  })

  it('DAP note contains required sections', () => {
    const note = buildStubNote('dap', seed)
    expect(note).toContain('DATA')
    expect(note).toContain('ASSESSMENT')
    expect(note).toContain('PLAN')
  })

  it('does not throw on empty transcript', () => {
    expect(() => buildStubNote('soap', seed)).not.toThrow()
  })
})
