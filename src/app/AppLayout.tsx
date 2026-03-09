import { Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import { useEffect, useState } from 'react';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import FolderIcon from '@mui/icons-material/Folder';
import UploadIcon from '@mui/icons-material/Upload';
import SchoolIcon from '@mui/icons-material/School';
import BarChartIcon from '@mui/icons-material/BarChart';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';

const navItems = [
  { path: '/folders', label: 'Lessons', icon: <FolderIcon /> },
  { path: '/import', label: 'Import', icon: <UploadIcon /> },
  { path: '/train', label: 'Train', icon: <SchoolIcon /> },
  { path: '/results', label: 'Results', icon: <BarChartIcon /> },
] as const;

export function AppLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const drawerWidth = 240;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const location = useLocation();
  const navigate = useNavigate();
  const username = useAuthStore((state) => state.username);
  const logout = useAuthStore((state) => state.logout);

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

  const navContent = (
    <List sx={{ width: 240, pt: 2 }}>
      {navItems.map(({ path, label, icon }) => (
        <ListItem key={path} disablePadding>
          <ListItemButton
            component={Link}
            to={path}
            selected={location.pathname === path}
            onClick={() => isMobile && setDrawerOpen(false)}
          >
            <ListItemIcon>{icon}</ListItemIcon>
            <ListItemText primary={label} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={isMobile ? {} : { width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px` }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open menu"
              edge="start"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            Flashcards
          </Typography>
          {username && (
            <>
              <Typography variant="body2" sx={{ mr: 1 }}>
                {username}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: isOnline ? 'success.main' : 'error.main',
                    mr: 0.75,
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  {isOnline ? 'Online' : 'Offline'}
                </Typography>
              </Box>
              <Button
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                size="small"
              >
                Logout
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
        >
          {navContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              position: 'fixed',
              top: '64px',
              height: 'calc(100vh - 64px)',
            },
          }}
        >
          {navContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          ml: isMobile ? 0 : `${drawerWidth}px`,
          mt: 0,
        }}
      >
        <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
