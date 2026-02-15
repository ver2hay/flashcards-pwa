import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import { useAuthStore } from '../features/auth/authStore';
import { getFoldersByUserId, getFolderById, bulkCreateCards } from '../db';
import type { Folder } from '../db';
import { parseImportFile } from '../utils/importParser';

const TEMPLATE_CSV = `RU|KZ
Коричневый|қоңыр
Мишка|қонжық
Серый|сұр
Оранжевый|қызғылт/сары`;

function downloadTemplate(): void {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'flashcards-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportPage() {
  const userId = useAuthStore((state) => state.userId);
  const navigate = useNavigate();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadFolders = useCallback(async () => {
    if (!userId) return;
    const list = await getFoldersByUserId(userId);
    setFolders(list);
  }, [userId]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const canUpload = folderId && file && !uploading;
  const showFolderError = folderError !== null;
  const showParseError = parseError !== null;

  const handleFolderChange = (value: string) => {
    setFolderId(value);
    setFolderError(null);
    setParseError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setParseError(null);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!userId || !folderId || !file) return;
    setFolderError(null);
    setParseError(null);

    if (!folderId.trim()) {
      setFolderError('Please select a folder');
      return;
    }

    setUploading(true);
    try {
      const rows = await parseImportFile(file);
      if (rows.length === 0) {
        setParseError('No valid rows found. Use format RU|KZ (or ; or ,). One pair per line.');
        setUploading(false);
        return;
      }

      const cards = rows.map((row) => ({
        userId,
        folderId,
        frontText: row.frontText,
        backText: row.backText,
      }));
      await bulkCreateCards(cards);

      const folder = await getFolderById(folderId);
      navigate('/import/success', {
        replace: true,
        state: { folderName: folder?.name ?? 'Folder', count: rows.length },
      });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Import words
      </Typography>

      <FormControl fullWidth sx={{ mt: 2, mb: 2 }} error={showFolderError}>
        <InputLabel id="import-folder-label">Folder</InputLabel>
        <Select
          labelId="import-folder-label"
          id="import-folder"
          value={folderId}
          label="Folder"
          onChange={(e) => handleFolderChange(e.target.value)}
        >
          <MenuItem value="">
            <em>Select a folder</em>
          </MenuItem>
          {folders.map((f) => (
            <MenuItem key={f.id} value={f.id}>
              {f.name}
            </MenuItem>
          ))}
        </Select>
        {showFolderError && (
          <FormHelperText>{folderError}</FormHelperText>
        )}
      </FormControl>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={downloadTemplate}
        >
          Download template
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Format: RU|KZ (Russian|Kazakh). Delimiter: | or ; or , . Optional header row RU|KZ. Slashes in values are kept (e.g. қызғылт/сары).
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Button variant="outlined" component="label" fullWidth>
          Choose file (.csv or .xlsx)
          <input
            type="file"
            hidden
            accept=".csv,.xlsx"
            onChange={handleFileChange}
          />
        </Button>
        {file && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {file.name}
          </Typography>
        )}
      </Box>

      {showParseError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setParseError(null)}>
          {parseError}
        </Alert>
      )}

      <Button
        variant="contained"
        startIcon={<UploadIcon />}
        onClick={handleUpload}
        disabled={!canUpload}
        fullWidth
      >
        {uploading ? 'Importing…' : 'Upload'}
      </Button>
    </Box>
  );
}
