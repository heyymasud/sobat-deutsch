import { describe, it, expect } from 'vitest'

// WCAG 2.x relative luminance / contrast ratio, per the spec formula.
function linear(c: number) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
function luminance(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}
function contrast(hex1: string, hex2: string) {
  const l1 = luminance(hex1)
  const l2 = luminance(hex2)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

// Gender text colors (src/index.css --color-gender-*) rendered as text on
// light chip/card backgrounds (bg-white, bg-gray-50, bg-{blue,red,green}-50).
const GENDER_COLORS = {
  m: '#1d4ed8',
  f: '#b91c1c',
  n: '#15803d',
  p: '#b45309',
}
const LIGHT_BACKGROUNDS = ['#ffffff', '#f9fafb', '#eff6ff', '#fef2f2', '#f0fdf4']

describe('gender color contrast (WCAG AA, NFR-UX-02/08)', () => {
  for (const [gender, color] of Object.entries(GENDER_COLORS)) {
    for (const bg of LIGHT_BACKGROUNDS) {
      it(`gender-${gender} (${color}) on ${bg} is >= 4.5:1`, () => {
        expect(contrast(color, bg)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
