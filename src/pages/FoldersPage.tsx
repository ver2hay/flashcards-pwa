import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import CreateIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ImportIcon from '@mui/icons-material/Upload';
import SchoolIcon from '@mui/icons-material/School';
import { useAuthStore } from '../features/auth/authStore';
import {
  getFoldersByUserId,
  getCardsByUserId,
  createFolder,
  updateFolder,
  deleteFolder,
  type Folder,
} from '../db';

const FOLDER_NAME_MAX_LENGTH = 60;

function validateFolderName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Folder name is required';
  if (trimmed.length > FOLDER_NAME_MAX_LENGTH) return `Max ${FOLDER_NAME_MAX_LENGTH} characters`;
  return null;
}

export function FoldersPage() {
  const userId = useAuthStore((state) => state.userId);
  const navigate = useNavigate();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [cardCountByFolderId, setCardCountByFolderId] = useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [renameFolder, setRenameFolder] = useState<Folder | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteFolderToConfirm, setDeleteFolderToConfirm] = useState<Folder | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) return;
    const [folderList, cards] = await Promise.all([
      getFoldersByUserId(userId),
      getCardsByUserId(userId),
    ]);
    setFolders(folderList);
    const counts: Record<string, number> = {};
    for (const card of cards) {
      counts[card.folderId] = (counts[card.folderId] ?? 0) + 1;
    }
    setCardCountByFolderId(counts);
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateOpen = () => {
    setCreateName('');
    setCreateError(null);
    setCreateOpen(true);
  };

  const handleCreateClose = () => {
    setCreateOpen(false);
    setCreateName('');
    setCreateError(null);
  };

  const handleCreateSubmit = async () => {
    const err = validateFolderName(createName);
    if (err) {
      setCreateError(err);
      return;
    }
    if (!userId) return;
    setCreateError(null);
    await createFolder({ userId, name: createName.trim() });
    handleCreateClose();
    await loadData();
  };

  const handleRenameOpen = (folder: Folder) => {
    setRenameFolder(folder);
    setRenameName(folder.name);
    setRenameError(null);
  };

  const handleRenameClose = () => {
    setRenameFolder(null);
    setRenameName('');
    setRenameError(null);
  };

  const handleRenameSubmit = async () => {
    if (!renameFolder) return;
    const err = validateFolderName(renameName);
    if (err) {
      setRenameError(err);
      return;
    }
    setRenameError(null);
    await updateFolder(renameFolder.id, { name: renameName.trim() });
    handleRenameClose();
    await loadData();
  };

  const handleDeleteOpen = (folder: Folder) => {
    setDeleteFolderToConfirm(folder);
  };

  const handleDeleteClose = () => {
    setDeleteFolderToConfirm(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteFolderToConfirm) return;
    await deleteFolder(deleteFolderToConfirm.id);
    handleDeleteClose();
    await loadData();
  };

  const hasFolders = folders.length > 0;

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Folders (Lessons)
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<CreateIcon />}
          onClick={handleCreateOpen}
        >
          Create folder
        </Button>
        <Button
          variant="contained"
          startIcon={<ImportIcon />}
          onClick={() => navigate('/import')}
          disabled={!hasFolders}
        >
          Import words
        </Button>
        <Button
          variant="contained"
          startIcon={<SchoolIcon />}
          onClick={() => navigate('/train')}
          disabled={!hasFolders}
        >
          Start training
        </Button>
      </Box>

      {folders.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4 }}>
          Create your first folder (e.g., Lesson 1).
        </Typography>
      ) : (
        <List disablePadding>
          {folders.map((folder) => (
            <ListItem
              key={folder.id}
              secondaryAction={
                <Box component="span" sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    edge="end"
                    aria-label={`Rename ${folder.name}`}
                    onClick={() => handleRenameOpen(folder)}
                    size="medium"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label={`Delete ${folder.name}`}
                    onClick={() => handleDeleteOpen(folder)}
                    size="medium"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              }
              sx={{
                py: 1.5,
                px: 0,
                borderBottom: '1px solid',
                borderColor: 'divider',
                alignItems: 'center',
              }}
            >
              <ListItemText
                primary={folder.name}
                secondary={
                  cardCountByFolderId[folder.id] !== undefined
                    ? `${cardCountByFolderId[folder.id]} card${cardCountByFolderId[folder.id] === 1 ? '' : 's'}`
                    : undefined
                }
                primaryTypographyProps={{ variant: 'body1' }}
              />
            </ListItem>
          ))}
        </List>
      )}

      {/* Create folder dialog */}
      <Dialog open={createOpen} onClose={handleCreateClose} fullWidth maxWidth="xs">
        <DialogTitle>Create folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Folder name"
            value={createName}
            onChange={(e) => {
              setCreateName(e.target.value);
              setCreateError(null);
            }}
            error={!!createError}
            helperText={createError}
            fullWidth
            margin="normal"
            inputProps={{ maxLength: FOLDER_NAME_MAX_LENGTH }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateClose}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateSubmit}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename folder dialog */}
      <Dialog open={!!renameFolder} onClose={handleRenameClose} fullWidth maxWidth="xs">
        <DialogTitle>Rename folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Folder name"
            value={renameName}
            onChange={(e) => {
              setRenameName(e.target.value);
              setRenameError(null);
            }}
            error={!!renameError}
            helperText={renameError}
            fullWidth
            margin="normal"
            inputProps={{ maxLength: FOLDER_NAME_MAX_LENGTH }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRenameClose}>Cancel</Button>
          <Button variant="contained" onClick={handleRenameSubmit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteFolderToConfirm} onClose={handleDeleteClose}>
        <DialogTitle>Delete folder?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete folder &quot;{deleteFolderToConfirm?.name}&quot;? All cards inside will be
            removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteClose}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
