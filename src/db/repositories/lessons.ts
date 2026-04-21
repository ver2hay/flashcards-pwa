import { db } from '../database';
import type { Lesson } from '../types';

function generateId(): string {
  return crypto.randomUUID();
}

function now(): number {
  return Date.now();
}

export async function createLesson(
  data: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Lesson> {
  const ts = now();
  const lesson: Lesson = {
    ...data,
    id: generateId(),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.lessons.add(lesson);
  return lesson;
}

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
  await db.transaction('rw', db.lessons, db.cards, db.lessonFiles, async () => {
    await db.cards
      .where('folderId')
      .anyOf(ids)
      .and((card) => card.userId === userId)
      .delete();
    await db.lessonFiles
      .where('lessonId')
      .anyOf(ids)
      .and((f) => f.userId === userId)
      .delete();
    await db.lessons
      .where('id')
      .anyOf(ids)
      .and((lesson) => lesson.userId === userId)
      .delete();
  });
}
