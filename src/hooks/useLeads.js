import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export function useLeads(filters = {}) {
  const { profile } = useAuth()
  const [leads, setLeads]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const fetchLeads = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('leads')
        .select(`
          *,
          assigned_profile:profiles!leads_assigned_to_fkey(id, full_name, email, role)
        `)
        .order('created_at', { ascending: false })

      // Agents can only see their own leads (RLS also enforces this)
      if (profile.role === 'agent') {
        query = query.eq('assigned_to', profile.id)
      }

      if (filters.status)      query = query.eq('status', filters.status)
      if (filters.source)      query = query.eq('source', filters.source)
      if (filters.type)        query = query.eq('type', filters.type)
      if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to)
      if (filters.is_dead !== undefined) query = query.eq('is_dead', filters.is_dead)
      if (filters.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
      }

      const { data, error: err } = await query
      if (err) throw err
      setLeads(data || [])
    } catch (err) {
      setError(err.message)
      console.error('useLeads error:', err)
    } finally {
      setLoading(false)
    }
  }, [profile, JSON.stringify(filters)])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  return { leads, loading, error, refetch: fetchLeads }
}

export async function createLead(leadData) {
  const { data, error } = await supabase
    .from('leads')
    .insert([{ ...leadData, status: 'new' }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLead(id, updates) {
  const { data, error } = await supabase
    .from('leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteLead(id) {
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw error
}

export async function logActivity(leadId, userId, type, content, metadata = {}) {
  const { error } = await supabase.from('lead_activities').insert([{
    lead_id: leadId,
    user_id: userId,
    type,
    content,
    metadata,
  }])
  if (error) throw error

  // Update last_activity_at on the lead
  await supabase
    .from('leads')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', leadId)
}
