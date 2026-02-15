// Database instance and schema
export { db, FlashcardsDB } from './database';

// Entity and shared types
export type {
  User,
  Folder,
  Card,
  TrainingSession,
  TrainingAnswer,
  TrainingMode,
} from './types';

// Users repository
export {
  createUser,
  getById as getUserById,
  getByUsername,
  getAll as getAllUsers,
  update as updateUser,
  deleteUser,
} from './repositories/users';

// Folders repository
export {
  createFolder,
  getById as getFolderById,
  getByUserId as getFoldersByUserId,
  update as updateFolder,
  deleteFolder,
} from './repositories/folders';

// Cards repository
export {
  createCard,
  bulkCreateCards,
  getById as getCardById,
  getByFolderId as getCardsByFolderId,
  getByUserId as getCardsByUserId,
  update as updateCard,
  deleteCard,
} from './repositories/cards';

// Training sessions repository
export {
  createSession,
  getById as getSessionById,
  getByUserId as getSessionsByUserId,
  update as updateSession,
  deleteSession,
} from './repositories/trainingSessions';

// Training answers repository
export {
  createAnswer,
  getById as getAnswerById,
  getBySessionId as getAnswersBySessionId,
  deleteAnswer,
} from './repositories/trainingAnswers';
