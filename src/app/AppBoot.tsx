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
    let cancelled = false;
    syncLessons(userId).catch((error) => {
      if (cancelled) return;
      console.warn('Lesson sync failed', error);
    });
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
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h6" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  return <RouterProvider router={router} />;
}
