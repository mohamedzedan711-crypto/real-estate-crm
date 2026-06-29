// Edge Function: whatsapp-welcome
// Sends the configured welcome/first message to a lead.
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
    const { lead_id, phone } = await req.json()

    const [
      { data: tokenSetting },
      { data: phoneIdSetting },
      { data: msgSetting },
    ] = await Promise.all([
      supabase.from('settings').select('value').eq('key','whatsapp_token').single(),
      supabase.from('settings').select('value').eq('key','whatsapp_phone_number_id').single(),
      supabase.from('settings').select('value').eq('key','wa_first_message').single(),
    ])

    const token   = tokenSetting?.value   || Deno.env.get('WHATSAPP_API_TOKEN')
    const phoneId = phoneIdSetting?.value || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
    const message = msgSetting?.value     || 'مرحباً بك! 👋 كيف يمكنني مساعدتك؟'

    if (!token || !phoneId) throw new Error('WhatsApp API not configured')

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

    await supabase.from('whatsapp_messages').insert({
      lead_id,
      direction: 'outbound',
      message,
      status: 'sent',
      wa_message_id: waData.messages?.[0]?.id,
    })

    await supabase.from('lead_activities').insert({
      lead_id,
      type: 'whatsapp_sent',
      content: `Welcome message sent: ${message}`,
    })

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
