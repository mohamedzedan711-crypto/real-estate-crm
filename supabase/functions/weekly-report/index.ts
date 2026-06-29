// Edge Function: weekly-report
// Generates and sends the Sunday weekly WhatsApp summary to admins and managers.
// Call this function from a pg_cron job or external cron scheduler every Sunday.
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
    // Fetch settings
    const { data: settings } = await supabase.from('settings').select('key, value')
    const config = Object.fromEntries((settings || []).map((s: { key: string; value: string }) => [s.key, s.value]))

    const anthropicKey = config.anthropic_api_key || Deno.env.get('ANTHROPIC_API_KEY')
    const waToken      = config.whatsapp_token    || Deno.env.get('WHATSAPP_API_TOKEN')
    const phoneId      = config.whatsapp_phone_number_id || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

    // Fetch last 7 days of data
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [
      { data: leads },
      { data: adminsAndManagers },
    ] = await Promise.all([
      supabase.from('leads').select('status, source, ai_score, is_dead, created_at, assigned_to'),
      supabase.from('profiles').select('id, full_name, phone, role').in('role',['admin','manager']).eq('is_active', true),
    ])

    const thisWeek = (leads || []).filter((l: { created_at: string }) => l.created_at >= weekAgo)

    const stats = {
      newLeads:   thisWeek.length,
      closedWon:  (leads || []).filter((l: { status: string; created_at: string }) => l.status === 'closed_won' && l.created_at >= weekAgo).length,
      dead:       (leads || []).filter((l: { is_dead: boolean }) => l.is_dead).length,
      totalLeads: (leads || []).length,
      bySource:   ['olx_dubizzle','aqarmap','meta','whatsapp','manual'].map(s => ({
        source: s,
        count: thisWeek.filter((l: { source: string }) => l.source === s).length,
      })).filter(d => d.count > 0),
    }

    // Generate AI report text
    let reportText = `📊 *التقرير الأسبوعي - نظام العقارات*\n\n`
    reportText += `🗓️ الأسبوع المنتهي: ${new Date().toLocaleDateString('ar-EG')}\n\n`
    reportText += `📥 عملاء جدد هذا الأسبوع: *${stats.newLeads}*\n`
    reportText += `✅ صفقات مغلقة: *${stats.closedWon}*\n`
    reportText += `⚠️ عملاء راكدون: *${stats.dead}*\n`
    reportText += `👥 إجمالي قاعدة العملاء: *${stats.totalLeads}*\n\n`

    if (stats.bySource.length > 0) {
      reportText += `📡 *المصادر هذا الأسبوع:*\n`
      const sourceNames: Record<string, string> = {
        olx_dubizzle: 'OLX/دوبيزل',
        aqarmap: 'عقارماب',
        meta: 'ميتا',
        whatsapp: 'واتساب',
        manual: 'يدوي',
      }
      for (const { source, count } of stats.bySource) {
        reportText += `  • ${sourceNames[source] || source}: ${count}\n`
      }
    }

    // Add AI insights if key is available
    if (anthropicKey) {
      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: `بناءً على هذه الإحصائيات الأسبوعية لنظام CRM العقاري، اكتب توصية واحدة مختصرة جداً (جملتان فقط) لتحسين الأداء:
${JSON.stringify(stats, null, 2)}`,
            }],
          }),
        })
        const aiData = await aiRes.json()
        const aiInsight = aiData.content?.[0]?.text || ''
        if (aiInsight) {
          reportText += `\n🤖 *توصية الذكاء الاصطناعي:*\n${aiInsight}`
        }
      } catch { /* AI insight is optional */ }
    }

    // Send to all admins and managers
    let sent = 0
    if (waToken && phoneId) {
      for (const recipient of (adminsAndManagers || [])) {
        if (!recipient.phone) continue
        try {
          await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: recipient.phone,
              type: 'text',
              text: { body: reportText },
            }),
          })
          sent++
        } catch { /* Continue to next recipient */ }
      }
    }

    return new Response(JSON.stringify({ ok: true, reportText, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
