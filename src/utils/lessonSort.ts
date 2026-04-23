import type { Lesson } from '../db';

/**
 * Должно совпадать с логикой server `sortLessonsForClient`: сначала свои папки,
 * затем чужие общие по `publicSortOrder`, у админа в конце — чужие приватные.
 */
export function sortLessonsForDisplay(
  lessons: Lesson[],
  userId: string,
  isAdmin: boolean
): Lesson[] {
  const isMine = (l: Lesson) => {
    if (l.source === 'local') return true;
    if (!l.cloudCreatedBy) return true;
    return l.cloudCreatedBy === userId;
  };
  const mine = lessons.filter(isMine);
  const pubOthers = lessons.filter(
    (l) =>
      l.source === 'cloud' &&
      l.isPublic === true &&
      l.cloudCreatedBy &&
      l.cloudCreatedBy !== userId
  );
  const privOthers = lessons.filter(
    (l) =>
      l.source === 'cloud' &&
      !l.isPublic &&
      l.cloudCreatedBy &&
      l.cloudCreatedBy !== userId
  );

  const mineSorted = [...mine].sort((a, b) => b.updatedAt - a.updatedAt);
  const pubOthersSorted = [...pubOthers].sort(
    (a, b) =>
      (a.publicSortOrder ?? 0) - (b.publicSortOrder ?? 0) ||
      a.name.localeCompare(b.name, 'ru')
  );
  const privOthersSorted = [...privOthers].sort((a, b) =>
    a.name.localeCompare(b.name, 'ru')
  );
  if (isAdmin) {
    return [...mineSorted, ...pubOthersSorted, ...privOthersSorted];
  }
  return [...mineSorted, ...pubOthersSorted];
}
