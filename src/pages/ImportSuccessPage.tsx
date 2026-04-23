import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import SchoolIcon from '@mui/icons-material/School';
import UploadIcon from '@mui/icons-material/Upload';

interface ImportSuccessState {
  lessonName?: string;
  folderName?: string;
  count: number;
}

function pluralCards(n: number): string {
  const m = n % 10;
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return 'карточек';
  if (m === 1) return 'карточка';
  if (m >= 2 && m <= 4) return 'карточки';
  return 'карточек';
}

export function ImportSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ImportSuccessState | null;
  const lessonName = state?.lessonName ?? state?.folderName ?? 'Урок';
  const count = state?.count ?? 0;

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Импорт завершён
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        <strong>{lessonName}</strong>: импортировано {count} {pluralCards(count)}.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<FolderIcon />}
          onClick={() => navigate('/folders')}
          fullWidth
        >
          К папкам
        </Button>
        <Button
          variant="contained"
          startIcon={<SchoolIcon />}
          onClick={() => navigate('/train')}
          fullWidth
        >
          Начать тренировку
        </Button>
        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          onClick={() => navigate('/import')}
          fullWidth
        >
          Импортировать ещё
        </Button>
      </Box>
    </Box>
  );
}
