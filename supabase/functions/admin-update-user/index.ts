// Edge Function: admin-update-user
// Updates a user's profile fields (role, page_access, full_name, is_active) — admin only.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user: caller } } = await callerClient.auth.getUser()
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
  const { data: cp } = await admin.from('profiles').select('role').eq('id', caller.id).single()
  if ((cp as any)?.role !== 'admin') return new Response(JSON.stringify({ error: 'Admin only' }), {
    status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  try {
    const { user_id, full_name, role, page_access, is_active } = await req.json()
    if (!user_id) throw new Error('user_id is required')

    // Don't allow modifying other admin accounts
    const { data: target } = await admin.from('profiles').select('role').eq('id', user_id).single()
    if ((target as any)?.role === 'admin' && user_id !== caller.id) {
      throw new Error('Cannot modify other admin accounts')
    }

    const updates: Record<string, unknown> = {}
    if (full_name  !== undefined) updates.full_name  = (full_name as string).trim()
    if (is_active  !== undefined) updates.is_active  = is_active
    if (page_access !== undefined) updates.page_access = page_access
    // Only allow downgrading roles, never assigning admin here
    if (role !== undefined && ['agent','manager'].includes(role)) updates.role = role

    const { error } = await admin.from('profiles').update(updates).eq('id', user_id)
    if (error) throw error

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
