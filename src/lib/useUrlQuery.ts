import { useState } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Text query mirrored in the URL (?q=) so "back" restores it. Local state keeps
 * typing smooth; the URL follows with replace navigations.
 */
export function useUrlQuery(): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams()
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
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set('q', value)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }

  return [query, change]
}

/**
 * Updates several URL search params in one navigation, keeping the others; `null` removes one.
 * (Separate setSearchParams calls in one handler would overwrite each other.)
 */
export function useUpdateParams(): (updates: Record<string, string | null>) => void {
  const [, setParams] = useSearchParams()
  return (updates) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [name, value] of Object.entries(updates)) {
          if (value === null) next.delete(name)
          else next.set(name, value)
        }
        return next
      },
      { replace: true },
    )
}

/** One URL search param and a setter that keeps the others. */
export function useUrlParam(name: string): [string | null, (value: string | null) => void] {
  const [params] = useSearchParams()
  const update = useUpdateParams()
  return [params.get(name), (value) => update({ [name]: value })]
}
