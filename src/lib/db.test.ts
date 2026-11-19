import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'

it('the upgrade to one diary text keeps both old fields, in order, and leaves no old ones', async () => {
  // The database as an app before 2026-11-19 left it (version 6, diary with learned + es).
  const old = new Dexie('somos')
  old.version(6).stores({
    customWords: 'id, es, topic, createdAt',
    savedItems: '[itemType+itemId], savedAt',
    reviewCards: '[itemType+itemId], itemType',
    attempts: '++id, exercise, itemId, at',
    mistakes: '[exercise+itemId], lastWrongAt',
    lookups: 'key, at',
    outbox: '[kind+key]',
    diary: 'date, updatedAt',
    chats: 'id, updatedAt',
  })
  await old.table('diary').bulkPut([
    { date: '2026-11-06', learned: 'pretérito ', es: 'Ayer fui al cine.', createdAt: 1, updatedAt: 2 },
    { date: '2026-11-07', learned: '', es: 'Hola', createdAt: 3, updatedAt: 4 },
  ])
  old.close()

  const { db } = await import('./db')
  expect(await db.diary.orderBy('date').toArray()).toEqual([
    { date: '2026-11-06', text: 'pretérito\n\nAyer fui al cine.', createdAt: 1, updatedAt: 2 },
    { date: '2026-11-07', text: 'Hola', createdAt: 3, updatedAt: 4 },
  ])
})
