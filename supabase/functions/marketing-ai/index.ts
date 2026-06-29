// Edge Function: marketing-ai
// Reads real CRM lead data, cross-references with campaign parameters,
// and generates a specific, data-driven marketing recommendation.
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
    const {
      situation,      // optional free-text from user
      goal,           // e.g. 'lead_generation', 'brand_awareness', 'seller_acquisition'
      locations,      // array of selected location labels in the current language
      budget,         // total budget number (EGP)
      duration,       // campaign duration in days
      lang,           // 'ar' or 'en'
    } = await req.json()

    // ── Step 1: Read real CRM data ───────────────────────────────────────────
    const { data: setting } = await supabase
      .from('settings').select('value').eq('key', 'anthropic_api_key').single()
    const anthropicKey = setting?.value || Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) throw new Error('Anthropic API key not configured')

    // Fetch all leads with location + type + status
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, type, status, source, property_location, preferred_area, ai_score, is_dead, created_at')

    if (leadsError) throw leadsError

    const safeLeads = leads || []

    // ── Step 2: Analyze CRM data ─────────────────────────────────────────────

    // Group by location (using property_location + preferred_area)
    const locationMap: Record<string, { buyers: number; sellers: number; converted: number; total: number; avgScore: number; scores: number[] }> = {}

    for (const lead of safeLeads) {
      const loc = (lead.property_location || lead.preferred_area || 'Unknown').trim()
      if (!loc || loc === 'Unknown') continue
      if (!locationMap[loc]) locationMap[loc] = { buyers: 0, sellers: 0, converted: 0, total: 0, avgScore: 0, scores: [] }
      locationMap[loc].total++
      if (lead.type === 'buyer')  locationMap[loc].buyers++
      if (lead.type === 'seller') locationMap[loc].sellers++
      if (lead.status === 'closed_won') locationMap[loc].converted++
      if (lead.ai_score) locationMap[loc].scores.push(lead.ai_score)
    }

    // Compute averages and rank
    const rankedLocations = Object.entries(locationMap)
      .map(([name, d]) => ({
        name,
        total: d.total,
        buyers: d.buyers,
        sellers: d.sellers,
        converted: d.converted,
        conversionRate: d.total > 0 ? Math.round((d.converted / d.total) * 100) : 0,
        avgScore: d.scores.length > 0 ? Math.round((d.scores.reduce((a, b) => a + b, 0) / d.scores.length) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)

    // Source performance
    const sourceMap: Record<string, number> = {}
    for (const lead of safeLeads) {
      sourceMap[lead.source] = (sourceMap[lead.source] || 0) + 1
    }

    // Overall stats
    const totalLeads     = safeLeads.length
    const totalBuyers    = safeLeads.filter(l => l.type === 'buyer').length
    const totalSellers   = safeLeads.filter(l => l.type === 'seller').length
    const totalConverted = safeLeads.filter(l => l.status === 'closed_won').length
    const deadLeads      = safeLeads.filter(l => l.is_dead).length

    // ── Step 3: Build AI prompt ──────────────────────────────────────────────

    const goalLabels: Record<string, { ar: string; en: string }> = {
      lead_generation:   { ar: 'توليد عملاء محتملين', en: 'Lead Generation' },
      brand_awareness:   { ar: 'الوعي بالعلامة التجارية', en: 'Brand Awareness' },
      seller_acquisition:{ ar: 'جذب البائعين', en: 'Seller Acquisition' },
      buyer_targeting:   { ar: 'استهداف المشترين', en: 'Buyer Targeting' },
      project_launch:    { ar: 'إطلاق مشروع جديد', en: 'New Project Launch' },
    }
    const goalLabel = goalLabels[goal]?.[lang] || goal

    const isAr = lang === 'ar'

    const systemPrompt = isAr
      ? `أنت خبير تسويق عقاري متخصص في مصر. تحليلك مبني على بيانات حقيقية من نظام CRM. مهمتك: توليد توصية حملة تسويقية محددة وقابلة للتنفيذ بناءً على البيانات الفعلية.

قواعد مهمة:
- كن محدداً بالأرقام والمناطق
- لا تستخدم توصيات عامة أو مبهمة
- اذكر المناطق المحددة بالأرقام
- اقترح توزيع الميزانية بالأرقام الفعلية
- استند دائماً على بيانات CRM الحقيقية
- أجب باللغة العربية الفصيحة`
      : `You are a real estate marketing expert specializing in Egypt. Your analysis is built on real CRM data. Your job: generate a specific, actionable campaign recommendation based on actual data.

Rules:
- Be specific with numbers and areas
- No generic or vague recommendations
- Name specific areas with numbers
- Suggest budget split with actual EGP amounts
- Always anchor recommendations in real CRM data
- Respond in English`

    const userPrompt = isAr
      ? `بيانات CRM الحقيقية:
إجمالي العملاء: ${totalLeads}
المشترون: ${totalBuyers} | البائعون: ${totalSellers}
الصفقات المغلقة: ${totalConverted} (معدل التحويل: ${totalLeads > 0 ? Math.round((totalConverted/totalLeads)*100) : 0}%)
العملاء الراكدون: ${deadLeads}

أداء المناطق (مرتبة حسب الأعلى نشاطاً):
${rankedLocations.slice(0, 10).map(l =>
  `• ${l.name}: ${l.total} عميل (${l.buyers} مشتري، ${l.sellers} بائع، ${l.converted} صفقة مغلقة، معدل تحويل: ${l.conversionRate}%، متوسط تقييم AI: ${l.avgScore})`
).join('\n')}

أداء المصادر:
${Object.entries(sourceMap).map(([s, c]) => `• ${s}: ${c} عميل`).join('\n')}

معاملات الحملة المطلوبة:
الهدف: ${goalLabel}
المناطق المستهدفة: ${locations && locations.length > 0 ? locations.join('، ') : 'لم تُحدَّد (استخدم بيانات CRM لاقتراح الأفضل)'}
الميزانية الإجمالية: ${budget ? `${budget} جنيه مصري` : 'غير محددة'}
المدة: ${duration ? `${duration} يوم` : 'غير محددة'}
${situation ? `\nالسياق الإضافي من المستخدم:\n"${situation}"` : ''}

المطلوب: اكتب توصية حملة شاملة تشمل:
1. المناطق المقترحة للاستهداف مع التبرير بالبيانات
2. الجمهور المستهدف (مشترون/بائعون/كلاهما) مع التبرير
3. توزيع الميزانية اليومية على المناطق بالأرقام الدقيقة
4. زاوية الرسالة الإعلانية المقترحة
5. النتيجة المتوقعة بناءً على الأنماط الحالية
6. تحذيرات أو فرص خاصة لاحظتها في البيانات`

      : `Real CRM Data:
Total leads: ${totalLeads}
Buyers: ${totalBuyers} | Sellers: ${totalSellers}
Closed deals: ${totalConverted} (Conversion rate: ${totalLeads > 0 ? Math.round((totalConverted/totalLeads)*100) : 0}%)
Dead leads: ${deadLeads}

Area performance (ranked by activity):
${rankedLocations.slice(0, 10).map(l =>
  `• ${l.name}: ${l.total} leads (${l.buyers} buyers, ${l.sellers} sellers, ${l.converted} closed, conversion: ${l.conversionRate}%, avg AI score: ${l.avgScore})`
).join('\n')}

Source performance:
${Object.entries(sourceMap).map(([s, c]) => `• ${s}: ${c} leads`).join('\n')}

Campaign parameters:
Goal: ${goalLabel}
Target locations: ${locations && locations.length > 0 ? locations.join(', ') : 'Not specified (use CRM data to suggest best areas)'}
Total budget: ${budget ? `${budget} EGP` : 'Not specified'}
Duration: ${duration ? `${duration} days` : 'Not specified'}
${situation ? `\nAdditional context from user:\n"${situation}"` : ''}

Required: Write a comprehensive campaign recommendation including:
1. Recommended target areas with data justification
2. Target audience (buyers/sellers/both) with justification
3. Daily budget split across locations with exact EGP amounts
4. Recommended ad message angle
5. Expected outcome based on current patterns
6. Any warnings or opportunities spotted in the data`

    // ── Step 4: Call Anthropic ───────────────────────────────────────────────
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text()
      throw new Error(`Anthropic error: ${err}`)
    }

    const anthropicData = await anthropicRes.json()
    const recommendation = anthropicData.content?.[0]?.text || ''

    return new Response(
      JSON.stringify({
        recommendation,
        crmSnapshot: {
          totalLeads,
          totalBuyers,
          totalSellers,
          totalConverted,
          deadLeads,
          topLocations: rankedLocations.slice(0, 5),
          sourceSummary: sourceMap,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
