import type { Lesson } from '../db';

export function canEditCloudLesson(
  lesson: Lesson,
  userId: string,
  isAdmin: boolean
): boolean {
  if (lesson.source === 'local') return true;
  if (isAdmin) return true;
  const owner = lesson.cloudCreatedBy;
  if (!owner) return true;
  return owner === userId;
}

export function isForeignCloudLesson(lesson: Lesson, userId: string): boolean {
  if (lesson.source !== 'cloud') return false;
  return Boolean(
    lesson.cloudCreatedBy && lesson.cloudCreatedBy !== userId
  );
}
