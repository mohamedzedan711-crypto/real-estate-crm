// Edge Function: accountant-ai
// Parses natural-language financial entries (action='parse') and confirms them (action='confirm').
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const INCOME_CATEGORIES  = ['property_sale','brokerage_commission','rental_income','other_income']
const EXPENSE_CATEGORIES = ['property_purchase','renovation_maintenance','marketing_ads','salaries','agent_commission','office_overhead','other_expense']

async function calcBalance(admin: ReturnType<typeof createClient>): Promise<number> {
  const [{ data: cap }, { data: inc }, { data: exp }] = await Promise.all([
    admin.from('settings').select('value').eq('key','starting_capital').single(),
    admin.from('financial_entries').select('amount').eq('type','income').eq('confirmed',true),
    admin.from('financial_entries').select('amount').eq('type','expense').eq('confirmed',true),
  ])
  const start    = parseFloat((cap as any)?.value ?? '0')
  const totalInc = ((inc as any[]) ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
  const totalExp = ((exp as any[]) ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
  return start + totalInc - totalExp
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Verify caller is admin or manager
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user: caller } } = await callerClient.auth.getUser()
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
  const { data: cp } = await admin.from('profiles').select('role').eq('id', caller.id).single()
  if (!['admin','manager'].includes((cp as any)?.role)) return new Response(JSON.stringify({ error: 'Admin or manager only' }), {
    status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  try {
    const body = await req.json()
    const { action, lang = 'ar' } = body
    const isAr = lang === 'ar'

    // ── CONFIRM: write entries to DB ────────────────────────────────────────
    if (action === 'confirm') {
      const { entries } = body
      if (!Array.isArray(entries) || entries.length === 0) throw new Error('No entries to confirm')

      const rows = entries.map((e: any) => ({
        type:               e.type,
        category:           e.category,
        amount:             Number(e.amount),
        description:        e.description || null,
        property_reference: e.property_reference || null,
        entry_date:         e.entry_date || new Date().toISOString().split('T')[0],
        created_by:         caller.id,
        confirmed:          true,
        ai_parsed_summary:  e.ai_parsed_summary || null,
      }))

      const { error } = await admin.from('financial_entries').insert(rows)
      if (error) throw error

      const newBalance = await calcBalance(admin)
      const fmtBal = newBalance.toLocaleString('ar-EG')
      const reply = isAr
        ? `✅ تم تسجيل ${entries.length > 1 ? `${entries.length} قيود` : 'القيد'} بنجاح.\nالرصيد الحالي: **${fmtBal} جنيه**`
        : `✅ ${entries.length} entr${entries.length > 1 ? 'ies' : 'y'} logged.\nCurrent balance: **${fmtBal} EGP**`

      return new Response(JSON.stringify({ reply, newBalance }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── PARSE: call Claude to extract transaction(s) ────────────────────────
    if (action === 'parse') {
      const { message, history = [] } = body
      if (!message?.trim()) throw new Error('Message is required')

      const currentBalance = await calcBalance(admin)
      const today = new Date().toISOString().split('T')[0]

      const { data: apiKeyRow } = await admin.from('settings').select('value').eq('key','anthropic_api_key').single()
      const anthropicKey = (apiKeyRow as any)?.value
      if (!anthropicKey) throw new Error('Anthropic API key not configured in Settings')

      const systemPrompt = `You are an AI accounting assistant for an Egyptian real estate company.
The company has two revenue models:
  1. Property flipping — buy, sometimes renovate, then sell for profit.
  2. Brokerage — earn commissions connecting buyers and sellers.

Today: ${today}
Current balance: ${currentBalance.toLocaleString()} EGP (all amounts in EGP, cash only)

Transaction categories:
  INCOME: property_sale | brokerage_commission | rental_income | other_income
  EXPENSE: property_purchase | renovation_maintenance | marketing_ads | salaries | agent_commission | office_overhead | other_expense

Behaviour rules:
- Respond in the same language the user uses (Arabic or English).
- If the user's message describes a transaction, identify type, category, amount, description, property_reference (if a property name/location is mentioned), and date.
- If anything is unclear (especially the amount), ask ONE concise clarifying question — do NOT propose an entry yet.
- Once you have all required fields, call the propose_entries tool immediately. Do not wait for more information if you have enough.
- For multiple transactions in one message, propose all at once.
- Do not repeat information back verbatim — be concise and professional.
- When confirming a proposed entry, summarize it clearly so the user knows exactly what will be logged.`

      const tools = [
        {
          name: 'propose_entries',
          description: 'Call this tool once you have parsed one or more complete financial transactions and are ready to ask the user for confirmation.',
          input_schema: {
            type: 'object',
            properties: {
              entries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type:               { type: 'string', enum: ['income','expense'] },
                    category:           { type: 'string', enum: [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES] },
                    amount:             { type: 'number', description: 'Positive number in EGP' },
                    description:        { type: 'string', description: 'Short human-readable description' },
                    property_reference: { type: 'string', description: 'Property name/location or empty string' },
                    entry_date:         { type: 'string', description: 'YYYY-MM-DD — use today if not mentioned' },
                    ai_parsed_summary:  { type: 'string', description: 'One-line bilingual summary' },
                  },
                  required: ['type','category','amount','description','entry_date'],
                },
              },
              confirmation_message: {
                type: 'string',
                description: 'Clear summary asking the user to confirm. Match the user\'s language.',
              },
            },
            required: ['entries','confirmation_message'],
          },
        },
      ]

      const messages = [
        ...((history as any[]).map((m: any) => ({ role: m.role, content: m.content }))),
        { role: 'user', content: message },
      ]

      const res = await fetch('https://api.anthropic.com/v1/messages', {
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
          tools,
          messages,
        }),
      })

      if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`)
      const aiData = await res.json()

      let pendingEntries: any[] | null = null
      let reply = ''

      for (const block of (aiData.content ?? [])) {
        if (block.type === 'text') {
          reply += block.text
        } else if (block.type === 'tool_use' && block.name === 'propose_entries') {
          pendingEntries = block.input.entries
          reply = block.input.confirmation_message
        }
      }

      return new Response(JSON.stringify({ reply: reply || '...', pendingEntries }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Invalid action')
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
