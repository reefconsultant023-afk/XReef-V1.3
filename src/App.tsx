import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const ProjectsPage = lazy(() => import('./components/ProjectsPage'));
const ProjectWorkspace = lazy(() => import('./components/ProjectWorkspace'));
const SupportPage = lazy(() => import('./components/SupportPage'));

const LoadingFallback = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
  </div>
);

export default function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/project/:projectId" element={<ProjectWorkspace />} />
          <Route path="/support" element={<SupportPage />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
