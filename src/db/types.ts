/**
 * Strict entity types for the local Dexie database.
 * All ids are string; date fields are epoch ms (number).
 */

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Lesson {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Card {
  id: string;
  userId: string;
  folderId: string;
  frontText: string;
  backText: string;
  createdAt: number;
}

export type TrainingMode = 'exact' | 'multiple_choice' | 'learn' | 'review' | 'test';

export interface TrainingSession {
  id: string;
  userId: string;
  mode: TrainingMode;
  startedAt: number;
  finishedAt: number | null;
  score: number | null;
}

export interface TrainingAnswer {
  id: string;
  sessionId: string;
  cardId: string;
  userAnswer: string;
  isCorrect: boolean;
}
