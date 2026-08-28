const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  return Response.json({
    error: 'Google Places API is permanently disabled in zero-charge mode.',
    code: 'ZERO_CHARGE_MODE',
  }, { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
