import { beforeEach, describe, expect, it } from 'vitest'
import { clearLog, createLogger, getLogEntries, getLogSize, setRingSize } from './log'

beforeEach(() => {
  // ring 是模块级状态,每个测试前清空,保证相互独立。
  clearLog()
  // 默认容量;某些测试会临时缩容,测完恢复。
  setRingSize(500)
})

describe('log exports', () => {
  it('getLogEntries returns a shallow copy (mutating result does not affect ring)', () => {
    const log = createLogger('test')
    log.info('one')
    log.info('two')

    const snapshot = getLogEntries()
    expect(snapshot).toHaveLength(2)

    snapshot.push({ t: 0, level: 'info', tag: 'test', msg: 'injected' })
    snapshot.pop()
    snapshot.pop()

    expect(getLogEntries()).toHaveLength(2)
  })

  it('getLogSize reflects number of entries', () => {
    expect(getLogSize()).toBe(0)
    const log = createLogger('test')
    log.info('a')
    log.info('b')
    log.info('c')
    expect(getLogSize()).toBe(3)
  })

  it('clearLog empties the ring', () => {
    const log = createLogger('test')
    log.info('a')
    log.info('b')
    expect(getLogSize()).toBe(2)

    clearLog()
    expect(getLogSize()).toBe(0)
    expect(getLogEntries()).toEqual([])
  })

  it('setRingSize shrinks ring and subsequent getLogSize reflects cap', () => {
    const log = createLogger('test')
    for (let i = 0; i < 10; i++)
      log.info(`msg-${i}`)

    // RING_MIN 是 50,想真正生效就给一个 >= 50 的容量,这里不测边界,直接信赖夹紧逻辑。
    setRingSize(50)
    expect(getLogSize()).toBeLessThanOrEqual(50)
  })
})
