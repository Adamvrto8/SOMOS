import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CustomWord, type SavedItem, type SavedItemType } from './db'
import { addReviewCard, removeReviewCard } from './srs'

// Reads return `undefined` while IndexedDB is loading; components render a neutral state meanwhile.

const wordKey = (id: string): [SavedItemType, string] => ['word', id]

export function useSavedItems(): SavedItem[] | undefined {
  return useLiveQuery(() => db.savedItems.orderBy('savedAt').reverse().toArray(), [])
}

export function useSavedWordIds(): Set<string> {
  const ids = useLiveQuery(async () => {
    const items = await db.savedItems.where('[itemType+itemId]').between(['word', ''], ['word', '￿']).toArray()
    return new Set(items.map((item) => item.itemId))
  }, [])
  return ids ?? new Set()
}

export function useIsSaved(wordId: string): boolean | undefined {
  return useLiveQuery(async () => Boolean(await db.savedItems.get(wordKey(wordId))), [wordId])
}

/** Saving a word also schedules it for review; unsaving drops its review card. */
export async function toggleSavedWord(wordId: string): Promise<boolean> {
  const saved = await db.transaction('rw', db.savedItems, db.reviewCards, async () => {
    if (await db.savedItems.get(wordKey(wordId))) {
      await db.savedItems.delete(wordKey(wordId))
      await removeReviewCard('word', wordId)
      return false
    }
    await db.savedItems.put({ itemType: 'word', itemId: wordId, savedAt: Date.now() })
    await addReviewCard('word', wordId)
    return true
  })
  if (saved) void requestPersistence()
  return saved
}

export function useCustomWords(): CustomWord[] | undefined {
  return useLiveQuery(() => db.customWords.orderBy('createdAt').reverse().toArray(), [])
}

/** `null` = not found, `undefined` = still loading. */
export function useCustomWord(id: string): CustomWord | null | undefined {
  return useLiveQuery(async () => (await db.customWords.get(id)) ?? null, [id])
}

export interface CustomWordInput {
  es: string
  sk: string
  note?: string
  topic?: string
}

// crypto.randomUUID needs a secure context, which the LAN dev server is not.
const newId = () => `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export async function saveCustomWord(input: CustomWordInput, id?: string): Promise<string> {
  const clean = {
    es: input.es.trim(),
    sk: input.sk.trim(),
    note: input.note?.trim() || undefined,
    topic: input.topic || undefined,
  }
  if (id) {
    const existing = await db.customWords.get(id)
    if (!existing) throw new Error(`Custom word ${id} not found`)
    await db.customWords.put({ ...existing, ...clean })
    return id
  }
  const created: CustomWord = { id: newId(), ...clean, createdAt: Date.now() }
  await db.transaction('rw', db.customWords, db.reviewCards, async () => {
    await db.customWords.add(created)
    await addReviewCard('custom', created.id)
  })
  void requestPersistence()
  return created.id
}

export async function deleteCustomWord(id: string): Promise<void> {
  await db.transaction('rw', db.customWords, db.reviewCards, async () => {
    await db.customWords.delete(id)
    await removeReviewCard('custom', id)
  })
}

/**
 * Asks the browser not to evict our IndexedDB under storage pressure.
 * Chrome decides silently (installed PWAs are usually granted).
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
