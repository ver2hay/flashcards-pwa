import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
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
      setError('Please enter username and password');
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
        py: 3,
      }}
    >
      <Container maxWidth="xs">
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h5" component="h1" align="center" gutterBottom>
            Flashcards
          </Typography>
          <Tabs
            value={tab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ mb: 2 }}
          >
            <Tab label="Login" value="login" />
            <Tab label="Register" value="register" />
          </Tabs>
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              autoComplete="username"
              margin="normal"
              autoFocus
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              margin="normal"
            />
            {error && (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{ mt: 3 }}
            >
              {tab === 'login' ? 'Login' : 'Register'}
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
