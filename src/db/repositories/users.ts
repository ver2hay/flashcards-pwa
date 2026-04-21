import { db } from '../database';
import type { User } from '../types';

function generateId(): string {
  return crypto.randomUUID();
}

function now(): number {
  return Date.now();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createUser(
  data: Omit<User, 'id' | 'createdAt'>
): Promise<User> {
  const user: User = {
    ...data,
    email: normalizeEmail(data.email),
    id: generateId(),
    createdAt: now(),
  };
  await db.users.add(user);
  return user;
}

export async function upsertUser(
  data: Omit<User, 'createdAt'> & { createdAt?: number }
): Promise<User> {
  const email = normalizeEmail(data.email);
  const existingById = await db.users.get(data.id);
  const existingByEmail = existingById ?? (await getByEmail(email));
  if (existingByEmail) {
    const merged: User = {
      ...existingByEmail,
      ...data,
      email,
      id: existingByEmail.id,
      createdAt: existingByEmail.createdAt,
    };
    await db.users.put(merged);
    return merged;
  }
  const user: User = {
    ...data,
    email,
    createdAt: data.createdAt ?? now(),
  };
  await db.users.put(user);
  return user;
}

export async function getById(id: string): Promise<User | undefined> {
  return db.users.get(id);
}

export async function getByEmail(email: string): Promise<User | undefined> {
  return db.users.where('email').equals(normalizeEmail(email)).first();
}

export async function getAll(): Promise<User[]> {
  return db.users.toArray();
}

export async function update(
  id: string,
  updates: Partial<Omit<User, 'id'>>
): Promise<void> {
  const patch = { ...updates };
  if (patch.email) patch.email = normalizeEmail(patch.email);
  await db.users.update(id, patch);
}

export async function deleteUser(id: string): Promise<void> {
  await db.users.delete(id);
}
