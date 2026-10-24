import { describe, expect, it } from 'vitest'
import { cleanBreadcrumb, createReporter, withoutQuery } from './errorReports'

describe('createReporter', () => {
  it('keeps errors until the library is there, then passes them on in order', () => {
    const reporter = createReporter()
    const sent: unknown[] = []
    reporter.report('early')
    reporter.report('second', { componentStack: 'at Page' })
    expect(sent).toEqual([])

    reporter.connect({ capture: (error, context) => sent.push([error, context]) })
    expect(sent).toEqual([['early', undefined], ['second', { componentStack: 'at Page' }]])

    reporter.report('later')
    expect(sent).toHaveLength(3)
  })

  it('queues at most 20 errors, so a crash in a loop does not pile up', () => {
    const reporter = createReporter()
    for (let i = 0; i < 50; i++) reporter.report(i)
    const sent: unknown[] = []
    reporter.connect({ capture: (error) => sent.push(error) })
    expect(sent).toHaveLength(20)
  })
})

describe('breadcrumbs', () => {
  it('lose the query and hash of an address', () => {
    expect(withoutQuery('https://x.supabase.co/rest/v1/attempts?user_id=eq.123')).toBe('https://x.supabase.co/rest/v1/attempts')
    expect(withoutQuery('/profile/sign-in#access_token=abc')).toBe('/profile/sign-in')
    expect(withoutQuery('/word/casa')).toBe('/word/casa')
  })

  it('drop the console and clean the addresses of requests and navigation', () => {
    expect(cleanBreadcrumb({ category: 'console', message: 'anything' })).toBeNull()
    expect(cleanBreadcrumb({ category: 'fetch', data: { url: '/api/translate?q=hola', status_code: 200 } })).toEqual({
      category: 'fetch',
      data: { url: '/api/translate', status_code: 200 },
    })
    expect(cleanBreadcrumb({ category: 'navigation', data: { from: '/a?x=1', to: '/b#y' } })?.data).toEqual({ from: '/a', to: '/b' })
    expect(cleanBreadcrumb({ category: 'ui.click', message: 'button' })).toEqual({ category: 'ui.click', message: 'button' })
  })
})
