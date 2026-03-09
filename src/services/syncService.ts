import { fetchLessonCards, fetchLessons } from './lessonsApi';
import type { Lesson, Card } from '../db';
import {
  getLessonsByUserId,
  bulkUpsertLessons,
  deleteLessons,
  replaceCardsForLesson,
} from '../db';

function parseEpoch(value?: string | number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeLesson(
  lesson: { id: string; name: string; createdAt?: string | number; updatedAt?: string | number },
  userId: string
): Lesson {
  const createdAt = parseEpoch(lesson.createdAt);
  const updatedAt = parseEpoch(lesson.updatedAt);
  const resolvedCreatedAt = createdAt ?? updatedAt ?? 0;
  const resolvedUpdatedAt = updatedAt ?? createdAt ?? 0;
  return {
    id: lesson.id,
    userId,
    name: lesson.name,
    createdAt: resolvedCreatedAt,
    updatedAt: resolvedUpdatedAt,
    source: 'cloud',
  };
}

function normalizeCard(
  card: { id: string; frontText: string; backText: string; createdAt?: string | number },
  userId: string,
  lessonId: string
): Card {
  const createdAt = parseEpoch(card.createdAt) ?? Date.now();
  return {
    id: card.id,
    userId,
    folderId: lessonId,
    frontText: card.frontText,
    backText: card.backText,
    createdAt,
  };
}

export async function syncLessons(userId: string): Promise<void> {
  const remoteLessons = await fetchLessons();
  const normalized = remoteLessons.map((lesson) => normalizeLesson(lesson, userId));

  const localLessons = await getLessonsByUserId(userId);
  const localById = new Map(localLessons.map((lesson) => [lesson.id, lesson]));
  const remoteIds = new Set(normalized.map((lesson) => lesson.id));

  await bulkUpsertLessons(normalized);

  const staleLessonIds = localLessons
    .filter((lesson) => !remoteIds.has(lesson.id))
    .map((lesson) => lesson.id);
  if (staleLessonIds.length > 0) {
    await deleteLessons(userId, staleLessonIds);
  }

  const lessonsToSyncCards = normalized.filter((lesson) => {
    const local = localById.get(lesson.id);
    return !local || local.updatedAt !== lesson.updatedAt;
  });

  for (const lesson of lessonsToSyncCards) {
    await syncCards(userId, lesson.id);
  }
}

export async function syncCards(userId: string, lessonId: string): Promise<void> {
  const remoteCards = await fetchLessonCards(lessonId);
  const cards = remoteCards.map((card) => normalizeCard(card, userId, lessonId));
  await replaceCardsForLesson(userId, lessonId, cards);
}
