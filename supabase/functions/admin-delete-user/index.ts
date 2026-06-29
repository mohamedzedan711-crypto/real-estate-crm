// Edge Function: admin-delete-user
// Permanently deletes a user from Auth + DB and unassigns their leads (admin only).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verify caller is admin
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user: caller } } = await callerClient.auth.getUser()
  if (!caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Admin only' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { user_id } = await req.json()
    if (!user_id) throw new Error('user_id is required')

    // Prevent admin from deleting themselves
    if (user_id === caller.id) throw new Error('You cannot delete your own account')

    // Verify the target user exists and is not another admin
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles').select('role, full_name').eq('id', user_id).single()
    if (!targetProfile) throw new Error('User not found')
    if (targetProfile.role === 'admin') throw new Error('Cannot delete another admin account')

    // 1. Unassign all leads that were assigned to this user
    const { error: leadsError } = await supabaseAdmin
      .from('leads')
      .update({ assigned_to: null })
      .eq('assigned_to', user_id)
    if (leadsError) throw leadsError

    // 2. Delete the profile row (cascade will handle related activity rows if FK set up)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', user_id)
    if (profileError) throw profileError

    // 3. Delete the auth user — this immediately revokes all their sessions
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    if (authError) throw authError

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
