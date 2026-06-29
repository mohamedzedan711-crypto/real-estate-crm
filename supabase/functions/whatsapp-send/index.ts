// Edge Function: whatsapp-send
// Sends an outbound WhatsApp message from a CRM agent/admin.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { lead_id, phone, message, sent_by } = await req.json()
    if (!phone || !message) throw new Error('phone and message are required')

    const { data: waTokenSetting } = await supabase.from('settings').select('value').eq('key','whatsapp_token').single()
    const { data: phoneIdSetting } = await supabase.from('settings').select('value').eq('key','whatsapp_phone_number_id').single()

    const token   = waTokenSetting?.value || Deno.env.get('WHATSAPP_API_TOKEN')
    const phoneId = phoneIdSetting?.value || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

    if (!token || !phoneId) throw new Error('WhatsApp API not configured. Add keys in Settings.')

    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      }),
    })

    const waData = await res.json()
    if (!res.ok) throw new Error(waData.error?.message || 'WhatsApp API error')

    const waMessageId = waData.messages?.[0]?.id

    // Save to DB
    await supabase.from('whatsapp_messages').insert({
      lead_id,
      direction:     'outbound',
      message,
      status:        'sent',
      wa_message_id: waMessageId,
      sent_by,
    })

    // Log activity
    if (lead_id) {
      await supabase.from('lead_activities').insert({
        lead_id,
        user_id: sent_by,
        type:    'whatsapp_sent',
        content: message,
      })
      await supabase.from('leads')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', lead_id)
    }

    return new Response(JSON.stringify({ ok: true, wa_message_id: waMessageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
