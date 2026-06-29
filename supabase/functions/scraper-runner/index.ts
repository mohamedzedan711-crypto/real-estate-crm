// Edge Function: scraper-runner
// Scrapes OLX/Dubizzle Egypt and Aqarmap using their public APIs/RSS feeds.
// Falls back to manual-import CSV endpoint if scraping is blocked.
// Called on schedule via pg_cron or a cron service.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── OLX/Dubizzle: use their public RSS/listing search ────────────────────────
async function scrapeOLX(searchUrl: string): Promise<Array<Partial<Record<string, string>>>> {
  try {
    // OLX Egypt RSS feed for property listings
    const rssUrl = searchUrl || 'https://www.olx.com.eg/api/relevance/search?category=12&location=12&page=1&per_page=20'
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CRM Bot)',
        'Accept': 'application/json',
      },
    })
    if (!res.ok) return []
    const text = await res.text()

    // Try JSON parse first
    try {
      const json = JSON.parse(text)
      const ads = json.data?.ads || json.ads || []
      return ads.map((ad: Record<string, unknown>) => ({
        full_name:        (ad.user as Record<string, unknown>)?.name as string || 'OLX Seller',
        phone:            (ad.user as Record<string, unknown>)?.phone as string || '',
        property_location: (ad.location as Record<string, unknown>)?.city_name as string || '',
        property_price:   String((ad.price_value as number) || ''),
        property_area:    ad.category_name as string || '',
        source:           'olx_dubizzle',
        type:             'seller',
        external_id:      String(ad.id || ''),
      })).filter((l: { phone: string }) => l.phone)
    } catch {
      // Not JSON — likely blocked or HTML response
      return []
    }
  } catch { return [] }
}

// ── Aqarmap: use their public search API ─────────────────────────────────────
async function scrapeAqarmap(searchUrl: string): Promise<Array<Partial<Record<string, string>>>> {
  try {
    const apiUrl = searchUrl || 'https://aqarmap.com.eg/api/v3/listing/search/?category=1&page=1'
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CRM Bot)',
        'Accept': 'application/json',
      },
    })
    if (!res.ok) return []
    const json = await res.json()
    const listings = json.results || json.listings || []
    return listings.map((l: Record<string, unknown>) => ({
      full_name:        (l.user as Record<string, unknown>)?.name as string || 'Aqarmap Seller',
      phone:            (l.user as Record<string, unknown>)?.phone as string || '',
      property_location: l.location as string || '',
      property_price:   String(l.price || ''),
      property_size:    String(l.area || ''),
      property_type:    l.category_name as string || '',
      source:           'aqarmap',
      type:             'seller',
      external_id:      String(l.id || ''),
    })).filter((l: { phone: string }) => l.phone)
  } catch { return [] }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── Manual CSV import endpoint ───────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      // body.leads = array of lead objects from CSV import
      if (body.leads && Array.isArray(body.leads)) {
        let created = 0
        for (const lead of body.leads) {
          const { error } = await supabase.from('leads').insert({
            full_name: lead.full_name || lead.name || 'Unknown',
            phone:     lead.phone || lead.mobile || '',
            email:     lead.email || '',
            source:    lead.source || 'manual',
            type:      lead.type || 'buyer',
            status:    'new',
          })
          if (!error) created++
        }
        return new Response(JSON.stringify({ created }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // ── Scheduled scrape (GET) ───────────────────────────────────────────────
  const logId = crypto.randomUUID()
  await supabase.from('scraper_logs').insert({
    id: logId, source: 'all', status: 'running',
  })

  try {
    const [{ data: olxUrlSetting }, { data: aqarmapUrlSetting }] = await Promise.all([
      supabase.from('settings').select('value').eq('key','olx_search_url').single(),
      supabase.from('settings').select('value').eq('key','aqarmap_search_url').single(),
    ])

    const [olxLeads, aqarmapLeads] = await Promise.all([
      scrapeOLX(olxUrlSetting?.value || ''),
      scrapeAqarmap(aqarmapUrlSetting?.value || ''),
    ])

    const allLeads = [...olxLeads, ...aqarmapLeads]
    let created = 0

    for (const lead of allLeads) {
      if (!lead.phone || !lead.external_id) continue

      // Dedup by external_id
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('external_id', lead.external_id)
        .maybeSingle()

      if (existing) continue

      const { error } = await supabase.from('leads').insert({
        full_name:        lead.full_name,
        phone:            lead.phone,
        source:           lead.source,
        type:             lead.type,
        status:           'new',
        property_location: lead.property_location,
        property_price:   lead.property_price ? Number(lead.property_price) : null,
        property_size:    lead.property_size   ? Number(lead.property_size)  : null,
        property_type:    lead.property_type,
        external_id:      lead.external_id,
      })
      if (!error) created++
    }

    await supabase.from('scraper_logs').update({
      status:        'success',
      leads_found:   allLeads.length,
      leads_created: created,
      finished_at:   new Date().toISOString(),
    }).eq('id', logId)

    return new Response(JSON.stringify({ found: allLeads.length, created }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    await supabase.from('scraper_logs').update({
      status:        'error',
      error_message: (err as Error).message,
      finished_at:   new Date().toISOString(),
    }).eq('id', logId)

    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
