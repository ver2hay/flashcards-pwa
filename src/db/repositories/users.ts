import { db } from '../database';
import type { User } from '../types';

function generateId(): string {
  return crypto.randomUUID();
}

function now(): number {
  return Date.now();
}

export async function createUser(
  data: Omit<User, 'id' | 'createdAt'>
): Promise<User> {
  const user: User = {
    ...data,
    id: generateId(),
    createdAt: now(),
  };
  await db.users.add(user);
  return user;
}

export async function getById(id: string): Promise<User | undefined> {
  return db.users.get(id);
}

export async function getByUsername(username: string): Promise<User | undefined> {
  return db.users.where('username').equals(username).first();
}

export async function getAll(): Promise<User[]> {
  return db.users.toArray();
}

export async function update(
  id: string,
  updates: Partial<Omit<User, 'id'>>
): Promise<void> {
  await db.users.update(id, updates);
}

export async function deleteUser(id: string): Promise<void> {
  await db.users.delete(id);
}
