// e2e/diary.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { button } from './helpers.ts'

const title = (page: Page) => page.getByLabel('Nadpis')
const body = (page: Page) => page.getByLabel('Čo si chceš zapamätať?')
const save = (page: Page) => page.getByRole('button', { name: 'Uložiť', exact: true })
const newNote = (page: Page) => page.getByRole('link', { name: 'Nová poznámka' })
const notes = (page: Page) => page.getByRole('main').getByRole('listitem').getByRole('link')
const noteLink = (page: Page, name: RegExp) => notes(page).filter({ hasText: name })

test('a new note: "Uložiť" closes it into the list as its day and title, it reopens and stays after a reload', async ({ page }) => {
  await page.goto('/diary')
  await expect(page.getByText('Zatiaľ nemáš žiadnu poznámku.')).toBeVisible()
  await newNote(page).tap()
  await expect(page).toHaveURL(/\/diary\/new$/)
  await expect(body(page)).toBeFocused()

  await title(page).fill('Pretérito de ir')
  await body(page).fill('fui, fuiste, fue\nHoy fui al mercado.')
  // At once, well before the 800 ms of the typing pause: the button stores it.
  await save(page).tap()
  await expect(page).toHaveURL(/\/diary$/)
  const first = noteLink(page, /Pretérito de ir/)
  await expect(first).toContainText('Dnes')
  // Only the day and the title: the text stays inside the note.
  await expect(first).not.toContainText('fui, fuiste')

  // A second note the same day, without a title, left by Späť: saved too, listed first under its first line.
  await newNote(page).tap()
  await body(page).fill('Hoy comí tacos.\nCon Ana.')
  await button(page, 'Späť').tap()
  await expect(page).toHaveURL(/\/diary$/)
  await expect(notes(page)).toHaveCount(2)
  await expect(notes(page).first()).toContainText('Hoy comí tacos.')
  await expect(notes(page).first()).not.toContainText('Con Ana.')

  await first.tap()
  await expect(title(page)).toHaveValue('Pretérito de ir')
  await page.reload()
  await expect(title(page)).toHaveValue('Pretérito de ir')
  await expect(body(page)).toHaveValue('fui, fuiste, fue\nHoy fui al mercado.')
  await expect(page.getByText('Uložené', { exact: true })).toBeVisible()
})

test('a new note left empty adds nothing; a note cleared and left is gone', async ({ page }) => {
  await page.goto('/diary')
  await newNote(page).tap()
  await button(page, 'Späť').tap()
  await expect(page.getByText('Zatiaľ nemáš žiadnu poznámku.')).toBeVisible()

  await newNote(page).tap()
  await body(page).fill('Hola')
  await save(page).tap()
  await noteLink(page, /Hola/).tap()
  await body(page).fill('')
  await button(page, 'Späť').tap()
  await expect(page.getByText('Zatiaľ nemáš žiadnu poznámku.')).toBeVisible()
})

test('"Vymazať poznámku" asks first, then removes the note', async ({ page }) => {
  await page.goto('/diary')
  await newNote(page).tap()
  await title(page).fill('ser a estar')
  await save(page).tap()
  await noteLink(page, /ser a estar/).tap()

  await page.getByRole('button', { name: 'Vymazať poznámku' }).tap()
  const confirm = page.getByRole('group', { name: 'Naozaj vymazať túto poznámku?' })
  await confirm.getByRole('button', { name: 'Nechať' }).tap()
  await expect(confirm).toHaveCount(0)
  await page.getByRole('button', { name: 'Vymazať poznámku' }).tap()
  await confirm.getByRole('button', { name: 'Vymazať' }).tap()
  await expect(page).toHaveURL(/\/diary$/)
  await expect(page.getByText('Zatiaľ nemáš žiadnu poznámku.')).toBeVisible()
})

test('a note that does not exist goes back to the diary', async ({ page }) => {
  await page.goto('/diary/n-nothing')
  await expect(page).toHaveURL(/\/diary$/)
})

test('the Domov card is one button to the list: a hint, then the number of notes and ✓', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('region', { name: 'Denník' })
  await expect(card).toContainText('Zapíš si, čo si chceš zapamätať')
  await expect(card.getByRole('link')).toHaveCount(1)
  await card.getByRole('link').tap()
  await expect(page).toHaveURL(/\/diary$/)
  await newNote(page).tap()
  await body(page).fill('ser vs estar\nestar = kde a ako')
  await save(page).tap()
  await expect(page).toHaveURL(/\/diary$/)

  await page.goto('/')
  await expect(card).toContainText('1 poznámka')
  await expect(card.getByLabel('✓')).toBeVisible()
  await expect(card).not.toContainText('ser vs estar')
})

test('the app going to the background saves what was typed at once', async ({ page }) => {
  await page.goto('/diary/new')
  await body(page).fill('Hoy fui al parque.')
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  // Well before the 800 ms of the typing pause: only the background save can have stored it.
  await page.waitForTimeout(250)
  const stored = await page.evaluate(
    () =>
      new Promise<string | undefined>((resolve) => {
        const open = indexedDB.open('somos')
        open.onsuccess = () => {
          const rows = open.result.transaction('diaryNotes').objectStore('diaryNotes').getAll()
          rows.onsuccess = () => resolve((rows.result as { text: string }[])[0]?.text)
        }
      }),
  )
  expect(stored).toBe('Hoy fui al parque.')
})
