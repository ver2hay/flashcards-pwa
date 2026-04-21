import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { useAuthStore } from '../features/auth/authStore';

type TabValue = 'login' | 'register';

export function LoginPage() {
  const userId = useAuthStore((state) => state.userId);
  const [tab, setTab] = useState<TabValue>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);

  useEffect(() => {
    if (userId) {
      navigate('/folders', { replace: true });
    }
  }, [userId, navigate]);

  const handleTabChange = (_: React.SyntheticEvent, value: TabValue) => {
    setTab(value);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    if (!trimmedUsername || !trimmedPassword) {
      setError('Введите имя и пароль');
      return;
    }
    setLoading(true);
    try {
      const result =
        tab === 'login'
          ? await login(trimmedUsername, trimmedPassword)
          : await register(trimmedUsername, trimmedPassword);
      if (result.success) {
        navigate('/folders', { replace: true });
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (userId) {
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        px: 2,
      }}
    >
      <Container maxWidth="xs">
        <Stack spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: 4,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 0 #46A302',
            }}
          >
            <EmojiEventsRoundedIcon sx={{ fontSize: 40 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, textAlign: 'center' }}>
            Карточки
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, textAlign: 'center' }}>
            Локальный аккаунт + синхронизация с облаком, если настроен API
          </Typography>
        </Stack>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Tabs
              value={tab}
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{ mb: 2, '& .MuiTab-root': { fontWeight: 800 } }}
            >
              <Tab label="Вход" value="login" />
              <Tab label="Регистрация" value="register" />
            </Tabs>
            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                label="Имя пользователя"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                autoComplete="username"
                margin="normal"
                autoFocus
              />
              <TextField
                label="Пароль"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                margin="normal"
              />
              {error && (
                <Typography color="error" variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
                  {error}
                </Typography>
              )}
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loading}
                size="large"
                sx={{ mt: 3 }}
              >
                {tab === 'login' ? 'Войти' : 'Создать аккаунт'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
