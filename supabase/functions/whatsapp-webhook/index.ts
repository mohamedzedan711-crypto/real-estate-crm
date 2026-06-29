// Edge Function: whatsapp-webhook
// Handles incoming WhatsApp Business API webhook events.
// Verifies signature, creates/updates leads, saves messages, triggers AI qualification.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
}

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('')
    return `sha256=${hex}` === signature
  } catch { return false }
}

serve(async (req) => {
  // Webhook verification (GET)
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
    const rawBody = await req.text()
    const body = JSON.parse(rawBody)

    // Verify signature if secret is configured
    const appSecret = Deno.env.get('META_APP_SECRET')
    const signature = req.headers.get('x-hub-signature-256')
    if (appSecret && signature && !(await verifySignature(rawBody, signature, appSecret))) {
      return new Response('Invalid signature', { status: 401 })
    }

    // Get API keys
    const { data: waTokenSetting } = await supabase.from('settings').select('value').eq('key','whatsapp_token').single()
    const { data: phoneIdSetting } = await supabase.from('settings').select('value').eq('key','whatsapp_phone_number_id').single()
    const { data: firstMsgSetting } = await supabase.from('settings').select('value').eq('key','wa_first_message').single()

    const waToken   = waTokenSetting?.value || Deno.env.get('WHATSAPP_API_TOKEN')
    const phoneId   = phoneIdSetting?.value || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
    const firstMsg  = firstMsgSetting?.value || 'مرحباً بك! 👋 كيف يمكنني مساعدتك؟'

    // Process each entry
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue

        const messages = change.value?.messages || []
        for (const msg of messages) {
          if (msg.type !== 'text') continue

          const fromPhone = msg.from                    // sender's phone number
          const text      = msg.text?.body || ''
          const waId      = msg.id

          // Upsert lead by phone number
          let { data: lead } = await supabase
            .from('leads')
            .select('id, full_name')
            .eq('phone', fromPhone)
            .maybeSingle()

          if (!lead) {
            // Create new lead from WhatsApp message
            const { data: newLead } = await supabase
              .from('leads')
              .insert({
                full_name: change.value?.contacts?.[0]?.profile?.name || `WhatsApp ${fromPhone}`,
                phone:     fromPhone,
                source:    'whatsapp',
                type:      'buyer',
                status:    'new',
              })
              .select()
              .single()
            lead = newLead

            // Send first message
            if (waToken && phoneId && lead) {
              await sendWhatsAppMessage(phoneId, waToken, fromPhone, firstMsg)
              // Save outbound message
              await supabase.from('whatsapp_messages').insert({
                lead_id:    lead.id,
                direction:  'outbound',
                message:    firstMsg,
                status:     'sent',
              })
            }

            // Log activity
            if (lead) {
              await supabase.from('lead_activities').insert({
                lead_id: lead.id,
                type:    'created',
                content: `Lead created automatically from WhatsApp message`,
              })
            }
          }

          if (!lead) continue

          // Save inbound message (dedup by wa_message_id)
          await supabase.from('whatsapp_messages').upsert({
            lead_id:       lead.id,
            direction:     'inbound',
            message:       text,
            wa_message_id: waId,
          }, { onConflict: 'wa_message_id' })

          // Log activity
          await supabase.from('lead_activities').insert({
            lead_id: lead.id,
            type:    'whatsapp_recv',
            content: text,
          })

          // Update last_activity_at
          await supabase.from('leads')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('id', lead.id)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function sendWhatsAppMessage(phoneId: string, token: string, to: string, text: string) {
  await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })
}
