import { PERSON_LABELS, TENSE_LABELS } from '../../../lib/conjugate'
import { GENDER_LABELS, POS_LABELS } from '../../../lib/grammar'
import type { Answer, Grade, Task } from '../../../lib/lesson'
import { ChoiceOptions } from './ChoiceOptions'
import { SentenceWithBlank } from './SentenceWithBlank'
import { statusOf } from './status'
import { TileBuilder } from './TileBuilder'
import { TypedAnswer } from './TypedAnswer'

interface TaskViewProps {
  task: Task
  answer: Answer
  onAnswer: (answer: Answer) => void
  onSubmit: () => void
  grade: Grade | null
}

const Pill = ({ children }: { children: string }) => (
  <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-medium">{children}</span>
)

export function TaskView({ task, answer, onAnswer, onSubmit, grade }: TaskViewProps) {
  const status = statusOf(grade)
  const text = typeof answer === 'string' ? answer : ''

  switch (task.kind) {
    case 'cloze':
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <SentenceWithBlank tokens={task.sentence.tokens} blankIndex={task.cloze.tokenIndex} filled={text} status={status} />
            <p className="text-ink-muted">{task.sentence.sk}</p>
            {task.cloze.hint && <Pill>{task.cloze.hint}</Pill>}
          </div>
          <TypedAnswer value={text} onChange={onAnswer} onSubmit={onSubmit} status={status} label="Chýbajúce slovo" placeholder="Napíš slovo…" />
        </div>
      )

    case 'choice':
      return (
        <div className="space-y-6">
          <div className="space-y-3">
            <SentenceWithBlank tokens={task.sentence.tokens} blankIndex={task.cloze.tokenIndex} filled={text} status={status} />
            <p className="text-ink-muted">{task.sentence.sk}</p>
          </div>
          <ChoiceOptions options={task.options} selected={text} onSelect={onAnswer} correctAnswer={grade ? task.cloze.answer : undefined} />
        </div>
      )

    case 'conjugation':
      return (
        <div className="space-y-5">
          <div className="rounded-card border border-line bg-surface p-5 text-center">
            <p lang="es" className="font-serif text-4xl font-semibold">
              {task.verb.id}
            </p>
            <p className="mt-1 text-ink-muted">{task.verb.sk.join(', ')}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Pill>{PERSON_LABELS[task.person]}</Pill>
              <Pill>{TENSE_LABELS[task.tense]}</Pill>
            </div>
            {task.verb.reflexive && <p className="mt-3 text-sm text-ink-muted">zvratné sloveso – nezabudni na me / te / se…</p>}
          </div>
          <TypedAnswer
            value={text}
            onChange={onAnswer}
            onSubmit={onSubmit}
            status={status}
            label="Tvar slovesa"
            placeholder={task.tense === 'progresivo' ? 'estar + gerundium…' : 'Napíš tvar…'}
          />
        </div>
      )

    case 'builder':
      return (
        <div className="space-y-5">
          <p className="text-xl leading-snug font-medium">{task.sentence.sk}</p>
          <TileBuilder tiles={task.tiles} placed={Array.isArray(answer) ? answer : []} onChange={onAnswer} status={status} />
        </div>
      )

    case 'translation':
      return (
        <div className="space-y-5">
          <p className="text-2xl leading-snug font-medium">{task.sentence.sk}</p>
          <TypedAnswer
            value={text}
            onChange={onAnswer}
            onSubmit={onSubmit}
            status={status}
            label="Preklad do španielčiny"
            placeholder="Po španielsky…"
            multiline
          />
        </div>
      )

    case 'vocab': {
      const isToSpanish = task.direction === 'sk-es'
      return (
        <div className="space-y-5">
          <div className="rounded-card border border-line bg-surface p-5 text-center">
            <p lang={isToSpanish ? 'sk' : 'es'} className="font-serif text-3xl font-semibold">
              {task.prompt}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Pill>{isToSpanish ? 'Preklad do španielčiny' : 'Preklad do slovenčiny'}</Pill>
              {task.word.pos && <Pill>{POS_LABELS[task.word.pos] ?? task.word.pos}</Pill>}
              {task.word.gender && <Pill>{GENDER_LABELS[task.word.gender]}</Pill>}
            </div>
          </div>
          <TypedAnswer
            value={text}
            onChange={onAnswer}
            onSubmit={onSubmit}
            status={status}
            label={isToSpanish ? 'Preklad do španielčiny' : 'Preklad do slovenčiny'}
            placeholder={isToSpanish ? 'Po španielsky…' : 'Po slovensky…'}
          />
        </div>
      )
    }
  }
}
