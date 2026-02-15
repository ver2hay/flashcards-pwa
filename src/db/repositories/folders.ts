import { db } from '../database';
import type { Folder } from '../types';

function generateId(): string {
  return crypto.randomUUID();
}

function now(): number {
  return Date.now();
}

export async function createFolder(
  data: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Folder> {
  const ts = now();
  const folder: Folder = {
    ...data,
    id: generateId(),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.folders.add(folder);
  return folder;
}

export async function getById(id: string): Promise<Folder | undefined> {
  return db.folders.get(id);
}

export async function getByUserId(userId: string): Promise<Folder[]> {
  return db.folders.where('userId').equals(userId).toArray();
}

export async function update(
  id: string,
  updates: Partial<Omit<Folder, 'id'>>
): Promise<void> {
  const withUpdated = { ...updates, updatedAt: now() };
  await db.folders.update(id, withUpdated);
}

export async function deleteFolder(id: string): Promise<void> {
  await db.transaction('rw', db.folders, db.cards, async () => {
    await db.cards.where('folderId').equals(id).delete();
    await db.folders.delete(id);
  });
}
