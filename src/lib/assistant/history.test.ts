import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { addTurn, askInNewChat, deleteChat, forgetChat, getChat, listChats, MAX_THREADS, openChat, resetChatModule, restoreLastChat, startNewChat, takeQueued, titleOf } from './history'

beforeEach(async () => {
  await db.chats.clear()
  resetChatModule()
})

describe('SOMO conversations', () => {
  it('keeps turns in order and stores the conversation under its first question', async () => {
    await addTurn({ question: 'Čo je casa?', answer: 'Dom.' }, 1000)
    await addTurn({ question: 'A carro?', answer: 'Auto.', calls: 2 }, 2000)
    expect(getChat().turns.map((t) => t.question)).toEqual(['Čo je casa?', 'A carro?'])
    const [stored] = await listChats()
    expect(stored).toMatchObject({ id: getChat().id, title: 'Čo je casa?', createdAt: 1000, updatedAt: 2000 })
    expect(stored.turns).toHaveLength(2)
  })

  it('opens the last conversation again after the app was closed', async () => {
    await addTurn({ question: 'staré', answer: 'a' }, 1000)
    startNewChat()
    await addTurn({ question: 'nové', answer: 'b' }, 2000)
    resetChatModule() // the app closed
    expect(getChat()).toMatchObject({ turns: [], ready: false })
    await restoreLastChat()
    expect(getChat().ready).toBe(true)
    expect(getChat().turns.map((t) => t.question)).toEqual(['nové'])
    // Going on adds to the same stored conversation.
    await addTurn({ question: 'ďalej', answer: 'c' }, 3000)
    expect(await db.chats.count()).toBe(2)
  })

  it('a new conversation leaves the previous one in the list, and it can be reopened', async () => {
    await addTurn({ question: 'prvý', answer: 'a' }, 1000)
    const first = getChat().id!
    startNewChat()
    expect(getChat().turns).toEqual([])
    await addTurn({ question: 'druhý', answer: 'b' }, 2000)
    expect((await listChats()).map((c) => c.title)).toEqual(['druhý', 'prvý'])
    expect(await openChat(first)).toBe(true)
    expect(getChat().turns.map((t) => t.question)).toEqual(['prvý'])
  })

  it('keeps at most MAX_THREADS conversations, dropping the oldest', async () => {
    for (let i = 0; i <= MAX_THREADS; i++) {
      startNewChat()
      await addTurn({ question: `q${i}`, answer: 'a' }, 1000 + i)
    }
    const titles = (await listChats()).map((c) => c.title)
    expect(titles).toHaveLength(MAX_THREADS)
    expect(titles).not.toContain('q0')
  })

  it('deleting the conversation on screen starts a new one; forgetting drops it from memory', async () => {
    await addTurn({ question: 'a', answer: 'b' })
    await deleteChat(getChat().id!)
    expect(getChat()).toMatchObject({ id: null, turns: [] })
    expect(await db.chats.count()).toBe(0)
    await addTurn({ question: 'c', answer: 'd' })
    forgetChat()
    expect(getChat().turns).toEqual([])
  })

  it('shortens a long first question for the list', () => {
    expect(titleOf('  Ako  sa\npovie dom? ')).toBe('Ako sa povie dom?')
    const long = titleOf('x'.repeat(200))
    expect(long).toHaveLength(80)
    expect(long.endsWith('…')).toBe(true)
  })

  it('a queued question opens a new conversation that the restore of the last one leaves alone', async () => {
    await addTurn({ question: 'staré', answer: 'a' }, 1000)
    resetChatModule() // the app opened again, right into "Prečo?"
    askInNewChat('Prečo je moja odpoveď zlá?')
    await restoreLastChat()
    expect(getChat()).toMatchObject({ id: null, turns: [], ready: true, queued: 'Prečo je moja odpoveď zlá?' })
    expect(takeQueued()).toBe('Prečo je moja odpoveď zlá?')
    expect(takeQueued()).toBeNull()
  })
})
