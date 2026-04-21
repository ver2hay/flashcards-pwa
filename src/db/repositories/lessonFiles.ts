import { db } from '../database';
import type { LessonFile } from '../types';

export async function getByLessonId(lessonId: string): Promise<LessonFile[]> {
  return db.lessonFiles.where('lessonId').equals(lessonId).toArray();
}

export async function getByUserId(userId: string): Promise<LessonFile[]> {
  return db.lessonFiles.where('userId').equals(userId).toArray();
}

export async function upsertLessonFiles(files: LessonFile[]): Promise<void> {
  if (files.length === 0) return;
  await db.lessonFiles.bulkPut(files);
}

export async function deleteByLessonIds(userId: string, lessonIds: string[]): Promise<void> {
  if (lessonIds.length === 0) return;
  await db.lessonFiles
    .where('lessonId')
    .anyOf(lessonIds)
    .and((f) => f.userId === userId)
    .delete();
}
