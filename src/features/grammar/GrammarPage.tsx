import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Badge } from '../../components/Badge'
import { Chip } from '../../components/Chip'
import { SearchField } from '../../components/SearchField'
import { SectionTitle } from '../../components/SectionTitle'
import { tips } from '../../data'
import { TIP_AREAS, type Level, type Tip } from '../../data/types'
import { useT } from '../../i18n'
import { localizedTip } from '../../lib/localized'
import { searchTips } from '../../lib/tipSearch'
import { useUrlParam, useUrlQuery } from '../../lib/useUrlQuery'

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2']
const isLevel = (value: string | null): value is Level => LEVELS.some((l) => l === value)

function TipRow({ tip }: { tip: Tip }) {
  const local = localizedTip(tip)
  return (
    <li>
      <Link
        to={`/practice/grammar/${tip.id}`}
        className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 transition-colors duration-150 hover:border-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-xl leading-snug font-semibold">{local.title}</span>
          <span className="mt-0.5 line-clamp-2 block text-sm text-ink-muted">{local.intro}</span>
        </span>
        <Badge>{tip.level}</Badge>
        <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
      </Link>
    </li>
  )
}

/**
 * The grammar tips as a small handbook: grouped by area, filtered by level, searchable. The query and the level live in
 * the URL, so Back from a tip returns to the same list. The same tips open from a wrong answer in a lesson ("Prečo?").
 */
export function GrammarPage() {
  const text = useT().grammar
  const [query, setQuery] = useUrlQuery()
  const [levelParam, setLevelParam] = useUrlParam('level')
  const level = isLevel(levelParam) ? levelParam : null
  const searching = query.trim() !== ''

  const found = useMemo(() => searchTips(tips, query).filter((tip) => level === null || tip.level === level), [query, level])

  return (
    <div>
      <BackButton fallback="/practice" />
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{text.title}</h1>
      <p className="mt-2 leading-relaxed text-ink-muted">{text.intro}</p>

      <div className="mt-4 space-y-3">
        <SearchField value={query} onChange={setQuery} label={text.searchLabel} placeholder={text.searchPlaceholder} />
        <div role="group" aria-label={text.levelLabel} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip selected={level === null} onClick={() => setLevelParam(null)}>
            {text.all}
          </Chip>
          {LEVELS.map((l) => (
            <Chip key={l} selected={level === l} onClick={() => setLevelParam(l)}>
              {l}
            </Chip>
          ))}
        </div>
      </div>

      {found.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-line p-6 text-center">
          <p className="font-medium">{text.nothing(query.trim())}</p>
          <p className="mt-1 text-sm text-ink-muted">{text.nothingHint}</p>
        </div>
      ) : searching ? (
        <section aria-labelledby="grammar-results" className="mt-6">
          <SectionTitle id="grammar-results">{text.results(found.length)}</SectionTitle>
          <ul className="space-y-2">
            {found.map((tip) => (
              <TipRow key={tip.id} tip={tip} />
            ))}
          </ul>
        </section>
      ) : (
        TIP_AREAS.map((area) => {
          const ofArea = found.filter((tip) => tip.area === area).sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level))
          if (ofArea.length === 0) return null
          return (
            <section key={area} aria-labelledby={`area-${area}`} className="mt-6">
              <SectionTitle id={`area-${area}`}>{`${text.areas[area]} · ${ofArea.length}`}</SectionTitle>
              <ul className="space-y-2">
                {ofArea.map((tip) => (
                  <TipRow key={tip.id} tip={tip} />
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
