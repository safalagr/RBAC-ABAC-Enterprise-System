import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Permissions from './pages/Permissions';
import AuditLogs from './pages/AuditLogs';
import Documents from './pages/Documents';
import Approvals from './pages/Approvals';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/users" element={<PrivateRoute permission="read:users"><Users /></PrivateRoute>} />
            <Route path="/roles" element={<PrivateRoute permission="read:roles"><Roles /></PrivateRoute>} />
            <Route path="/permissions" element={<PrivateRoute permission="read:permissions"><Permissions /></PrivateRoute>} />
            <Route path="/documents" element={<PrivateRoute permission="read:documents"><Documents /></PrivateRoute>} />
            <Route path="/approvals" element={<PrivateRoute permission="read:approvals"><Approvals /></PrivateRoute>} />
            <Route path="/audit" element={<PrivateRoute permission="read:audit"><AuditLogs /></PrivateRoute>} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;