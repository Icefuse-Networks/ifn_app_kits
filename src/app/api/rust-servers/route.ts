import { NextRequest, NextResponse } from 'next/server'

interface BMAttributes {
  id: string
  name: string
  ip: string
  port: number
  players: number
  maxPlayers: number
  rank: number
  status: 'online' | 'offline' | 'dead'
  details: {
    map?: string
    rust_headerimage?: string
    rust_world_size?: number
    rust_description?: string
    rust_url?: string
    rust_settings?: {
      teamUILimit?: number
      groupLimit?: number
      rates?: { gather?: number; craft?: number; component?: number; scrap?: number }
      kits?: boolean
      blueprints?: boolean
    }
    official?: boolean
    pve?: boolean
    monuments?: string[]
    rust_maps?: { monuments?: string[] }
  }
  country: string
}

interface BMServerData {
  type: 'server'
  id: string
  attributes: BMAttributes
}

interface BMApiResponse {
  data: BMServerData[]
  links?: { next?: string }
}

const BATTLEMETRICS_API_KEY = process.env.SERVERS_API_KEY || ''
const BATTLEMETRICS_RUST_URL_BASE = 'https://api.battlemetrics.com/servers'
const MAX_SERVERS_TO_FETCH = 1000
const PAGE_SIZE = 100
const REQUEST_REVALIDATE_SECONDS = 120

const EU_COUNTRY_CODES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','GB']
const NA_COUNTRY_CODES = ['US','CA']
const AU_COUNTRY_CODES = ['AU','NZ']

async function fetchBattleMetricsPage(url: string): Promise<BMApiResponse | null> {
  if (!BATTLEMETRICS_API_KEY) return null
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BATTLEMETRICS_API_KEY}`,
        'Accept': 'application/json',
      },
      next: { revalidate: REQUEST_REVALIDATE_SECONDS },
    })
    if (!response.ok) return null
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return await response.json() as BMApiResponse
    }
    return null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  if (!BATTLEMETRICS_API_KEY) {
    return NextResponse.json(
      { error: 'Server configuration error: API key is missing.' },
      { status: 500 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const serverNameQuery = searchParams.get('name_query')
  const regionQuery = searchParams.get('region')

  const baseQueryParts: string[] = [
    'filter[game]=rust',
    'filter[status]=online',
    'sort=-players',
    `page[size]=${PAGE_SIZE}`,
    'fields[server]=name,ip,port,players,maxPlayers,rank,status,country,details',
  ]

  if (serverNameQuery) {
    baseQueryParts.push(`filter[search]=${encodeURIComponent(serverNameQuery)}`)
  }

  if (regionQuery) {
    let countryCodes: string[] = []
    const upperRegion = regionQuery.toUpperCase()
    if (upperRegion === 'EU') countryCodes = EU_COUNTRY_CODES
    else if (upperRegion === 'NA') countryCodes = NA_COUNTRY_CODES
    else if (upperRegion === 'AU') countryCodes = AU_COUNTRY_CODES
    else if (upperRegion.length === 2) countryCodes = [upperRegion]

    if (countryCodes.length > 0) {
      countryCodes.forEach(code => {
        baseQueryParts.push(`filter[countries][]=${code}`)
      })
    }
  }

  const allServersData: BMServerData[] = []
  let nextPageUrl: string | null = `${BATTLEMETRICS_RUST_URL_BASE}?${baseQueryParts.join('&')}`
  let pagesFetched = 0
  const maxPagesToFetch = Math.ceil(MAX_SERVERS_TO_FETCH / PAGE_SIZE)

  try {
    while (nextPageUrl && allServersData.length < MAX_SERVERS_TO_FETCH && pagesFetched < maxPagesToFetch) {
      const pageData = await fetchBattleMetricsPage(nextPageUrl)
      pagesFetched++

      if (pageData && Array.isArray(pageData.data) && pageData.data.length > 0) {
        allServersData.push(...pageData.data)
        nextPageUrl = pageData.links?.next || null
      } else {
        break
      }
    }

    const finalServerList = allServersData.slice(0, MAX_SERVERS_TO_FETCH)
    return NextResponse.json({ data: finalServerList })
  } catch {
    return NextResponse.json({ error: 'An unknown server error occurred.' }, { status: 500 })
  }
}
