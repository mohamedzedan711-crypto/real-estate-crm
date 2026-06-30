import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
import ProtectedRoute from './components/shared/ProtectedRoute'
import Layout from './components/shared/Layout'

// Pages
import Login     from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads     from './pages/Leads'
import Pipeline  from './pages/Pipeline'
import WhatsApp  from './pages/WhatsApp'
import AIChat    from './pages/AIChat'
import Reports        from './pages/Reports'
import Settings        from './pages/Settings'
import MarketingBrain  from './pages/MarketingBrain'
import AccountantBrain from './pages/AccountantBrain'

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              className: '!bg-white dark:!bg-navy-900 !text-gray-900 dark:!text-white !shadow-xl !rounded-xl !text-sm',
              duration: 3500,
            }}
          />

          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Protected — all authenticated users */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/leads" element={
              <ProtectedRoute>
                <Layout><Leads /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/pipeline" element={
              <ProtectedRoute>
                <Layout><Pipeline /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/whatsapp" element={
              <ProtectedRoute>
                <Layout><WhatsApp /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/ai-chat" element={
              <ProtectedRoute>
                <Layout><AIChat /></Layout>
              </ProtectedRoute>
            } />

            {/* Protected — admin and manager only */}
            <Route path="/accountant" element={
              <ProtectedRoute roles={['admin','manager']}>
                <Layout><AccountantBrain /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/marketing" element={
              <ProtectedRoute roles={['admin','manager']}>
                <Layout><MarketingBrain /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute roles={['admin','manager']}>
                <Layout><Reports /></Layout>
              </ProtectedRoute>
            } />

            {/* Protected — admin only */}
            <Route path="/settings" element={
              <ProtectedRoute roles={['admin']}>
                <Layout><Settings /></Layout>
              </ProtectedRoute>
            } />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
