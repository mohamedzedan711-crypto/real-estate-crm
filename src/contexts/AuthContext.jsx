import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // raw Supabase auth user
  const [profile, setProfile] = useState(null)   // profiles row (role, name, etc.)
  const [loading, setLoading] = useState(true)
  // Prevent double-initialization from getSession + INITIAL_SESSION event firing together
  const initialized = useRef(false)

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) {
        // PGRST116 = no rows found; other codes = real errors
        if (error.code !== 'PGRST116') {
          console.error('fetchProfile error:', error.code, error.message)
        }
        return null
      }
      return data
    } catch (err) {
      console.error('fetchProfile unexpected error:', err)
      return null
    }
  }

  useEffect(() => {
    // onAuthStateChange fires immediately with INITIAL_SESSION containing the
    // current session (same as getSession). Using only the listener avoids
    // duplicate fetchProfile calls and the race they create.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION' && initialized.current) return
        initialized.current = true

        if (session?.user) {
          setUser(session.user)
          const p = await fetchProfile(session.user.id)
          setProfile(p)
        } else {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  // Convenience role checks
  const isAdmin   = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'
  const isAgent   = profile?.role === 'agent'

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      login,
      logout,
      isAdmin,
      isManager,
      isAgent,
      refreshProfile: () => user && fetchProfile(user.id).then(setProfile),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
