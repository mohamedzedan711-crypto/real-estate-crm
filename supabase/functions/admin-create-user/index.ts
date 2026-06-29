// Edge Function: admin-create-user
// Creates a Supabase Auth user + profile row in one atomic operation (admin only).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── Verify caller is admin ────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Use service role for everything — we've already verified via the profile check below.
  // We still decode the caller to confirm they are admin.
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Identify caller from their JWT
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

  // ── Parse & validate body ─────────────────────────────────────────────────
  try {
    const { full_name, email, password, role = 'agent', phone } = await req.json()

    if (!full_name?.trim()) throw new Error('Full name is required')
    if (!email?.trim())     throw new Error('Email is required')
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters')
    if (!['agent', 'manager', 'admin'].includes(role)) throw new Error('Invalid role')

    // ── Create the auth user ─────────────────────────────────────────────
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email:          email.trim().toLowerCase(),
      password,
      email_confirm:  true,        // skip email verification — admin is creating the account
      user_metadata:  { full_name: full_name.trim(), role },
    })
    if (authError) throw authError

    const userId = authData.user.id

    // ── Upsert profile row ────────────────────────────────────────────────
    // The handle_new_user() DB trigger may create a bare profile row at the same
    // time. We upsert with all fields to ensure full_name, role, etc. are set
    // correctly regardless of trigger timing.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id:        userId,
        email:     email.trim().toLowerCase(),
        full_name: full_name.trim(),
        role,
        phone:     phone?.trim() || null,
        is_active: true,
      }, { onConflict: 'id' })

    if (profileError) {
      // Profile failed — roll back the auth user so we don't leave orphans
      await supabaseAdmin.auth.admin.deleteUser(userId)
      throw profileError
    }

    return new Response(JSON.stringify({ ok: true, id: userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
