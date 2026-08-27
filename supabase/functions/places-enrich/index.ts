import { createClient } from 'npm:@supabase/supabase-js@2'

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MONTHLY_REQUEST_LIMIT = 500
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  if (!GOOGLE_MAPS_API_KEY) return Response.json({ error: 'Google Maps API key is not configured' }, { status: 503, headers: corsHeaders })

  const authorization = req.headers.get('Authorization')
  if (!authorization) return Response.json({ error: 'Server login required' }, { status: 401, headers: corsHeaders })
  const token = authorization.replace(/^Bearer\s+/i, '')
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return Response.json({ error: 'Invalid login session' }, { status: 401, headers: corsHeaders })

  const body = await req.json().catch(() => ({}))
  const places = Array.isArray(body.places) ? body.places.slice(0, 20) : []
  if (!places.length) return Response.json({ results: [], usage: { requested: 0, cached: 0 } }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const requests = places.map((place: { name?: string; address?: string }) => ({
    name: String(place.name || '').trim(),
    address: String(place.address || '').trim(),
    queryKey: normalize(`${place.name || ''}|${place.address || ''}`),
  })).filter((place: { name: string }) => place.name)

  const { data: cachedRows } = await supabaseAdmin.from('places_cache').select('query_key,data,updated_at').in('query_key', requests.map((place: { queryKey: string }) => place.queryKey))
  const cache = new Map((cachedRows || []).filter((row) => Date.now() - new Date(row.updated_at).getTime() < CACHE_MAX_AGE_MS).map((row) => [row.query_key, row.data]))
  const misses = requests.filter((place: { queryKey: string }) => !cache.has(place.queryKey))

  if (misses.length) {
    const period = new Date().toISOString().slice(0, 7)
    const { data: allowed, error: quotaError } = await supabaseAdmin.rpc('consume_places_quota', { p_period: period, p_count: misses.length, p_limit: MONTHLY_REQUEST_LIMIT })
    if (quotaError || !allowed) return Response.json({ error: '월 500회 안전 한도에 도달했습니다.', code: 'MONTHLY_LIMIT' }, { status: 429, headers: corsHeaders })
  }

  for (const place of misses) {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.googleMapsUri',
      },
      body: JSON.stringify({ textQuery: [place.name, place.address].filter(Boolean).join(' '), languageCode: 'ko', regionCode: 'JP', maxResultCount: 1 }),
    })
    if (!response.ok) continue
    const payload = await response.json()
    const result = payload.places?.[0] || null
    cache.set(place.queryKey, result)
    await supabaseAdmin.from('places_cache').upsert({ query_key: place.queryKey, data: result, updated_at: new Date().toISOString() })
  }

  const period = new Date().toISOString().slice(0, 7)
  const { data: usageRow } = await supabaseAdmin.from('places_api_usage').select('request_count').eq('period', period).maybeSingle()
  return Response.json({
    results: requests.map((place: { queryKey: string }) => cache.get(place.queryKey) || null),
    usage: { requested: requests.length, cached: requests.length - misses.length, apiCalls: misses.length, monthlyUsed: usageRow?.request_count || 0, monthlyLimit: MONTHLY_REQUEST_LIMIT },
  }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
