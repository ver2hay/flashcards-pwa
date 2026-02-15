import { createTheme } from '@mui/material/styles';

/**
 * Mobile-first MUI theme for the flashcards PWA.
 * Breakpoints: xs (0), sm (600), md (900), lg (1200), xl (1536).
 */
export const appTheme = createTheme({
  // Mobile-first: default typography and spacing tuned for small screens
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '1.75rem', fontWeight: 600 },
    h2: { fontSize: '1.5rem', fontWeight: 600 },
    h3: { fontSize: '1.25rem', fontWeight: 600 },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minHeight: '100vh',
          margin: 0,
        },
      },
    },
  },
});
