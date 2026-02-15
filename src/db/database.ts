import Dexie, { type EntityTable } from 'dexie';
import type {
  User,
  Folder,
  Card,
  TrainingSession,
  TrainingAnswer,
} from './types';

/**
 * Typed Dexie database for the flashcards PWA.
 * All data is local-only (IndexedDB); no backend.
 */
export class FlashcardsDB extends Dexie {
  users!: EntityTable<User, 'id'>;
  folders!: EntityTable<Folder, 'id'>;
  cards!: EntityTable<Card, 'id'>;
  trainingSessions!: EntityTable<TrainingSession, 'id'>;
  trainingAnswers!: EntityTable<TrainingAnswer, 'id'>;

  constructor() {
    super('FlashcardsDB');
    this.version(1).stores({
      users: 'id, &username',
      folders: 'id, userId, createdAt, updatedAt',
      cards: 'id, userId, folderId, createdAt',
      trainingSessions: 'id, userId, startedAt, finishedAt',
      trainingAnswers: 'id, sessionId, cardId',
    });
  }
}

export const db = new FlashcardsDB();
