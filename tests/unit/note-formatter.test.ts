import { describe, it, expect } from 'vitest'
import { buildStubNote } from '../../src/lib/jobs/stubs'

describe('note-formatter', () => {
  it('SOAP note contains required sections', () => {
    const note = buildStubNote('SOAP', 'test transcript')
    expect(note).toContain('SUBJECTIVE')
    expect(note).toContain('OBJECTIVE')
    expect(note).toContain('ASSESSMENT')
    expect(note).toContain('PLAN')
  })

  it('DAP note contains required sections', () => {
    const note = buildStubNote('DAP', 'test transcript')
    expect(note).toContain('DATA')
    expect(note).toContain('ASSESSMENT')
    expect(note).toContain('PLAN')
  })

  it('does not throw on empty transcript', () => {
    expect(() => buildStubNote('SOAP', '')).not.toThrow()
  })
})
