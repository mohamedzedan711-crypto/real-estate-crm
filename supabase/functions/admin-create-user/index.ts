// Edge Function: admin-create-user
// Creates a new Supabase auth user with a profile row (admin only).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Verify the caller is an admin (use their JWT)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user: caller } } = await callerClient.auth.getUser()
  if (!caller) return new Response('Unauthorized', { status: 401 })

  const { data: callerProfile } = await callerClient
    .from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Admin only' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { full_name, email, password, role = 'agent', phone } = await req.json()

    if (!email || !password || !full_name) {
      throw new Error('full_name, email, and password are required')
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    })
    if (authError) throw authError

    // Update profile (trigger creates it, but we need to set name/role)
    await supabaseAdmin.from('profiles').upsert({
      id:        authData.user.id,
      email,
      full_name,
      role,
      phone:     phone || null,
      is_active: true,
    })

    return new Response(JSON.stringify({ ok: true, id: authData.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
