import { ThemeProvider, CssBaseline } from '@mui/material';
import { appTheme } from './app/theme';
import { AppBoot } from './app/AppBoot';

export default function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AppBoot />
    </ThemeProvider>
  );
}
