// Edge Function: meta-webhook
// Receives Meta (Facebook/Instagram) Lead Ads form submissions and creates leads.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
}

serve(async (req) => {
  // Webhook verification
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode      = url.searchParams.get('hub.mode')
    const token     = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'real_estate_crm_verify'
    if (mode === 'subscribe' && token === verifyToken) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const body = await req.json()

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue

        const leadgenId = change.value?.leadgen_id
        if (!leadgenId) continue

        // Fetch full lead data from Meta Graph API
        const { data: tokenSetting } = await supabase
          .from('settings').select('value').eq('key','meta_api_token').single()
        const metaToken = tokenSetting?.value || Deno.env.get('META_API_TOKEN')

        if (!metaToken) {
          console.error('Meta API token not configured')
          continue
        }

        const metaRes = await fetch(
          `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${metaToken}`
        )
        const leadData = await metaRes.json()

        if (!metaRes.ok) {
          console.error('Meta lead fetch error:', leadData)
          continue
        }

        // Parse field data
        const fields: Record<string, string> = {}
        for (const f of leadData.field_data || []) {
          fields[f.name] = f.values?.[0] || ''
        }

        const phone = fields.phone_number || fields.phone || fields['phone number'] || ''
        const name  = fields.full_name    || fields.name  || fields['full name']    || 'Meta Lead'
        const email = fields.email        || ''

        // Dedup by external_id
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('external_id', leadgenId)
          .maybeSingle()

        if (existing) continue // already imported

        await supabase.from('leads').insert({
          full_name:   name,
          phone,
          email,
          source:      'meta',
          type:        'buyer',
          status:      'new',
          external_id: leadgenId,
        })
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
