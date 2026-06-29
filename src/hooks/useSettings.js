import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Fetch all settings from the DB and expose as a key→value map
export function useSettings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
      if (!error && data) {
        const map = {}
        data.forEach(row => { map[row.key] = row.value })
        setSettings(map)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveSetting(key, value) {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) throw error
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  async function saveMany(entries) {
    const rows = Object.entries(entries).map(([key, value]) => ({
      key, value, updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from('settings')
      .upsert(rows, { onConflict: 'key' })
    if (error) throw error
    setSettings(prev => ({ ...prev, ...entries }))
  }

  return { settings, loading, saveSetting, saveMany }
}
