import { db } from '../database';
import type { Card } from '../types';

function generateId(): string {
  return crypto.randomUUID();
}

function now(): number {
  return Date.now();
}

export async function createCard(
  data: Omit<Card, 'id' | 'createdAt'>
): Promise<Card> {
  const card: Card = {
    ...data,
    id: generateId(),
    createdAt: now(),
  };
  await db.cards.add(card);
  return card;
}

export async function bulkCreateCards(
  items: Omit<Card, 'id' | 'createdAt'>[]
): Promise<number> {
  if (items.length === 0) return 0;
  const ts = now();
  const cards: Card[] = items.map((item) => ({
    ...item,
    id: generateId(),
    createdAt: ts,
  }));
  await db.transaction('rw', db.cards, async () => {
    await db.cards.bulkAdd(cards);
  });
  return cards.length;
}

export async function getById(id: string): Promise<Card | undefined> {
  return db.cards.get(id);
}

export async function getByFolderId(folderId: string): Promise<Card[]> {
  return db.cards.where('folderId').equals(folderId).toArray();
}

export async function getByLessonId(lessonId: string): Promise<Card[]> {
  return getByFolderId(lessonId);
}

export async function getByUserId(userId: string): Promise<Card[]> {
  return db.cards.where('userId').equals(userId).toArray();
}

export async function replaceCardsForLesson(
  userId: string,
  lessonId: string,
  cards: Card[]
): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    await db.cards
      .where('folderId')
      .equals(lessonId)
      .and((card) => card.userId === userId)
      .delete();
    if (cards.length > 0) {
      await db.cards.bulkPut(cards);
    }
  });
}

export async function update(
  id: string,
  updates: Partial<Omit<Card, 'id'>>
): Promise<void> {
  await db.cards.update(id, updates);
}

export async function deleteCard(id: string): Promise<void> {
  await db.cards.delete(id);
}
