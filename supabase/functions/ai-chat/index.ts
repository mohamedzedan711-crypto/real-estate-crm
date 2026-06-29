// Edge Function: ai-chat
// Handles the interactive AI assistant. Reads CRM context and generates a response.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { messages, user_role, lang } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch Anthropic API key from settings
    const { data: setting } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'anthropic_api_key')
      .single()

    const anthropicKey = setting?.value || Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) throw new Error('Anthropic API key not configured')

    // Fetch CRM context for the AI
    const [{ data: leads }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from('leads').select('full_name,phone,status,source,type,ai_score,is_dead,assigned_to,created_at').limit(100),
      supabaseAdmin.from('profiles').select('id,full_name,role').eq('is_active', true),
    ])

    const leadSummary = {
      total: leads?.length ?? 0,
      byStatus: leads?.reduce((acc: Record<string, number>, l: { status: string }) => {
        acc[l.status] = (acc[l.status] || 0) + 1; return acc
      }, {}) ?? {},
      bySource: leads?.reduce((acc: Record<string, number>, l: { source: string }) => {
        acc[l.source] = (acc[l.source] || 0) + 1; return acc
      }, {}) ?? {},
      hot:  leads?.filter((l: { ai_score: number }) => (l.ai_score || 0) >= 7).length ?? 0,
      dead: leads?.filter((l: { is_dead: boolean }) => l.is_dead).length ?? 0,
      closedWon: leads?.filter((l: { status: string }) => l.status === 'closed_won').length ?? 0,
    }

    const isAr = lang === 'ar' || (messages[messages.length - 1]?.content || '').match(/[؀-ۿ]/)

    const systemPrompt = isAr
      ? `أنت مساعد ذكاء اصطناعي متخصص في إدارة العملاء العقاريين. دورك هو تقديم المشورة وتحليل البيانات فقط — لا تُعدِّل أي بيانات في النظام.

بيانات CRM الحالية:
- إجمالي العملاء: ${leadSummary.total}
- حسب الحالة: ${JSON.stringify(leadSummary.byStatus, null, 2)}
- حسب المصدر: ${JSON.stringify(leadSummary.bySource, null, 2)}
- عملاء ساخنون (تقييم ≥7): ${leadSummary.hot}
- عملاء راكدون: ${leadSummary.dead}
- صفقات مغلقة: ${leadSummary.closedWon}
- دور المستخدم: ${user_role}

أجب دائماً بالعربية الفصيحة، واجعل إجاباتك مفيدة وعملية وموجزة.`
      : `You are an AI assistant specialized in real estate CRM management. Your role is to advise and analyze — you do NOT modify any system data.

Current CRM snapshot:
- Total leads: ${leadSummary.total}
- By status: ${JSON.stringify(leadSummary.byStatus, null, 2)}
- By source: ${JSON.stringify(leadSummary.bySource, null, 2)}
- Hot leads (score ≥7): ${leadSummary.hot}
- Dead leads: ${leadSummary.dead}
- Closed won: ${leadSummary.closedWon}
- Current user role: ${user_role}

Always respond in English. Be concise, practical, and actionable.`

    // Call Anthropic API
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    })

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text()
      throw new Error(`Anthropic error: ${err}`)
    }

    const anthropicData = await anthropicRes.json()
    const reply = anthropicData.content?.[0]?.text || ''

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
