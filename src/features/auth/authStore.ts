import { create } from 'zustand';
import { getByEmail, upsertUser, getUserById } from '../../db';
import { hashPassword } from './password';
import {
  getSessionUserId,
  setSessionUserId,
  clearSessionUserId,
} from './session';
import {
  setCloudToken,
  clearCloudToken,
  getCloudToken,
} from '../cloud/cloudAuth';
import { isCloudApiConfigured } from '../../services/lessonsApi';
import {
  fetchMe,
  loginToCloud,
  requestEmailCode,
  verifyEmailCode,
  type MeResponse,
} from '../../services/cloudAuthApi';

export type AuthError = { success: false; error: string };
export type AuthSuccess = { success: true };
export type AuthResult = AuthError | AuthSuccess;

export type PendingPurpose = 'register' | 'reset';

type PendingAuth = {
  email: string;
  password: string;
  purpose: PendingPurpose;
} | null;

export type AppUserRole = 'admin' | 'user' | null;

function roleFromMe(me: MeResponse): AppUserRole {
  return me.role === 'admin' ? 'admin' : 'user';
}

interface AuthState {
  userId: string | null;
  email: string | null;
  role: AppUserRole;
  isHydrated: boolean;
  isOnline: boolean;
  sessionExpired: boolean;
  pending: PendingAuth;

  hydrateFromStorage: () => Promise<void>;
  requestCode: (
    email: string,
    password: string,
    purpose: PendingPurpose
  ) => Promise<AuthResult>;
  confirmCode: (code: string) => Promise<AuthResult>;
  resendCode: () => Promise<AuthResult>;
  clearPending: () => void;
  login: (email: string, password: string) => Promise<AuthResult>;
  reauthenticate: (password: string) => Promise<AuthResult>;
  revalidateOnline: () => Promise<void>;
  setOnlineStatus: (online: boolean) => void;
  logout: () => void;
  syncRoleFromServer: () => Promise<void>;
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  userId: null,
  email: null,
  role: null,
  isHydrated: false,
  isOnline: isOnline(),
  sessionExpired: false,
  pending: null,

  syncRoleFromServer: async () => {
    if (!isCloudApiConfigured || !getCloudToken()) return;
    try {
      const me = await fetchMe();
      set({ role: roleFromMe(me) });
    } catch {
      /* keep previous role */
    }
  },

  hydrateFromStorage: async () => {
    const id = getSessionUserId();
    if (!id) {
      set({ userId: null, email: null, role: null, isHydrated: true });
      return;
    }
    const user = await getUserById(id);
    if (!user) {
      clearSessionUserId();
      clearCloudToken();
      set({ userId: null, email: null, role: null, isHydrated: true });
      return;
    }
    const token = getCloudToken();
    set({
      userId: user.id,
      email: user.email,
      isHydrated: true,
      sessionExpired: !token && isCloudApiConfigured && isOnline(),
    });
    if (token && isCloudApiConfigured) {
      void get().syncRoleFromServer();
    } else {
      set({ role: null });
    }
  },

  requestCode: async (email, password, purpose) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return { success: false, error: 'Введите корректный e-mail' };
    }
    if (!password || password.length < 6) {
      return {
        success: false,
        error: 'Пароль должен быть не короче 6 символов',
      };
    }
    if (!isCloudApiConfigured) {
      return {
        success: false,
        error: 'Облачный API не настроен. Регистрация невозможна.',
      };
    }
    if (!isOnline()) {
      return {
        success: false,
        error: 'Нет подключения к сети. Для регистрации нужен интернет.',
      };
    }
    try {
      await requestEmailCode(normalized, password, purpose);
      set({ pending: { email: normalized, password, purpose } });
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Не удалось отправить код',
      };
    }
  },

  resendCode: async () => {
    const pending = get().pending;
    if (!pending) return { success: false, error: 'Нет ожидающей регистрации' };
    return get().requestCode(pending.email, pending.password, pending.purpose);
  },

  confirmCode: async (code) => {
    const pending = get().pending;
    if (!pending) return { success: false, error: 'Нет ожидающей регистрации' };
    const cleanCode = code.trim();
    if (!/^\d{4,8}$/.test(cleanCode)) {
      return { success: false, error: 'Код должен быть числовым' };
    }
    try {
      const res = await verifyEmailCode(
        pending.email,
        cleanCode,
        pending.purpose
      );
      setCloudToken(res.token);
      const passwordHash = await hashPassword(pending.password);
      const user = await upsertUser({
        id: res.userId,
        email: res.email,
        passwordHash,
        emailVerified: true,
      });
      setSessionUserId(user.id);
      let nextRole: AppUserRole = 'user';
      try {
        const me = await fetchMe();
        nextRole = roleFromMe(me);
      } catch {
        nextRole = 'user';
      }
      set({
        userId: user.id,
        email: user.email,
        role: nextRole,
        pending: null,
        sessionExpired: false,
      });
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Неверный код',
      };
    }
  },

  clearPending: () => set({ pending: null }),

  login: async (email, password) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) {
      return { success: false, error: 'Введите e-mail и пароль' };
    }
    const online = isOnline();
    const passwordHash = await hashPassword(password);

    if (isCloudApiConfigured && online) {
      try {
        const res = await loginToCloud(normalized, password);
        setCloudToken(res.token);
        const user = await upsertUser({
          id: res.userId,
          email: res.email,
          passwordHash,
          emailVerified: true,
        });
        setSessionUserId(user.id);
        let nextRole: AppUserRole = 'user';
        try {
          const me = await fetchMe();
          nextRole = roleFromMe(me);
        } catch {
          nextRole = 'user';
        }
        set({
          userId: user.id,
          email: user.email,
          role: nextRole,
          sessionExpired: false,
        });
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Не удалось войти',
        };
      }
    }

    // Offline path: verify against cached hash
    const cached = await getByEmail(normalized);
    if (!cached || cached.passwordHash !== passwordHash) {
      return {
        success: false,
        error: online
          ? 'Неверный e-mail или пароль'
          : 'Нет сети. Вход доступен только с ранее сохранённым паролем.',
      };
    }
    setSessionUserId(cached.id);
    set({
      userId: cached.id,
      email: cached.email,
      role: null,
      sessionExpired: false,
    });
    return { success: true };
  },

  reauthenticate: async (password) => {
    const currentEmail = get().email;
    if (!currentEmail) {
      return { success: false, error: 'Не найдена активная сессия' };
    }
    return get().login(currentEmail, password);
  },

  revalidateOnline: async () => {
    if (!isCloudApiConfigured) return;
    if (!isOnline()) return;
    const { userId } = get();
    if (!userId) return;
    const token = getCloudToken();
    if (!token) {
      set({ sessionExpired: true });
      return;
    }
    try {
      const me = await fetchMe();
      set({ sessionExpired: false, role: roleFromMe(me) });
    } catch {
      clearCloudToken();
      set({ sessionExpired: true });
    }
  },

  setOnlineStatus: (online) => {
    set({ isOnline: online });
    if (online) {
      void get().revalidateOnline();
    }
  },

  logout: () => {
    clearSessionUserId();
    clearCloudToken();
    set({
      userId: null,
      email: null,
      role: null,
      pending: null,
      sessionExpired: false,
    });
  },
}));
