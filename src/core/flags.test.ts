import { describe, expect, it, vi } from 'vitest'
import { debugLog, FLAGS, flagStore, isEnabled, setFlag } from './flags'

describe('flags', () => {
  it('start at their defaults and can be toggled', () => {
    expect(isEnabled('debugLog')).toBe(FLAGS.debugLog.default)
    const listener = vi.fn()
    const off = flagStore.subscribe(listener)
    setFlag('debugLog', true)
    expect(isEnabled('debugLog')).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    setFlag('debugLog', false)
    off()
  })

  it('debugLog writes only when the option is on', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    debugLog('test', 'hidden')
    expect(spy).not.toHaveBeenCalled()
    setFlag('debugLog', true)
    debugLog('test', 'shown')
    expect(spy).toHaveBeenCalledWith('[webnota:test]', 'shown')
    setFlag('debugLog', false)
    spy.mockRestore()
  })
})
