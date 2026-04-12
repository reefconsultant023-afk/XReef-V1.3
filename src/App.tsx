import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProjectsPage from './components/ProjectsPage';
import ProjectWorkspace from './components/ProjectWorkspace';
import SupportPage from './components/SupportPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/project/:projectId" element={<ProjectWorkspace />} />
        <Route path="/support" element={<SupportPage />} />
      </Routes>
    </Router>
  );
}
