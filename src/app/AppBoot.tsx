import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { RouterProvider } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import { router } from './routes';

export function AppBoot() {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const hydrateFromStorage = useAuthStore((state) => state.hydrateFromStorage);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

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
