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
