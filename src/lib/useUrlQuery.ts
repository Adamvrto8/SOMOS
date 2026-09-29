import { useState } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Updates several URL search params in one navigation, keeping the others; `null` removes one.
 *
 * The base is the browser's current URL, not the hook's `prev` snapshot: the router writes
 * history before React re-renders, so two quick updates (tap a filter, start typing) would
 * otherwise have the second one restore what the first removed.
 *
 * These are in-page filters (topic, level, tab), so the scroll position stays where it is;
 * without preventScrollReset, <ScrollRestoration> jumps to the top on every change.
 */
export function useUpdateParams(): (updates: Record<string, string | null>) => void {
  const [, setParams] = useSearchParams()
  return (updates) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search)
        for (const [name, value] of Object.entries(updates)) {
          if (value === null) next.delete(name)
          else next.set(name, value)
        }
        return next
      },
      { replace: true, preventScrollReset: true },
    )
}

/**
 * Text query mirrored in the URL (?q=) so "back" restores it. Local state keeps
 * typing smooth; the URL follows with replace navigations.
 */
export function useUrlQuery(): [string, (value: string) => void] {
  const [params] = useSearchParams()
  const update = useUpdateParams()
  const urlQuery = params.get('q') ?? ''
  const [query, setQuery] = useState(urlQuery)

  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery)
    // Cleared from outside (e.g. tapping the active tab again): reset the field too.
    if (urlQuery === '' && query !== '') setQuery('')
  }

  const change = (value: string) => {
    setQuery(value)
    update({ q: value || null })
  }

  return [query, change]
}

/** One URL search param and a setter that keeps the others. */
export function useUrlParam(name: string): [string | null, (value: string | null) => void] {
  const [params] = useSearchParams()
  const update = useUpdateParams()
  return [params.get(name), (value) => update({ [name]: value })]
}
