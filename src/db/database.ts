import Dexie, { type EntityTable } from 'dexie';
import type {
  User,
  Folder,
  Lesson,
  Card,
  LessonFile,
  TrainingSession,
  TrainingAnswer,
} from './types';

/**
 * Typed Dexie database for the flashcards PWA.
 * Lessons and cards are cached locally for offline use.
 */
export class FlashcardsDB extends Dexie {
  users!: EntityTable<User, 'id'>;
  folders!: EntityTable<Folder, 'id'>;
  lessons!: EntityTable<Lesson, 'id'>;
  cards!: EntityTable<Card, 'id'>;
  trainingSessions!: EntityTable<TrainingSession, 'id'>;
  trainingAnswers!: EntityTable<TrainingAnswer, 'id'>;
  lessonFiles!: EntityTable<LessonFile, 'id'>;

  constructor() {
    super('FlashcardsDB');
    this.version(1).stores({
      users: 'id, &username',
      folders: 'id, userId, createdAt, updatedAt',
      cards: 'id, userId, folderId, createdAt',
      trainingSessions: 'id, userId, startedAt, finishedAt',
      trainingAnswers: 'id, sessionId, cardId',
    });

    this.version(2).stores({
      users: 'id, &username',
      folders: 'id, userId, createdAt, updatedAt',
      lessons: 'id, userId, updatedAt',
      cards: 'id, userId, folderId, createdAt',
      trainingSessions: 'id, userId, startedAt, finishedAt',
      trainingAnswers: 'id, sessionId, cardId',
    });

    this.version(3)
      .stores({
        users: 'id, &username',
        folders: 'id, userId, createdAt, updatedAt',
        lessons: 'id, userId, updatedAt, source',
        cards: 'id, userId, folderId, createdAt',
        trainingSessions: 'id, userId, startedAt, finishedAt',
        trainingAnswers: 'id, sessionId, cardId',
      })
      .upgrade((tx) =>
        tx
          .table('lessons')
          .toCollection()
          .modify((lesson: { source?: string }) => {
            if (!lesson.source) {
              lesson.source = 'cloud';
            }
          })
      );

    this.version(4).stores({
      users: 'id, &username',
      folders: 'id, userId, createdAt, updatedAt',
      lessons: 'id, userId, updatedAt, source',
      cards: 'id, userId, folderId, createdAt',
      trainingSessions: 'id, userId, startedAt, finishedAt',
      trainingAnswers: 'id, sessionId, cardId',
      lessonFiles: 'id, userId, lessonId, createdAt',
    });

    this.version(5)
      .stores({
        users: 'id, &email',
        folders: 'id, userId, createdAt, updatedAt',
        lessons: 'id, userId, updatedAt, source',
        cards: 'id, userId, folderId, createdAt',
        trainingSessions: 'id, userId, startedAt, finishedAt',
        trainingAnswers: 'id, sessionId, cardId',
        lessonFiles: 'id, userId, lessonId, createdAt',
      })
      .upgrade((tx) =>
        tx
          .table('users')
          .toCollection()
          .modify(
            (user: {
              email?: string;
              username?: string;
              emailVerified?: boolean;
            }) => {
              if (!user.email) {
                const legacy = user.username;
                if (legacy && legacy.includes('@')) {
                  user.email = legacy.toLowerCase();
                } else if (legacy) {
                  user.email = `${legacy.toLowerCase()}@local`;
                }
              }
              if (typeof user.emailVerified !== 'boolean') {
                user.emailVerified = true;
              }
              delete user.username;
            }
          )
      );

    this.version(6)
      .stores({
        users: 'id, &email',
        folders: 'id, userId, createdAt, updatedAt',
        lessons: 'id, userId, updatedAt, source',
        cards: 'id, userId, folderId, createdAt',
        trainingSessions: 'id, userId, startedAt, finishedAt',
        trainingAnswers: 'id, sessionId, cardId',
        lessonFiles: 'id, userId, lessonId, createdAt',
      });
  }
}

export const db = new FlashcardsDB();
