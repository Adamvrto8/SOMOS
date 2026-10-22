import { expect, test, type Page } from '@playwright/test'
import { button } from './helpers.ts'

// A live duel between two tabs of one browser: the local duel backend joins them (src/lib/duel/localBackend.ts).

interface Planned {
  kind: string
  right: string | string[] // the option, the typed form, or the tiles in order
  wrong: string // an option that is not the answer (choice), or text that is wrong
}

/** The tasks of the room, from the app's own code: what is right and what is wrong for each. */
async function plan(page: Page, code: string): Promise<Planned[]> {
  return page.evaluate(async (roomCode) => {
    // The dev server's own module, as the page has it (a path the type checker does not resolve).
    const path = '/src/lib/duel/match.ts'
    const match = (await import(/* @vite-ignore */ path)) as {
      slotsOf: (rounds: never) => unknown[]
      duelTask: (slot: unknown, seed: number) => {
        kind: string
        answer: string
        expected: string & string[]
        options: string[]
        cloze: { answer: string }
        tiles: { text: string }[]
      }
    }
    const store = JSON.parse(localStorage.getItem('somos-duel-local-v1') ?? '{}') as { rooms: Record<string, { code: string; rounds: never; seed: number }> }
    const room = Object.values(store.rooms).find((r) => r.code === roomCode)!
    return match.slotsOf(room.rounds).map((slot) => {
      const task = match.duelTask(slot, room.seed)!
      switch (task.kind) {
        case 'choice':
          return { kind: task.kind, right: task.cloze.answer, wrong: task.options.find((o) => o !== task.cloze.answer)! }
        case 'conjugation':
          return { kind: task.kind, right: task.answer, wrong: 'zzz' }
        case 'vocab':
          return { kind: task.kind, right: task.expected, wrong: 'zzz' }
        case 'builder':
          return { kind: task.kind, right: task.expected.map((word) => task.tiles.find((t) => t.text.toLowerCase() === word.toLowerCase())!.text), wrong: '' }
        default:
          throw new Error(`no ${task.kind} in a duel`)
      }
    })
  }, code)
}

async function answer(page: Page, task: Planned, right: boolean) {
  if (task.kind === 'choice') {
    await page.getByRole('radio', { name: right ? (task.right as string) : task.wrong, exact: true }).tap()
    return
  }
  if (task.kind === 'builder') {
    if (right) for (const word of task.right as string[]) await page.getByLabel('Slová').getByRole('button', { name: word, exact: true }).first().tap()
  } else {
    await page.getByRole('textbox').fill(right ? (task.right as string) : task.wrong)
  }
  await button(page, 'Odoslať').tap()
}

async function nickname(page: Page, name: string) {
  await page.getByLabel('Prezývka').fill(name)
  await button(page, 'Uložiť').tap()
}

test('two players play a live duel: the same tasks at the same time, the suns, the winner and the history', async ({ context }) => {
  test.setTimeout(180_000)
  const ana = await context.newPage()
  const ben = await context.newPage()

  // Ana opens a room from Cvičiť.
  await ana.goto('/practice')
  await ana.getByRole('link', { name: 'Duel' }).tap()
  await nickname(ana, 'Ana')
  await expect(ana.getByText('Hráš ako Ana')).toBeVisible()
  await button(ana, 'Založiť miestnosť').tap()
  await expect(ana).toHaveURL(/\/duel\/[A-Z0-9]{6}$/)
  const code = ana.url().split('/').pop()!
  await expect(ana.getByText('Čaká sa na súpera. Pošli mu odkaz alebo kód.')).toBeVisible()
  await expect(button(ana, 'Štart')).toBeDisabled()

  // Ben comes with the link; the nickname Ana has is taken.
  await ben.goto(`/duel/${code}`)
  await nickname(ben, 'ana')
  await expect(ben.getByRole('alert')).toHaveText('Túto prezývku už má niekto iný.')
  await nickname(ben, 'Ben')
  await expect(ben.getByText('Čaká sa, kým Ana spustí zápas.')).toBeVisible()
  await expect(ana.getByText('Ben')).toBeVisible()

  // A third one finds the room full.
  const cid = await context.newPage()
  await cid.goto(`/duel/${code}`)
  await nickname(cid, 'Cid')
  await expect(cid.getByText('V tejto miestnosti už hrajú dvaja.')).toBeVisible()
  await cid.close()

  await button(ana, 'Štart').tap()
  for (const page of [ana, ben]) await expect(page.getByText('Pripravte sa')).toBeVisible()

  // Ana answers right, Ben wrong (always right away, so nobody waits out the clock).
  const tasks = await plan(ana, code)
  for (const [i, task] of tasks.entries()) {
    const position = `${(i % 5) + 1}/5`
    for (const page of [ana, ben]) await expect(page.getByText(position, { exact: true })).toBeVisible({ timeout: 15_000 })
    await answer(ana, task, true)
    if (i === 0) await expect(ben.getByText('Ana už odpovedal')).toBeVisible()
    await answer(ben, task, false)
    if (i === 0) {
      // Both see the right answer and what each got.
      await expect(ana.getByText('Ben bez odpovede').or(ana.getByText(/Ben\s*\+0/))).toBeVisible()
    }
    if (i === 4) for (const page of [ana, ben]) await expect(page.getByText('Kolo 1 je za vami')).toBeVisible()
  }

  await expect(ana.getByRole('heading', { name: 'Vyhral si!' })).toBeVisible({ timeout: 15_000 })
  await expect(ben.getByRole('heading', { name: 'Tentoraz prehra' })).toBeVisible()

  // The match is in both histories.
  await button(ana, 'Späť na Duel').tap()
  await expect(ana.getByRole('link', { name: /Ben/ })).toContainText('Výhra')
  await expect(ana.getByText('1 – 0 – 0')).toBeVisible()
})

test('a task not answered in time counts nothing, and leaving the app during a task ends it as wrong', async ({ context }) => {
  test.setTimeout(90_000)
  const ana = await context.newPage()
  const ben = await context.newPage()
  await ana.goto('/duel')
  await nickname(ana, 'Ana')
  await button(ana, 'Založiť miestnosť').tap()
  await expect(ana).toHaveURL(/\/duel\/[A-Z0-9]{6}$/)
  const code = ana.url().split('/').pop()!
  await ben.goto(`/duel/${code}`)
  await nickname(ben, 'Ben')
  await expect(button(ana, 'Štart')).toBeEnabled()
  await button(ana, 'Štart').tap()

  const [first] = await plan(ana, code)
  await expect(ana.getByText('1/5', { exact: true })).toBeVisible({ timeout: 10_000 })
  // Ben switches to another app: his answer is in, as wrong.
  await ben.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await answer(ana, first, true)
  await expect(ana.getByText(/Ben\s*\+0|Ben\s*bez odpovede/)).toBeVisible()

  // Task 2: nobody answers; after its 10 s both get nothing.
  await expect(ana.getByText('2/5', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(ana.getByText('Ana bez odpovede')).toBeVisible({ timeout: 15_000 })
})
