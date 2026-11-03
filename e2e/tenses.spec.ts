import { expect, test } from '@playwright/test'

test('a verb shows the B1–B2 tenses, the imperative positive and negative', async ({ page }) => {
  await page.goto('/word/tener')
  await page.getByRole('tab', { name: 'subjuntivo', exact: true }).tap()
  await expect(page.getByRole('tabpanel')).toContainText('tenga')

  await page.getByRole('tab', { name: 'imperativo', exact: true }).tap()
  const panel = page.getByRole('tabpanel')
  await expect(panel).toContainText('usted')
  await expect(panel).toContainText('ten')
  await expect(panel).toContainText('no tengas')
  // The imperative has no yo.
  await expect(panel.getByText('yo', { exact: true })).toHaveCount(0)

  await page.getByRole('tab', { name: 'pluscuamperfecto', exact: true }).tap()
  await expect(page.getByRole('tabpanel')).toContainText('había tenido')
})

test('the drill offers B1 tenses with their level, and the level badge goes once the level is reached', async ({ page }) => {
  await page.goto('/practice?type=conjugation&level=A1')
  await expect(page.getByRole('button', { name: /^subjuntivo/ })).toContainText('B1')
  await expect(page.getByRole('button', { name: /^imperativo/ })).toContainText('A2')
  await expect(page.getByRole('button', { name: 'presente', exact: true })).toBeVisible()

  await page.goto('/practice?type=conjugation&level=B1')
  await expect(page.getByRole('button', { name: /^subjuntivo/ })).not.toContainText('B1')
  await expect(page.getByRole('button', { name: /^subj\. imperfecto/ })).toContainText('B2')
})

test('a tense of a higher level moves the level up, and the levels below it cannot be picked', async ({ page }) => {
  await page.goto('/practice?type=conjugation&level=A1')
  await page.getByRole('button', { name: /^subj\. imperfecto/ }).tap()
  const level = (name: string) => page.getByRole('radio', { name, exact: true })
  await expect(level('B2')).toBeChecked()
  for (const below of ['A1', 'A2', 'B1']) await expect(level(below)).toBeDisabled()
  await expect(level('Všetky')).toBeEnabled()

  await page.getByRole('button', { name: /^presente/ }).tap()
  await expect(level('B2')).toBeChecked()
  await level('A1').tap()
  await expect(level('A1')).toBeChecked()

  // A link (or a remembered tense) that pairs a tense with a lower level shows the tense's level.
  await page.goto('/practice?type=conjugation&tense=subjuntivo&level=A1')
  await expect(level('B1')).toBeChecked()
})
