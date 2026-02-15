import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import SchoolIcon from '@mui/icons-material/School';
import UploadIcon from '@mui/icons-material/Upload';

interface ImportSuccessState {
  folderName: string;
  count: number;
}

export function ImportSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ImportSuccessState | null;
  const folderName = state?.folderName ?? 'Folder';
  const count = state?.count ?? 0;

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Import complete
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        <strong>{folderName}</strong>: {count} card{count === 1 ? '' : 's'} imported.
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<FolderIcon />}
          onClick={() => navigate('/folders')}
          fullWidth
        >
          Go to folders
        </Button>
        <Button
          variant="contained"
          startIcon={<SchoolIcon />}
          onClick={() => navigate('/train')}
          fullWidth
        >
          Start training
        </Button>
        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          onClick={() => navigate('/import')}
          fullWidth
        >
          Import more
        </Button>
      </Box>
    </Box>
  );
}
