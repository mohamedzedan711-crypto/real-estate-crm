// Edge Function: ai-report
// Generates a natural language marketing/performance report using Anthropic.
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
    const { period = 'month', lang = 'ar' } = await req.json()

    const { data: setting } = await supabase.from('settings').select('value').eq('key','anthropic_api_key').single()
    const anthropicKey = setting?.value || Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) throw new Error('Anthropic API key not configured')

    // Fetch data
    const { data: leads } = await supabase.from('leads').select('status, source, type, ai_score, is_dead, created_at, property_location, property_type, property_price')

    const stats = {
      total: leads?.length ?? 0,
      byStatus: leads?.reduce((acc: Record<string, number>, l: { status: string }) => { acc[l.status] = (acc[l.status]||0)+1; return acc }, {}),
      bySource: leads?.reduce((acc: Record<string, number>, l: { source: string }) => { acc[l.source] = (acc[l.source]||0)+1; return acc }, {}),
      byType:   leads?.reduce((acc: Record<string, number>, l: { type: string }) =>   { acc[l.type]   = (acc[l.type]||0)+1;   return acc }, {}),
      byArea:   leads?.reduce((acc: Record<string, number>, l: { property_location: string }) => { if (l.property_location) acc[l.property_location] = (acc[l.property_location]||0)+1; return acc }, {}),
      deadCount: leads?.filter((l: { is_dead: boolean }) => l.is_dead).length ?? 0,
      avgScore:  leads?.length ? Math.round((leads.reduce((s: number, l: { ai_score: number }) => s + (l.ai_score||0), 0) / leads.length) * 10) / 10 : 0,
      closedWon: leads?.filter((l: { status: string }) => l.status === 'closed_won').length ?? 0,
    }

    const isAr = lang === 'ar'
    const prompt = isAr
      ? `أنت محلل عقاري خبير. بناءً على هذه البيانات، اكتب تقرير تسويقي وأداء شامل باللغة العربية الفصيحة:

البيانات:
${JSON.stringify(stats, null, 2)}

الفترة: ${period === 'week' ? 'هذا الأسبوع' : period === 'month' ? 'هذا الشهر' : 'كل الوقت'}

اكتب التقرير بتنسيق مقروء يشمل:
1. ملخص تنفيذي
2. أفضل مصادر العملاء
3. فرص التحسين
4. توصيات تسويقية محددة
5. المناطق الأكثر طلباً

كن دقيقاً ومفيداً. لا تختلق أرقاماً غير موجودة في البيانات.`
      : `You are an expert real estate analyst. Write a comprehensive marketing and performance report in English:

Data:
${JSON.stringify(stats, null, 2)}

Period: ${period}

Include:
1. Executive Summary
2. Best performing lead sources
3. Improvement opportunities
4. Specific marketing recommendations
5. Most popular areas

Be accurate. Don't fabricate numbers not in the data.`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await anthropicRes.json()
    const report = data.content?.[0]?.text || ''

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
