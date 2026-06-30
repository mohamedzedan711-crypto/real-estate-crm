import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'
import { getEffectivePageKeys, pathToKey, ALL_PAGES } from '../../lib/pages'

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Role-based guard (existing) — admin can never be locked out
  if (roles && profile && profile.role !== 'admin' && !roles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  // Page-access guard — skip for admins
  if (profile && profile.role !== 'admin') {
    const effectiveKeys = getEffectivePageKeys(profile)
    const currentKey = pathToKey(location.pathname)

    if (currentKey && !effectiveKeys.includes(currentKey)) {
      // Redirect to first accessible page
      const firstPage = ALL_PAGES.find(p => effectiveKeys.includes(p.key))
      return <Navigate to={firstPage?.path ?? '/dashboard'} replace />
    }
  }

  return children
}
