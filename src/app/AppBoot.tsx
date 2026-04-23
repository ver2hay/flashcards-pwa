import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { RouterProvider } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import { router } from './routes';
import { syncLessons } from '../services/syncService';

export function AppBoot() {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const hydrateFromStorage = useAuthStore((state) => state.hydrateFromStorage);
  const userId = useAuthStore((state) => state.userId);
  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (!isHydrated || !userId) return;
    const { revalidateOnline } = useAuthStore.getState();
    let cancelled = false;
    void (async () => {
      try {
        await revalidateOnline();
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      try {
        await syncLessons(userId);
      } catch (error) {
        if (!cancelled) {
          console.warn('Lesson sync failed', error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, userId]);

  if (!isHydrated) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          background:
            'linear-gradient(180deg, #E8F7FF 0%, #F7FFF2 40%, #FFFDF5 100%)',
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 3,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.25rem',
            boxShadow: '0 6px 0 #46A302',
          }}
        >
          FC
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Загрузка…
        </Typography>
      </Box>
    );
  }

  return <RouterProvider router={router} />;
}
