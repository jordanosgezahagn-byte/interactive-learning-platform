import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import CourseDetails from './pages/CourseDetails';
import CourseWorkspace from './pages/CourseWorkspace';
import LearningWorkspace from './pages/LearningWorkspace';
import CertificatePage from './pages/CertificatePage';
import { apiRequest } from './lib/api';
import { dashboardPathForRole } from './lib/roles';

function ProtectedDashboard({ role }) {
  const [state, setState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    let active = true;

    apiRequest('/auth/me')
      .then(({ user }) => {
        if (active) setState({ status: 'authenticated', user });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: error.status === 401 ? 'unauthenticated' : 'error',
          user: null,
          message: error.message,
        });
      });

    return () => {
      active = false;
    };
  }, []);

  if (state.status === 'loading') {
    return <div className="auth-container" role="status">Checking your session…</div>;
  }
  if (state.status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }
  if (state.status === 'error') {
    return <div className="auth-container"><p className="auth-error" role="alert">{state.message}</p></div>;
  }

  const actualDashboardPath = dashboardPathForRole(state.user.role);
  if (!actualDashboardPath) {
    return <div className="auth-container"><p className="auth-error" role="alert">This account has an unsupported role. Contact an administrator.</p></div>;
  }
  if (role !== state.user.role) {
    return <Navigate to={actualDashboardPath} replace />;
  }

  return <Dashboard user={state.user} />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/dashboard" element={<ProtectedDashboard />} />
        <Route path="/student/dashboard" element={<ProtectedDashboard role="student" />} />
        <Route path="/instructor/dashboard" element={<ProtectedDashboard role="instructor" />} />
        <Route path="/admin/dashboard" element={<ProtectedDashboard role="admin" />} />
        <Route path="/courses/:courseId" element={<CourseDetails />} />
        <Route path="/learn/course/:courseId" element={<CourseWorkspace />} />
        <Route path="/learn/html" element={<LearningWorkspace />} />
        <Route path="/certificates/:certificateCode" element={<CertificatePage />} />
        <Route path="/verify/:certificateCode" element={<CertificatePage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}
