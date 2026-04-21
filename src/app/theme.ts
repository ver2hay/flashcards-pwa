import { createTheme } from '@mui/material/styles';

/** Duolingo-inspired: bright green, rounded UI, friendly type. */
export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#58CC02', dark: '#46A302', light: '#89E219', contrastText: '#FFFFFF' },
    secondary: { main: '#1CB0F6', dark: '#1899D6', contrastText: '#FFFFFF' },
    warning: { main: '#FF9600' },
    error: { main: '#FF4B4B' },
    success: { main: '#58CC02' },
    background: {
      default: '#F0F9FF',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#3C3C3C',
      secondary: '#777777',
    },
    divider: '#E5E5E5',
  },
  typography: {
    fontFamily: '"Nunito", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.02em' },
    h2: { fontWeight: 800, fontSize: '1.45rem' },
    h3: { fontWeight: 800, fontSize: '1.2rem' },
    h5: { fontWeight: 800 },
    h6: { fontWeight: 800 },
    button: { fontWeight: 800, textTransform: 'none' as const },
    body1: { fontWeight: 600 },
    body2: { fontWeight: 600 },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minHeight: '100vh',
          margin: 0,
          background:
            'linear-gradient(180deg, #E8F7FF 0%, #F7FFF2 35%, #FFFDF5 100%)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 16,
          padding: '12px 20px',
          fontSize: '1rem',
        },
        containedPrimary: {
          boxShadow: '0 4px 0 #46A302',
          '&:hover': { boxShadow: '0 4px 0 #46A302' },
          '&:active': { transform: 'translateY(2px)', boxShadow: '0 2px 0 #46A302' },
        },
        outlined: {
          borderWidth: 2,
          '&:hover': { borderWidth: 2 },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 20,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          border: '2px solid #E5E5E5',
          boxShadow: '0 4px 0 #E5E5E5',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderBottom: '2px solid #E5E5E5',
        },
      },
    },
  },
});
