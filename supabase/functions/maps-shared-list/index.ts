const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const allowedHosts = new Set(['maps.app.goo.gl', 'google.com', 'www.google.com', 'maps.google.com'])

function htmlDecode(value: string) {
  return value.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"')
}

function placeUrl(name: string, address: string, lat: number | null, lng: number | null) {
  const query = [name, address].filter(Boolean).join(' ')
  if (query) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

async function fetchAllowedPage(initialUrl: URL) {
  let currentUrl = initialUrl
  for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
    if (currentUrl.protocol !== 'https:' || !allowedHosts.has(currentUrl.hostname)) throw new Error('안전하지 않은 이동 주소입니다.')
    const response = await fetch(currentUrl, { redirect: 'manual', headers: { 'Accept-Language': 'ko-KR,ko;q=0.9' } })
    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get('location')
    if (!location) throw new Error('공유 목록 이동 주소가 없습니다.')
    currentUrl = new URL(location, currentUrl)
  }
  throw new Error('공유 목록의 이동 횟수가 너무 많습니다.')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await request.json()
    const sourceUrl = new URL(String(body?.url || ''))
    if (sourceUrl.protocol !== 'https:' || !allowedHosts.has(sourceUrl.hostname)) throw new Error('지원하지 않는 링크입니다.')

    const pageResponse = await fetchAllowedPage(sourceUrl)
    if (!pageResponse.ok || !allowedHosts.has(new URL(pageResponse.url).hostname)) throw new Error('공유 목록을 열 수 없습니다.')
    const page = await pageResponse.text()
    const endpointMatch = page.match(/href="([^"']*\/maps\/preview\/entitylist\/getlist\?[^"']+)"[^>]*rel="preload"/i)
    if (!endpointMatch) throw new Error('공개된 저장 목록이 아닙니다.')

    const endpoint = new URL(htmlDecode(endpointMatch[1]), 'https://www.google.com')
    if (endpoint.hostname !== 'www.google.com' || endpoint.pathname !== '/maps/preview/entitylist/getlist') throw new Error('안전하지 않은 목록 주소입니다.')
    const listResponse = await fetch(endpoint, { headers: { 'Accept-Language': 'ko-KR,ko;q=0.9' } })
    if (!listResponse.ok) throw new Error('목록 데이터를 읽지 못했습니다.')
    const raw = await listResponse.text()
    const payload = JSON.parse(raw.replace(/^\)\]\}'\s*/, ''))
    const list = payload?.[0]
    const entries = Array.isArray(list?.[8]) ? list[8] : []
    const listName = String(list?.[4] || 'Google Maps 공유 목록')
    const places = entries.map((entry: unknown[]) => {
      const detail = Array.isArray(entry?.[1]) ? entry[1] : []
      const name = String(entry?.[2] || '').trim()
      const note = String(entry?.[3] || '').trim()
      const address = String(detail?.[4] || detail?.[2] || '').trim()
      const lat = Number(detail?.[5]?.[2])
      const lng = Number(detail?.[5]?.[3])
      const validCoordinates = Number.isFinite(lat) && Number.isFinite(lng)
      return { name, note, address, latitude: validCoordinates ? lat : null, longitude: validCoordinates ? lng : null, url: placeUrl(name, address, validCoordinates ? lat : null, validCoordinates ? lng : null) }
    }).filter((place: { name: string }) => place.name)

    return new Response(JSON.stringify({ listName, places }), { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : '목록을 처리하지 못했습니다.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })
  }
})
