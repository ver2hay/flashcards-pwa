import { fetchLessonCards, fetchLessons, isCloudApiConfigured } from './lessonsApi';
import { listLessonFiles, downloadLessonFile } from './filesApi';
import type { Lesson, Card, LessonFile } from '../db';
import {
  getLessonsByUserId,
  bulkUpsertLessons,
  deleteLessons,
  replaceCardsForLesson,
  getLessonFilesByLessonId,
  upsertLessonFiles,
} from '../db';
import { getCloudToken } from '../features/cloud/cloudAuth';

/** Срабатывает после syncLessons (успех/частичный сбой), чтобы UI перечитал Dexie. */
export const LESSONS_SYNCED_EVENT = 'flashcards:lessons-synced';

function notifyLessonsSynced(userId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(LESSONS_SYNCED_EVENT, { detail: { userId } })
  );
}

function parseEpoch(value?: string | number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeLesson(
  lesson: {
    id: string;
    name: string;
    createdAt?: string | number;
    updatedAt?: string | number;
    createdBy?: string;
    public?: boolean;
    publicSortOrder?: number;
  },
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
    cloudCreatedBy: lesson.createdBy,
    isPublic: lesson.public === true,
    publicSortOrder:
      typeof lesson.publicSortOrder === 'number' ? lesson.publicSortOrder : undefined,
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

export async function syncLessonFiles(userId: string): Promise<void> {
  if (!isCloudApiConfigured || !getCloudToken()) return;
  const lessons = await getLessonsByUserId(userId);
  const cloudLessons = lessons.filter((l) => l.source === 'cloud');
  for (const lesson of cloudLessons) {
    let remote: Awaited<ReturnType<typeof listLessonFiles>>;
    try {
      remote = await listLessonFiles(lesson.id);
    } catch (e) {
      console.warn('[Sync] lesson files list failed', lesson.id, e);
      continue;
    }
    const local = await getLessonFilesByLessonId(lesson.id);
    const byId = new Map(local.map((f) => [f.id, f]));
    for (const r of remote) {
      const existing = byId.get(r.id);
      if (existing?.blob && existing.size === r.size) continue;
      try {
        const blob = await downloadLessonFile(lesson.id, r.id);
        const row: LessonFile = {
          id: r.id,
          userId,
          lessonId: lesson.id,
          name: r.name,
          mimeType: r.mimeType,
          size: r.size,
          createdAt: parseEpoch(r.createdAt) ?? Date.now(),
          blob,
        };
        await upsertLessonFiles([row]);
        console.log('[Sync] file cached', r.id, r.name);
      } catch (e) {
        console.warn('[Sync] file download failed', r.id, e);
      }
    }
  }
}

export async function syncLessons(userId: string): Promise<void> {
  try {
    let remoteLessons: Awaited<ReturnType<typeof fetchLessons>>;
    try {
      remoteLessons = await fetchLessons();
    } catch (e) {
      console.warn('[Sync] remote lessons failed (offline or auth)', e);
      return;
    }
    console.log('[Sync] remote lessons', remoteLessons.length);
    const normalized = remoteLessons.map((lesson) => normalizeLesson(lesson, userId));

    const localLessons = await getLessonsByUserId(userId);
    const localById = new Map(localLessons.map((lesson) => [lesson.id, lesson]));
    const remoteIds = new Set(normalized.map((lesson) => lesson.id));

    await bulkUpsertLessons(normalized);
    console.log('[Sync] lessons upserted', normalized.length);

    const staleLessonIds = localLessons
      .filter((lesson) => lesson.source === 'cloud' && !remoteIds.has(lesson.id))
      .map((lesson) => lesson.id);
    if (staleLessonIds.length > 0) {
      await deleteLessons(userId, staleLessonIds);
    }

    const lessonsToSyncCards = normalized.filter((lesson) => {
      const local = localById.get(lesson.id);
      return !local || local.updatedAt !== lesson.updatedAt;
    });

    for (const lesson of lessonsToSyncCards) {
      try {
        await syncCards(userId, lesson.id);
      } catch (e) {
        console.warn('[Sync] cards failed', lesson.id, e);
      }
    }

    try {
      await syncLessonFiles(userId);
    } catch (e) {
      console.warn('[Sync] lesson files failed', e);
    }
  } finally {
    notifyLessonsSynced(userId);
  }
}

export async function syncCards(userId: string, lessonId: string): Promise<void> {
  const remoteCards = await fetchLessonCards(lessonId);
  console.log('[Sync] remote cards', lessonId, remoteCards.length);
  const cards = remoteCards.map((card) => normalizeCard(card, userId, lessonId));
  await replaceCardsForLesson(userId, lessonId, cards);
  console.log('[Sync] cards replaced', lessonId, cards.length);
}
