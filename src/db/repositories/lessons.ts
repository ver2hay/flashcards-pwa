import { db } from '../database';
import type { Lesson } from '../types';

export async function getById(id: string): Promise<Lesson | undefined> {
  return db.lessons.get(id);
}

export async function getByUserId(userId: string): Promise<Lesson[]> {
  return db.lessons.where('userId').equals(userId).toArray();
}

export async function bulkUpsertLessons(lessons: Lesson[]): Promise<void> {
  if (lessons.length === 0) return;
  await db.lessons.bulkPut(lessons);
}

export async function deleteLessons(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction('rw', db.lessons, db.cards, async () => {
    await db.cards
      .where('folderId')
      .anyOf(ids)
      .and((card) => card.userId === userId)
      .delete();
    await db.lessons
      .where('id')
      .anyOf(ids)
      .and((lesson) => lesson.userId === userId)
      .delete();
  });
}
