// Edge Function: ai-score-leads
// Called on a schedule (or manually) to score all un-scored leads and flag dead ones.
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
    const { data: setting } = await supabase.from('settings').select('value').eq('key','anthropic_api_key').single()
    const anthropicKey = setting?.value || Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) throw new Error('Anthropic API key not configured')

    // Fetch leads that need scoring (no score yet or updated recently)
    const { data: leads } = await supabase
      .from('leads')
      .select('id, status, source, type, ai_score, created_at, last_activity_at, is_dead')
      .is('ai_score', null)
      .limit(50)

    if (!leads?.length) {
      return new Response(JSON.stringify({ scored: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Flag dead leads (no activity for 7+ days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const deadLeadIds = leads
      .filter(l => l.status !== 'closed_won' && l.status !== 'closed_lost')
      .filter(l => {
        const lastAct = l.last_activity_at || l.created_at
        return lastAct < sevenDaysAgo
      })
      .map(l => l.id)

    if (deadLeadIds.length > 0) {
      await supabase.from('leads').update({ is_dead: true }).in('id', deadLeadIds)
    }

    // Batch score with Anthropic
    const leadsJson = JSON.stringify(leads.map(l => ({
      id: l.id,
      status: l.status,
      source: l.source,
      type: l.type,
      days_old: Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000),
      has_activity: !!l.last_activity_at,
    })))

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
        messages: [{
          role: 'user',
          content: `Score each real estate lead 1-10 (10=hottest). Consider status progression, source quality (meta=high, whatsapp=high, aqarmap=medium, olx=medium), lead age, and activity.

Leads JSON:
${leadsJson}

Return ONLY a JSON array like: [{"id":"...","score":7},{"id":"...","score":3}]
No explanation, just the JSON array.`,
        }],
      }),
    })

    const anthropicData = await anthropicRes.json()
    const responseText = anthropicData.content?.[0]?.text || '[]'

    // Parse scores — handle markdown code blocks
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    const scores: Array<{ id: string; score: number }> = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    // Update leads with scores
    let scored = 0
    for (const { id, score } of scores) {
      if (id && score >= 1 && score <= 10) {
        await supabase.from('leads').update({ ai_score: score }).eq('id', id)
        scored++
      }
    }

    return new Response(JSON.stringify({ scored, flaggedDead: deadLeadIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
