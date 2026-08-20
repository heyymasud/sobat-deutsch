import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// AC-UX-05 / NFR-UX-05: prefers-reduced-motion must be honored globally.
// No jsdom/matchMedia mock is installed in this project, so this checks the
// actual shipped CSS rule instead of simulating the media query in a DOM.
describe('prefers-reduced-motion support (AC-UX-05, NFR-UX-05)', () => {
  const css = readFileSync(join(__dirname, 'index.css'), 'utf-8')

  it('defines a reduced-motion media query', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  })

  it('forces near-zero animation/transition duration under that query', () => {
    const block = css.slice(css.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/))
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
  })
})
