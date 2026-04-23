import { db } from '../database';
import type { TrainingAnswer } from '../types';

function generateId(): string {
  return crypto.randomUUID();
}

export async function createAnswer(
  data: Omit<TrainingAnswer, 'id'>
): Promise<TrainingAnswer> {
  const answer: TrainingAnswer = {
    ...data,
    id: generateId(),
  };
  await db.trainingAnswers.add(answer);
  return answer;
}

export async function getById(id: string): Promise<TrainingAnswer | undefined> {
  return db.trainingAnswers.get(id);
}

export async function getBySessionId(
  sessionId: string
): Promise<TrainingAnswer[]> {
  return db.trainingAnswers
    .where('sessionId')
    .equals(sessionId)
    .toArray();
}

export async function deleteAnswer(id: string): Promise<void> {
  await db.trainingAnswers.delete(id);
}

export async function deleteBySessionId(sessionId: string): Promise<void> {
  await db.trainingAnswers.where('sessionId').equals(sessionId).delete();
}
