import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  IconButton,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  listAdminUsers,
  createAdminUser,
  setUserRole,
  deleteAdminUser,
  type UserRole,
} from '../services/adminApi';
import { isCloudApiConfigured } from '../services/lessonsApi';
import { useAuthStore } from '../features/auth/authStore';

export function AdminPage() {
  const myId = useAuthStore((s) => s.userId);
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof listAdminUsers>>
  >([]);
  const [err, setErr] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');

  const load = useCallback(async () => {
    if (!isCloudApiConfigured) {
      setErr('API не настроен');
      return;
    }
    setErr(null);
    try {
      setRows(await listAdminUsers());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось загрузить');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    setErr(null);
    if (!newEmail.trim() || newPassword.length < 6) {
      setErr('E-mail и пароль (от 6 символов)');
      return;
    }
    try {
      await createAdminUser(newEmail.trim().toLowerCase(), newPassword, newRole);
      setNewEmail('');
      setNewPassword('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 800, mb: 0.5 }}>
          Администрирование
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          Пользователи, роли, удаление учётных записей.
        </Typography>
      </Box>

      {err && (
        <Alert severity="error" onClose={() => setErr(null)}>
          {err}
        </Alert>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
        Новый пользователь
      </Typography>
      <Stack spacing={1.5} useFlexGap flexDirection={{ xs: 'column', sm: 'row' }}>
        <TextField
          label="E-mail"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          label="Пароль"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          size="small"
          fullWidth
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Роль</InputLabel>
          <Select
            value={newRole}
            label="Роль"
            onChange={(e) => setNewRole(e.target.value as UserRole)}
          >
            <MenuItem value="user">Пользователь</MenuItem>
            <MenuItem value="admin">Админ</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" onClick={() => void handleAdd()}>
          Добавить
        </Button>
      </Stack>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, pt: 1 }}>
        Пользователи
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 800 }}>E-mail</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Роль</TableCell>
            <TableCell align="right" sx={{ fontWeight: 800 }}>
              Действия
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <FormControl size="small" fullWidth>
                  <Select
                    value={u.role}
                    onChange={async (e) => {
                      const v = e.target.value as UserRole;
                      try {
                        await setUserRole(u.id, v);
                        await load();
                      } catch (ex) {
                        setErr(
                          ex instanceof Error ? ex.message : 'Не удалось сменить роль'
                        );
                      }
                    }}
                  >
                    <MenuItem value="user">Пользователь</MenuItem>
                    <MenuItem value="admin">Админ</MenuItem>
                  </Select>
                </FormControl>
              </TableCell>
              <TableCell align="right">
                <IconButton
                  aria-label="Удалить"
                  disabled={u.id === myId}
                  onClick={async () => {
                    if (u.id === myId) return;
                    if (!window.confirm(`Удалить ${u.email}?`)) return;
                    try {
                      await deleteAdminUser(u.id);
                      await load();
                    } catch (ex) {
                      setErr(ex instanceof Error ? ex.message : 'Ошибка удаления');
                    }
                  }}
                >
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}
