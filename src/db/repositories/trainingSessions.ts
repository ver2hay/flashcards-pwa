import { db } from '../database';
import type { TrainingSession, TrainingMode } from '../types';

function generateId(): string {
  return crypto.randomUUID();
}

function now(): number {
  return Date.now();
}

export async function createSession(
  data: Omit<TrainingSession, 'id' | 'startedAt' | 'finishedAt' | 'score'> & {
    mode: TrainingMode;
  }
): Promise<TrainingSession> {
  const session: TrainingSession = {
    ...data,
    id: generateId(),
    startedAt: now(),
    finishedAt: null,
    score: null,
  };
  await db.trainingSessions.add(session);
  return session;
}

export async function getById(
  id: string
): Promise<TrainingSession | undefined> {
  return db.trainingSessions.get(id);
}

export async function getByUserId(
  userId: string
): Promise<TrainingSession[]> {
  const sessions = await db.trainingSessions
    .where('userId')
    .equals(userId)
    .toArray();
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

export async function update(
  id: string,
  updates: Partial<Omit<TrainingSession, 'id'>>
): Promise<void> {
  await db.trainingSessions.update(id, updates);
}

export async function deleteSession(id: string): Promise<void> {
  await db.trainingSessions.delete(id);
}
