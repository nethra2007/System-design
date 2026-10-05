import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage, SignupPage } from './pages/AuthPages';
import { CustomerSalePage, OrderSuccessPage } from './pages/CustomerPages';
import { ControlRoom } from './pages/ControlRoom';
import { ArchitecturePage, TransactionsPage, FailuresPage, MetricsPage } from './pages/SecondaryPages';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Default Redirect */}
          <Route path="/" element={<Navigate to="/sale" replace />} />

          {/* Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Customer Facing Routes */}
          <Route
            path="/sale"
            element={
              <ProtectedRoute>
                <CustomerSalePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/order-success"
            element={
              <ProtectedRoute>
                <OrderSuccessPage />
              </ProtectedRoute>
            }
          />

          {/* Engineering Control Tower / Jury Routes */}
          <Route path="/control-room" element={<ControlRoom />} />
          <Route path="/architecture" element={<ArchitecturePage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/failures" element={<FailuresPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
