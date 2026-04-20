import { describe, expect, it } from 'vitest'
import { clampPanelPos, getDefaultPanelPos } from '@/stores/settings'

describe('clampPanelPos', () => {
  it('越界坐标会被夹回当前视口内', () => {
    const pos = clampPanelPos(
      { x: 999, y: 999 },
      {
        viewport: { width: 800, height: 600 },
        panel: { width: 320, height: 360 },
      },
    )

    expect(pos).toEqual({ x: 480, y: 240 })
  })

  it('坏坐标会回退到默认右下角位置', () => {
    const pos = clampPanelPos(
      { x: Number.NaN, y: Number.POSITIVE_INFINITY },
      {
        viewport: { width: 800, height: 600 },
        panel: { width: 320, height: 360 },
      },
    )

    expect(pos).toEqual(getDefaultPanelPos(
      { width: 800, height: 600 },
      { width: 320, height: 360 },
    ))
  })

  it('面板比视口还大时退到原点', () => {
    const pos = clampPanelPos(
      { x: 40, y: 20 },
      {
        viewport: { width: 240, height: 160 },
        panel: { width: 320, height: 360 },
      },
    )

    expect(pos).toEqual({ x: 0, y: 0 })
  })
})
