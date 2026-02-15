import { create } from 'zustand';
import { getByUsername, createUser, getUserById } from '../../db';
import { hashPassword } from './password';
import {
  getSessionUserId,
  setSessionUserId,
  clearSessionUserId,
} from './session';

export type AuthError = { success: false; error: string };
export type AuthSuccess = { success: true };
export type AuthResult = AuthError | AuthSuccess;

interface AuthState {
  userId: string | null;
  username: string | null;
  isHydrated: boolean;
  hydrateFromStorage: () => Promise<void>;
  register: (
    username: string,
    password: string
  ) => Promise<AuthResult>;
  login: (username: string, password: string) => Promise<AuthResult>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  username: null,
  isHydrated: false,

  hydrateFromStorage: async () => {
    const id = getSessionUserId();
    if (!id) {
      set({ userId: null, username: null, isHydrated: true });
      return;
    }
    const user = await getUserById(id);
    if (!user) {
      clearSessionUserId();
      set({ userId: null, username: null, isHydrated: true });
      return;
    }
    set({
      userId: user.id,
      username: user.username,
      isHydrated: true,
    });
  },

  register: async (
    username: string,
    password: string
  ): Promise<AuthResult> => {
    const existing = await getByUsername(username);
    if (existing) {
      return { success: false, error: 'Username already taken' };
    }
    const passwordHash = await hashPassword(password);
    const user = await createUser({ username, passwordHash });
    setSessionUserId(user.id);
    set({ userId: user.id, username: user.username });
    return { success: true };
  },

  login: async (
    username: string,
    password: string
  ): Promise<AuthResult> => {
    const user = await getByUsername(username);
    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }
    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.passwordHash) {
      return { success: false, error: 'Invalid username or password' };
    }
    setSessionUserId(user.id);
    set({ userId: user.id, username: user.username });
    return { success: true };
  },

  logout: () => {
    clearSessionUserId();
    set({ userId: null, username: null });
  },
}));
