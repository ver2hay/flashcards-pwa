import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from './AppLayout';
import { LoginPage } from '../pages/LoginPage';
import { FoldersPage } from '../pages/FoldersPage';
import { ImportPage } from '../pages/ImportPage';
import { ImportSuccessPage } from '../pages/ImportSuccessPage';
import { TrainPage } from '../pages/TrainPage';
import { ResultsListPage } from '../pages/ResultsListPage';
import { ResultsPage } from '../pages/ResultsPage';

const basename =
  import.meta.env.BASE_URL.replace(/\/$/, '') === ''
    ? undefined
    : import.meta.env.BASE_URL.replace(/\/$/, '');

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Outlet />,
      children: [
        { index: true, element: <Navigate to="/folders" replace /> },
        { path: 'login', element: <LoginPage /> },
        {
          element: (
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          ),
          children: [
            { path: 'folders', element: <FoldersPage /> },
            { path: 'import', element: <ImportPage /> },
            { path: 'import/success', element: <ImportSuccessPage /> },
            { path: 'train', element: <TrainPage /> },
            { path: 'results', element: <ResultsListPage /> },
            { path: 'results/:sessionId', element: <ResultsPage /> },
          ],
        },
      ],
    },
  ],
  { basename }
);
