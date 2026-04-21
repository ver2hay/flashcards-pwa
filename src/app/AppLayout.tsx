import { Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Container,
  IconButton,
  Paper,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FolderCopyRoundedIcon from '@mui/icons-material/FolderCopyRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';

const navItems = [
  { path: '/folders', label: 'Папки', icon: FolderCopyRoundedIcon },
  { path: '/import', label: 'Импорт', icon: CloudUploadRoundedIcon },
  { path: '/train', label: 'Урок', icon: SchoolRoundedIcon },
  { path: '/results', label: 'Статистика', icon: BarChartRoundedIcon },
] as const;

export function AppLayout() {
  const theme = useTheme();
  const isWide = useMediaQuery(theme.breakpoints.up('md'));
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const location = useLocation();
  const navigate = useNavigate();
  const username = useAuthStore((state) => state.username);
  const logout = useAuthStore((state) => state.logout);

  const navValue = Math.max(
    0,
    navItems.findIndex((n) => location.pathname.startsWith(n.path))
  );

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        pb: { xs: 9, md: 3 },
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 40,
              height: 40,
              fontWeight: 800,
              fontSize: '1.1rem',
            }}
          >
            FC
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              Карточки
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              Учись как в Duolingo — весело и каждый день
            </Typography>
          </Box>
          {username && (
            <>
              <Box sx={{ textAlign: 'right', mr: 0.5, display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {username}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    color: isOnline ? 'success.dark' : 'error.main',
                  }}
                >
                  {isOnline ? 'Онлайн' : 'Оффлайн'}
                </Typography>
              </Box>
              <IconButton
                color="inherit"
                onClick={handleLogout}
                aria-label="Выйти"
                sx={{ color: 'text.secondary' }}
              >
                <LogoutRoundedIcon />
              </IconButton>
            </>
          )}
        </Toolbar>
      </AppBar>

      {isWide && (
        <Paper
          elevation={0}
          sx={{
            mx: 2,
            mt: 2,
            mb: 0,
            borderRadius: 3,
            border: '2px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          {navItems.map(({ path, label, icon: Icon }) => (
            <Box
              key={path}
              component={Link}
              to={path}
              sx={{
                flex: 1,
                py: 1.5,
                textDecoration: 'none',
                textAlign: 'center',
                fontWeight: 800,
                color:
                  location.pathname.startsWith(path) ? 'primary.dark' : 'text.secondary',
                bgcolor: location.pathname.startsWith(path) ? 'rgba(88,204,2,0.12)' : 'transparent',
                borderBottom:
                  location.pathname.startsWith(path) ? '4px solid' : '4px solid transparent',
                borderColor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}
            >
              <Icon fontSize="small" />
              {label}
            </Box>
          ))}
        </Paper>
      )}

      <Box component="main" sx={{ flexGrow: 1, pt: 2 }}>
        <Container maxWidth="sm" sx={{ px: { xs: 2, sm: 3 }, py: 1 }}>
          <Outlet />
        </Container>
      </Box>

      {!isWide && (
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (t) => t.zIndex.drawer,
            borderTop: '2px solid',
            borderColor: 'divider',
            borderRadius: 0,
            pb: 'env(safe-area-inset-bottom)',
          }}
          elevation={8}
        >
          <BottomNavigation
            showLabels
            value={navValue >= 0 ? navValue : 0}
            sx={{
              '& .MuiBottomNavigationAction-root': {
                minWidth: 56,
                py: 1,
                fontWeight: 800,
              },
              '& .Mui-selected': { color: 'primary.dark' },
            }}
          >
            {navItems.map(({ path, label, icon: Icon }, idx) => (
              <BottomNavigationAction
                key={path}
                label={label}
                icon={<Icon />}
                value={idx}
                component={Link}
                to={path}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
