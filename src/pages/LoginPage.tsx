import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Link as MuiLink,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { useAuthStore } from '../features/auth/authStore';
import { requestEmailCode, verifyEmailCode } from '../services/cloudAuthApi';

type TabValue = 'login' | 'register';
type RegisterStep = 'form' | 'verify';
type ResetStep = 'email' | 'verify';

export function LoginPage() {
  const userId = useAuthStore((state) => state.userId);
  const login = useAuthStore((state) => state.login);
  const requestCode = useAuthStore((state) => state.requestCode);
  const confirmCode = useAuthStore((state) => state.confirmCode);
  const pending = useAuthStore((state) => state.pending);
  const clearPending = useAuthStore((state) => state.clearPending);
  const resendCode = useAuthStore((state) => state.resendCode);

  const [tab, setTab] = useState<TabValue>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [code, setCode] = useState('');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('form');

  const [mode, setMode] = useState<'auth' | 'reset'>('auth');
  const [resetStep, setResetStep] = useState<ResetStep>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetCode, setResetCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (userId) {
      navigate('/folders', { replace: true });
    }
  }, [userId, navigate]);

  useEffect(() => {
    if (pending && pending.purpose === 'register') {
      setTab('register');
      setRegisterStep('verify');
      setEmail(pending.email);
    }
  }, [pending]);

  const resetMessages = () => {
    setError(null);
    setInfo(null);
  };

  const handleTabChange = (_: React.SyntheticEvent, value: TabValue) => {
    setTab(value);
    resetMessages();
    setRegisterStep('form');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.success) navigate('/folders', { replace: true });
      else setError(res.error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (password !== passwordConfirm) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      const res = await requestCode(email, password, 'register');
      if (res.success) {
        setRegisterStep('verify');
        setInfo('Мы отправили код на вашу почту. Введите его ниже.');
      } else {
        setError(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await confirmCode(code);
      if (res.success) navigate('/folders', { replace: true });
      else setError(res.error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendRegisterCode = async () => {
    resetMessages();
    setLoading(true);
    try {
      const res = await resendCode();
      if (res.success) setInfo('Код отправлен повторно');
      else setError(res.error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToForm = () => {
    resetMessages();
    clearPending();
    setCode('');
    setRegisterStep('form');
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (resetPassword !== resetPasswordConfirm) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      await requestEmailCode(resetEmail, resetPassword, 'reset');
      setResetStep('verify');
      setInfo('Мы отправили код для сброса пароля на вашу почту.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      await verifyEmailCode(resetEmail, resetCode, 'reset');
      setInfo('Пароль обновлён. Теперь войдите с новым паролем.');
      setMode('auth');
      setTab('login');
      setEmail(resetEmail);
      setPassword('');
      setResetCode('');
      setResetPassword('');
      setResetPasswordConfirm('');
      setResetStep('email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  if (userId) return null;

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
            Регистрация с подтверждением по e-mail и облачная синхронизация
          </Typography>
        </Stack>

        <Card>
          <CardContent sx={{ p: 3 }}>
            {mode === 'auth' ? (
              <>
                <Tabs
                  value={tab}
                  onChange={handleTabChange}
                  variant="fullWidth"
                  sx={{ mb: 2, '& .MuiTab-root': { fontWeight: 800 } }}
                >
                  <Tab label="Вход" value="login" />
                  <Tab label="Регистрация" value="register" />
                </Tabs>

                {tab === 'login' && (
                  <Box component="form" onSubmit={handleLogin}>
                    <TextField
                      label="E-mail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      fullWidth
                      autoComplete="email"
                      margin="normal"
                      autoFocus
                    />
                    <TextField
                      label="Пароль"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      fullWidth
                      autoComplete="current-password"
                      margin="normal"
                    />
                    {error && (
                      <Typography color="error" variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
                        {error}
                      </Typography>
                    )}
                    {info && (
                      <Typography color="success.main" variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
                        {info}
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
                      Войти
                    </Button>
                    <Stack alignItems="center" sx={{ mt: 2 }}>
                      <MuiLink
                        component="button"
                        type="button"
                        onClick={() => {
                          resetMessages();
                          setMode('reset');
                          setResetStep('email');
                          setResetEmail(email);
                        }}
                        sx={{ fontWeight: 700 }}
                      >
                        Забыли пароль?
                      </MuiLink>
                    </Stack>
                  </Box>
                )}

                {tab === 'register' && registerStep === 'form' && (
                  <Box component="form" onSubmit={handleRequestRegister}>
                    <TextField
                      label="E-mail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      fullWidth
                      autoComplete="email"
                      margin="normal"
                      autoFocus
                    />
                    <TextField
                      label="Пароль (не короче 6 символов)"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      fullWidth
                      autoComplete="new-password"
                      margin="normal"
                    />
                    <TextField
                      label="Повторите пароль"
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      fullWidth
                      autoComplete="new-password"
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
                      Отправить код
                    </Button>
                  </Box>
                )}

                {tab === 'register' && registerStep === 'verify' && (
                  <Box component="form" onSubmit={handleVerifyRegister}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>
                      Код отправлен на {email}
                    </Typography>
                    <TextField
                      label="Код из письма"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      fullWidth
                      inputMode="numeric"
                      autoFocus
                      margin="normal"
                      inputProps={{ maxLength: 8 }}
                    />
                    {error && (
                      <Typography color="error" variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
                        {error}
                      </Typography>
                    )}
                    {info && (
                      <Typography color="success.main" variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
                        {info}
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
                      Подтвердить
                    </Button>
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
                      <MuiLink component="button" type="button" onClick={handleBackToForm} sx={{ fontWeight: 700 }}>
                        Назад
                      </MuiLink>
                      <MuiLink
                        component="button"
                        type="button"
                        onClick={handleResendRegisterCode}
                        sx={{ fontWeight: 700 }}
                        disabled={loading}
                      >
                        Отправить код снова
                      </MuiLink>
                    </Stack>
                  </Box>
                )}
              </>
            ) : (
              <>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                  Смена пароля
                </Typography>
                {resetStep === 'email' && (
                  <Box component="form" onSubmit={handleResetRequest}>
                    <TextField
                      label="E-mail"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      fullWidth
                      margin="normal"
                      autoFocus
                    />
                    <TextField
                      label="Новый пароль"
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      fullWidth
                      autoComplete="new-password"
                      margin="normal"
                    />
                    <TextField
                      label="Повторите новый пароль"
                      type="password"
                      value={resetPasswordConfirm}
                      onChange={(e) => setResetPasswordConfirm(e.target.value)}
                      fullWidth
                      autoComplete="new-password"
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
                      Отправить код
                    </Button>
                    <Stack alignItems="center" sx={{ mt: 2 }}>
                      <MuiLink
                        component="button"
                        type="button"
                        onClick={() => {
                          resetMessages();
                          setMode('auth');
                        }}
                        sx={{ fontWeight: 700 }}
                      >
                        Назад ко входу
                      </MuiLink>
                    </Stack>
                  </Box>
                )}
                {resetStep === 'verify' && (
                  <Box component="form" onSubmit={handleResetConfirm}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>
                      Код отправлен на {resetEmail}
                    </Typography>
                    <TextField
                      label="Код из письма"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      fullWidth
                      inputMode="numeric"
                      autoFocus
                      margin="normal"
                      inputProps={{ maxLength: 8 }}
                    />
                    {error && (
                      <Typography color="error" variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
                        {error}
                      </Typography>
                    )}
                    {info && (
                      <Typography color="success.main" variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
                        {info}
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
                      Сменить пароль
                    </Button>
                    <Stack alignItems="center" sx={{ mt: 2 }}>
                      <MuiLink
                        component="button"
                        type="button"
                        onClick={() => {
                          resetMessages();
                          setResetStep('email');
                        }}
                        sx={{ fontWeight: 700 }}
                      >
                        Назад
                      </MuiLink>
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
