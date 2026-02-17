"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Server, Users, MapPin, Globe, Shield, ExternalLink, RefreshCw, AlertTriangle,
  Search, Filter as FilterIcon, X, TrendingUp,
  CalendarDays, Gamepad2, Axe, Gauge, Layers, KeySquare, Tag, Activity, BarChart3, Box
} from "lucide-react"
import { StatCard, ChartCard, BarChart } from "@/components/analytics"
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown"
import { Button, IconButton } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { Loading } from "@/components/ui/Loading"
import { AccordionItem } from "@/components/ui/Accordion"
import { Pagination } from "@/components/ui/Pagination"

interface RustRates { gather?: number; craft?: number; component?: number; scrap?: number }
interface RustSettings { teamUILimit?: number; groupLimit?: number; rates?: RustRates; kits?: boolean; blueprints?: boolean }
interface BMAttributes {
  id: string; name: string; ip: string; port: number; players: number; maxPlayers: number
  status: 'online'|'offline'|'dead'
  details: {
    map?: string; rust_headerimage?: string; rust_description?: string; rust_url?: string
    official?: boolean; pve?: boolean; rust_settings?: RustSettings
    monuments?: string[]; rust_maps?: { monuments?: string[] }
  }
  country: string
}
interface BMServerData { type: 'server'; id: string; attributes: BMAttributes }
interface BMApiResponse { data: BMServerData[] }

interface ProcessedServer {
  id: string; name: string; connectUrl: string; status: 'online'|'offline'|'dead'
  players: number; maxPlayers: number; playerPercentage: number
  headerImage?: string; description?: string; serverUrl?: string
  region: string; teamLimit: string; isPVE: boolean; isOfficial: boolean
  primaryGamemode: string; wipeSchedule: string; hasBlueprints: boolean; hasKits: boolean
  rates: { gather: number; craft: number; component: number; scrap: number }
}

interface ServerStats {
  totalPlayers: number; onlineServers: number; averagePlayersPerOnlineServer: number
  avgGatherRatePop: number; avgCraftRatePop: number; avgComponentRatePop: number; avgScrapRatePop: number
  regionPopulation: Record<string, number>; teamLimitPopulation: Record<string, number>
  primaryGamemodePopulation: Record<string, number>; pvePopulation: Record<string, number>
  gatherRatePopulation: Record<string, number>; craftRatePopulation: Record<string, number>
  componentRatePopulation: Record<string, number>; scrapRatePopulation: Record<string, number>
  wipeSchedulePopulation: Record<string, number>; playerDensityPopulation: Record<string, number>
  maxPlayersPopulation: Record<string, number>; mapNamePopulation: Record<string, number>
  blueprintStatusPopulation: Record<string, number>; kitsPopulation: Record<string, number>
  monumentPopulation: Record<string, number>; keywordFrequency: Record<string, number>
  keywordNamePopulation: Record<string, number>
}

const WIPE_PATTERNS: [RegExp, string][] = [
  [/\b(weekly|weekly wipes|wipes weekly)\b/gi,"Weekly"],
  [/\b(bi-weekly|biweekly|bi weekly|2 weeks|fortnightly)\b/gi,"Bi-Weekly"],
  [/\b(monthly|monthly wipes|wipes monthly)\b/gi,"Monthly"],
  [/\b(forced only|forced wipe|force wipe)\b/gi,"Forced Only"],
  [/\b(no wipe)\b/gi,"No Wipe"]
]
const EU_COUNTRY_CODES = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','GB'])
const NA_COUNTRY_CODES = new Set(['US','CA'])
const AU_COUNTRY_CODES = new Set(['AU','NZ'])
const WHITELIST_MONUMENTS = new Set(['Large Harbor','Small Harbor','Fishing Village','Military Base','Arctic Research Base','Airfield','Excavator','Launch Site','Trainyard','Water Treatment','Military Tunnels','Powerplant','Outpost','Nuclear Missile Silo','Junkyard','Satellite Dish','Sewer Branch','Underwater Lab','Small Oilrig','Large Oilrig','Lighthouse'])
const WHITELIST_RUST_KEYWORDS = new Set(['pvp','pve','raid','vanilla','modded','custom','semi-vanilla','hardcore','creative','roleplay','rp','aimtrain','battlefield','minigames','events','economy','kits','shop','loot','betterloot','gather','resources','stack','quicksmelt','teleport','tp','sethome','remove','bgrade','skinbox','1x','2x','3x','5x','10x','performance','optimized','anticheat','community','zerg','purge','nude','nobps','bpwipe'])

const getRegion = (c: string) => EU_COUNTRY_CODES.has(c) ? "EU" : NA_COUNTRY_CODES.has(c) ? "NA" : AU_COUNTRY_CODES.has(c) ? "AU" : c
const getTeamLimit = (a: BMAttributes): string => {
  const s = a.details.rust_settings
  if (s) {
    let l: number | undefined
    if (typeof s.teamUILimit === 'number' && s.teamUILimit >= 0) l = s.teamUILimit
    else if (typeof s.groupLimit === 'number' && s.groupLimit >= 0) l = s.groupLimit
    if (l !== undefined) {
      if (l === 0 || l >= 50) return "No Limit"
      if (l === 1) return "Solo"
      return `Max ${l}`
    }
  }
  const d = a.details.rust_description || ''
  const m = d.match(/(?:max team|team limit|group limit|max group)\s*[:\s-]*(\d+)/i)
  if (m && m[1]) return `Max ${m[1]}`
  if (/solo[\s\/]duo[\s\/]trio/i.test(d)) return "Solo/Duo/Trio"
  if (/solo[\s\/]duo/i.test(d)) return "Solo/Duo"
  if (/solo only/i.test(d)) return "Solo"
  return "Varies"
}
const getPrimaryGamemode = (a: BMAttributes): string => {
  const t = (a.name + ' ' + (a.details.rust_description || '')).toLowerCase()
  if (/\b(bedwars|minigame|arena)\b/i.test(t)) return "Bedwars/Minigames"
  if (/\b(aim|aimtrain|combat|ffa|battlefield)\b/i.test(t)) return "Aim Train/Combat"
  if (/\b(creative|build|sandbox)\b/i.test(t)) return "Creative/Build"
  if (/\b(rp|roleplay)\b/i.test(t)) return "Roleplay"
  return "PVP/Survival"
}
const getWipeSchedule = (d?: string): string => {
  if (!d) return "Unknown"
  for (const [p, n] of WIPE_PATTERNS) { if (p.test(d)) return n }
  return "Varies"
}
const getHasBlueprints = (a: BMAttributes): boolean => a.details.rust_settings?.blueprints ?? true
const getKitsStatus = (a: BMAttributes): boolean => {
  if (a.details.rust_settings?.kits === true) return true
  const t = (a.name + ' ' + (a.details.rust_description || '')).toLowerCase()
  return /\b(kits?|kit shop|vip kits?)\b/i.test(t)
}
const getPlayerDensityCategory = (p: number, m: number): string => {
  if (m === 0) return "N/A"
  const r = p / m
  if (r >= 0.9) return "High Demand (90-100%)"
  if (r >= 0.75) return "Healthy (75-90%)"
  if (r >= 0.5) return "Medium (50-75%)"
  if (r >= 0.25) return "Low (25-50%)"
  return "Empty (0-25%)"
}
const getMaxPlayersCategory = (m?: number): string => {
  if (!m) return "Unknown"
  if (m <= 100) return "Low Cap (≤100)"
  if (m <= 200) return "Med Cap (101-200)"
  if (m <= 300) return "High Cap (201-300)"
  return "Mega Cap (>300)"
}
const getRateValue = (r: RustRates | undefined, k: keyof RustRates): number => (r && typeof r[k] === 'number') ? r[k]! : 1
const formatRate = (r: number): string => r > 100000 ? "100000x+" : `${r.toFixed(1).replace(/\.0$/, '')}x`
const analyzeKeywords = (t: string[]): Record<string, number> => {
  const k: Record<string, number> = {}
  t.forEach(s => {
    if (!s) return
    const w = s.toLowerCase().replace(/[^\w\s\d.x-]/g, "").split(/\s+/)
    w.forEach(word => {
      if (WHITELIST_RUST_KEYWORDS.has(word) || /^\d+(\.\d)?x$/.test(word)) k[word] = (k[word] || 0) + 1
    })
  })
  return k
}

function useDebounce<T>(v: T, d: number): T {
  const [dV, sDV] = useState<T>(v)
  useEffect(() => {
    const h = setTimeout(() => sDV(v), d)
    return () => clearTimeout(h)
  }, [v, d])
  return dV
}

const COLORS = ['#a855f7', '#ec4899', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6']

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="mb-6">
      <AccordionItem
        title={title}
        leftIcon={<Icon className="h-5 w-5" />}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        {children}
      </AccordionItem>
    </div>
  )
}

function ServerCard({ server }: { server: ProcessedServer }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden hover:border-purple-500/30 transition-all duration-300 flex flex-col h-full"
    >
      {server.headerImage && (
        <div className="relative h-28 bg-zinc-800 shrink-0">
          <img
            src={server.headerImage}
            alt={`${server.name} banner`}
            className="w-full h-full object-cover"
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          />
        </div>
      )}
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-sm font-bold text-purple-400 truncate pr-2" title={server.name}>
            {server.name}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" size="sm">{server.region}</Badge>
            <span className={`w-2.5 h-2.5 rounded-full ${server.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mb-3 text-xs">
          <Badge variant="primary" size="sm" leftIcon={<Gamepad2 size={10} />}>
            {server.primaryGamemode}
          </Badge>
          {server.isOfficial && <Badge variant="warning" size="sm">Official</Badge>}
          {server.isPVE && <Badge variant="info" size="sm">PVE</Badge>}
          {server.hasKits && <Badge variant="secondary" size="sm">Kits</Badge>}
          {!server.hasBlueprints && <Badge variant="error" size="sm">No BPs</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-400 mb-3">
          <p className="flex items-center col-span-2">
            <Users size={12} className="mr-1.5 text-purple-400" />
            {server.players}/{server.maxPlayers} ({server.playerPercentage}%)
          </p>
          <p className="flex items-center">
            <Shield size={12} className="mr-1.5 text-purple-400" />{server.teamLimit}
          </p>
          <p className="flex items-center">
            <Axe size={12} className="mr-1.5 text-purple-400" />{formatRate(server.rates.gather)}
          </p>
          <p className="flex items-center col-span-2">
            <CalendarDays size={12} className="mr-1.5 text-purple-400" />{server.wipeSchedule}
          </p>
        </div>
        <div className="mt-auto flex gap-2 pt-2 border-t border-white/5">
          <a
            href={server.connectUrl}
            className="flex-grow text-center bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            Connect
          </a>
          {server.serverUrl && (
            <a
              href={server.serverUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/5 hover:bg-white/10 text-white p-1.5 rounded-lg transition-colors"
              title="Website/Discord"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}


const ITEMS_PER_PAGE = 24

export default function ServerStatsPage() {
  const [allServers, setAllServers] = useState<ProcessedServer[]>([])
  const [overallStats, setOverallStats] = useState<ServerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      return params.get('search') || ""
    }
    return ""
  })
  const [selectedRegion, setSelectedRegion] = useState("")
  const [selectedGamemode, setSelectedGamemode] = useState("")
  const [selectedTeamLimit, setSelectedTeamLimit] = useState("")
  const [selectedPVE, setSelectedPVE] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [regionOptions, setRegionOptions] = useState<string[]>([])
  const [gamemodeOptions, setGamemodeOptions] = useState<string[]>([])
  const [teamLimitOptions, setTeamLimitOptions] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const debouncedSearchTerm = useDebounce(searchTerm, 500)

  const processAndSetData = useCallback((rawData: BMApiResponse) => {
    let totalPlayers = 0, onlineServers = 0
    let gatherRateProduct = 0, craftRateProduct = 0, componentRateProduct = 0, scrapRateProduct = 0
    const stats: Omit<ServerStats, 'totalPlayers' | 'onlineServers' | 'averagePlayersPerOnlineServer' | 'avgGatherRatePop' | 'avgCraftRatePop' | 'avgComponentRatePop' | 'avgScrapRatePop'> = {
      regionPopulation: {}, teamLimitPopulation: {}, primaryGamemodePopulation: {}, pvePopulation: {},
      gatherRatePopulation: {}, craftRatePopulation: {}, componentRatePopulation: {}, scrapRatePopulation: {},
      wipeSchedulePopulation: {}, playerDensityPopulation: {}, maxPlayersPopulation: {}, mapNamePopulation: {},
      blueprintStatusPopulation: {}, kitsPopulation: {}, monumentPopulation: {},
      keywordFrequency: {}, keywordNamePopulation: {}
    }
    const uniqueRegions = new Set<string>(), uniqueGamemodes = new Set<string>(), uniqueTeamLimits = new Set<string>()
    const allServerTexts: string[] = []

    const processedServers = rawData.data.filter(s => s.type === 'server' && s.attributes).map((serverData): ProcessedServer => {
      const attr = serverData.attributes
      const p = attr.players, m = attr.maxPlayers
      const desc = attr.details.rust_description
      const teamLimit = getTeamLimit(attr)
      const primaryGamemode = getPrimaryGamemode(attr)
      const rates = {
        gather: getRateValue(attr.details.rust_settings?.rates, 'gather'),
        craft: getRateValue(attr.details.rust_settings?.rates, 'craft'),
        component: getRateValue(attr.details.rust_settings?.rates, 'component'),
        scrap: getRateValue(attr.details.rust_settings?.rates, 'scrap')
      }
      const isPVE = attr.details.pve === true
      const wipeSchedule = getWipeSchedule(desc)
      const hasBlueprints = getHasBlueprints(attr)
      const hasKits = getKitsStatus(attr)

      if (desc) allServerTexts.push(desc)
      if (attr.name) allServerTexts.push(attr.name)

      if (attr.status === 'online' && p > 0) {
        totalPlayers += p; onlineServers++
        uniqueRegions.add(getRegion(attr.country)); uniqueGamemodes.add(primaryGamemode); uniqueTeamLimits.add(teamLimit)
        const inc = (rec: Record<string, number>, key: string, val: number) => { rec[key] = (rec[key] || 0) + val }
        inc(stats.regionPopulation, getRegion(attr.country), p)
        inc(stats.teamLimitPopulation, teamLimit, p)
        inc(stats.primaryGamemodePopulation, primaryGamemode, p)
        inc(stats.pvePopulation, isPVE ? "PVE" : "PVP", p)
        inc(stats.wipeSchedulePopulation, wipeSchedule, p)
        inc(stats.playerDensityPopulation, getPlayerDensityCategory(p, m), p)
        inc(stats.maxPlayersPopulation, getMaxPlayersCategory(m), p)
        if (attr.details.map) inc(stats.mapNamePopulation, attr.details.map, p)
        inc(stats.blueprintStatusPopulation, hasBlueprints ? "Blueprints Enabled" : "No Blueprints", p)
        inc(stats.kitsPopulation, hasKits ? "Kits Available" : "No Kits", p)
        const monuments = attr.details.rust_maps?.monuments || attr.details.monuments
        if (Array.isArray(monuments)) monuments.forEach(monumentName => { if (WHITELIST_MONUMENTS.has(monumentName)) inc(stats.monumentPopulation, monumentName, p) })
        inc(stats.gatherRatePopulation, formatRate(rates.gather), p)
        inc(stats.craftRatePopulation, formatRate(rates.craft), p)
        inc(stats.componentRatePopulation, formatRate(rates.component), p)
        inc(stats.scrapRatePopulation, formatRate(rates.scrap), p)
        gatherRateProduct += rates.gather * p
        craftRateProduct += rates.craft * p
        componentRateProduct += rates.component * p
        scrapRateProduct += rates.scrap * p
        if (attr.name) {
          const serverNameKeywords = attr.name.toLowerCase().replace(/[^\w\s\d.x-]/g, "").split(/\s+/)
          const uniqueKeywordsInName = new Set<string>()
          serverNameKeywords.forEach(word => {
            if (WHITELIST_RUST_KEYWORDS.has(word) || /^\d+(\.\d)?x$/.test(word)) uniqueKeywordsInName.add(word)
          })
          uniqueKeywordsInName.forEach(keyword => inc(stats.keywordNamePopulation, keyword, p))
        }
      }
      return {
        id: serverData.id, name: attr.name, connectUrl: `steam://connect/${attr.ip}:${attr.port}`,
        status: attr.status, players: p, maxPlayers: m, playerPercentage: m > 0 ? Math.round((p / m) * 100) : 0,
        headerImage: attr.details.rust_headerimage, description: desc, serverUrl: attr.details.rust_url,
        region: getRegion(attr.country), teamLimit, isPVE, isOfficial: attr.details.official === true,
        primaryGamemode, wipeSchedule, hasBlueprints, hasKits, rates
      }
    })

    setAllServers(processedServers)
    stats.keywordFrequency = analyzeKeywords(allServerTexts)
    setOverallStats({
      totalPlayers, onlineServers, averagePlayersPerOnlineServer: onlineServers > 0 ? totalPlayers / onlineServers : 0,
      avgGatherRatePop: totalPlayers > 0 ? gatherRateProduct / totalPlayers : 0,
      avgCraftRatePop: totalPlayers > 0 ? craftRateProduct / totalPlayers : 0,
      avgComponentRatePop: totalPlayers > 0 ? componentRateProduct / totalPlayers : 0,
      avgScrapRatePop: totalPlayers > 0 ? scrapRateProduct / totalPlayers : 0,
      ...stats
    })

    const sortAndSet = (s: React.Dispatch<React.SetStateAction<string[]>>, d: Set<string>, p: string[] = []) => {
      const sort = Array.from(d).sort((a, b) => {
        const aP = p.indexOf(a), bP = p.indexOf(b)
        if (aP !== -1 && bP !== -1) return aP - bP
        if (aP !== -1) return -1
        if (bP !== -1) return 1
        return a.localeCompare(b)
      })
      s(["", ...sort])
    }
    sortAndSet(setRegionOptions, uniqueRegions, ['EU', 'NA', 'AU'])
    sortAndSet(setGamemodeOptions, uniqueGamemodes, ['PVP/Survival', 'Aim Train/Combat', 'Creative/Build'])
    sortAndSet(setTeamLimitOptions, uniqueTeamLimits, ['Solo', 'Max 2', 'Max 3', 'Max 4', 'Max 5', 'Max 6', 'Max 8'])
  }, [])

  const fetchServers = useCallback(async () => {
    setLoading(true); setError(null)
    const qP = new URLSearchParams()
    if (debouncedSearchTerm) qP.append('name_query', debouncedSearchTerm)
    if (selectedRegion) qP.append('region', selectedRegion)
    try {
      const r = await fetch(`/api/rust-servers?${qP.toString()}`)
      if (!r.ok) {
        const eD = await r.json().catch(() => ({ error: "API error" }))
        throw new Error(eD.error || `HTTP ${r.status}`)
      }
      const rd: BMApiResponse = await r.json()
      processAndSetData(rd)
      setCurrentPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown fetch error")
      setAllServers([]); setOverallStats(null)
    } finally {
      setLoading(false)
    }
  }, [processAndSetData, debouncedSearchTerm, selectedRegion])

  useEffect(() => { fetchServers() }, [fetchServers])
  useEffect(() => { setCurrentPage(1) }, [selectedGamemode, selectedTeamLimit, selectedPVE])

  const filteredServers = useMemo(() => {
    return allServers.filter(s => {
      const gamemodeMatch = selectedGamemode ? s.primaryGamemode === selectedGamemode : true
      const teamLimitMatch = selectedTeamLimit ? s.teamLimit === selectedTeamLimit : true
      const pveMatch = selectedPVE ? String(s.isPVE) === selectedPVE : true
      let nameMatch = true
      if (debouncedSearchTerm) {
        const escapedSearchTerm = debouncedSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const searchRegex = new RegExp(`\\b${escapedSearchTerm}\\b`, 'i')
        nameMatch = searchRegex.test(s.name)
      }
      return nameMatch && gamemodeMatch && teamLimitMatch && pveMatch
    })
  }, [allServers, debouncedSearchTerm, selectedGamemode, selectedTeamLimit, selectedPVE])

  const paginatedServers = useMemo(() => {
    const sI = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredServers.slice(sI, sI + ITEMS_PER_PAGE)
  }, [filteredServers, currentPage])

  const totalPages = Math.ceil(filteredServers.length / ITEMS_PER_PAGE)
  const handleResetFilters = () => {
    setSearchTerm(""); setSelectedRegion(""); setSelectedGamemode(""); setSelectedTeamLimit(""); setSelectedPVE("")
  }

  const toBarData = (rec: Record<string, number>, topN = 10) =>
    Object.entries(rec).sort(([, a], [, b]) => b - a).slice(0, topN).map(([label, value]) => ({ label, value }))

  const handleKeywordClick = (keyword: string) => {
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}?search=${encodeURIComponent(keyword)}`
      window.open(newUrl, '_blank')
    }
  }

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <TrendingUp className="h-6 w-6 text-purple-400" />
              </div>
              Global Rust Analytics
            </h1>
            <p className="text-zinc-500 mt-2">Real-time server statistics from BattleMetrics (Top 1000)</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowFilters(p => !p)}
              variant="secondary"
              leftIcon={<FilterIcon className="h-4 w-4" />}
            >
              Filters
            </Button>
            <Button
              onClick={fetchServers}
              disabled={loading}
              loading={loading}
              leftIcon={<RefreshCw className="h-4 w-4" />}
              variant="primary"
            >
              Refresh
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-5 rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Server Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g., pvp, 2x, vanilla"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 pl-10 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 text-sm"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Region</label>
                  <Dropdown
                    value={selectedRegion}
                    options={regionOptions.map(c => ({ value: c, label: c || "All Regions" }))}
                    onChange={(val) => setSelectedRegion(val || '')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Gamemode</label>
                  <Dropdown
                    value={selectedGamemode}
                    options={gamemodeOptions.map(c => ({ value: c, label: c || "All Gamemodes" }))}
                    onChange={(val) => setSelectedGamemode(val || '')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Team Limit</label>
                  <Dropdown
                    value={selectedTeamLimit}
                    options={teamLimitOptions.map(c => ({ value: c, label: c || "All Limits" }))}
                    onChange={(val) => setSelectedTeamLimit(val || '')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Type</label>
                  <Dropdown
                    value={selectedPVE}
                    options={[
                      { value: '', label: 'All Types' },
                      { value: 'false', label: 'PVP' },
                      { value: 'true', label: 'PVE' }
                    ]}
                    onChange={(val) => setSelectedPVE(val || '')}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleResetFilters}
                  variant="ghost"
                  size="sm"
                  leftIcon={<X className="h-4 w-4" />}
                >
                  Reset Filters
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && (
          <Loading size="lg" text="Analyzing global player distribution..." />
        )}

        {error && !loading && (
          <div className="text-center py-10 bg-red-500/10 border border-red-500/30 p-6 rounded-xl">
            <AlertTriangle className="h-10 w-10 mx-auto text-red-400 mb-4" />
            <p className="text-lg font-semibold text-red-300 mb-4">Error: {error}</p>
            <Button onClick={fetchServers} variant="primary">
              Try Again
            </Button>
          </div>
        )}

        {!loading && !error && overallStats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard label="Total Players" value={overallStats.totalPlayers} subtitle="Currently online" icon={Users} delay={0} />
              <StatCard label="Online Servers" value={overallStats.onlineServers} icon={Server} iconColor="text-green-400" iconBgColor="bg-green-500/20" delay={0.1} />
              <StatCard label="Avg Players/Server" value={overallStats.averagePlayersPerOnlineServer.toFixed(1)} icon={Activity} iconColor="text-blue-400" iconBgColor="bg-blue-500/20" delay={0.2} />
              <StatCard label="Pop. Avg Gather" value={`${overallStats.avgGatherRatePop.toFixed(2)}x`} icon={TrendingUp} iconColor="text-yellow-400" iconBgColor="bg-yellow-500/20" delay={0.3} />
            </div>

            <CollapsibleSection title="Server Health & Popularity" icon={Gauge}>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Players by Server Fullness" icon={Layers} delay={0.1}>
                  <div className="h-72"><BarChart data={toBarData(overallStats.playerDensityPopulation)} colors={COLORS} /></div>
                </ChartCard>
                <ChartCard title="Players by Server Capacity" icon={Box} delay={0.15}>
                  <div className="h-72"><BarChart data={toBarData(overallStats.maxPlayersPopulation)} colors={COLORS} /></div>
                </ChartCard>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Player Demographics" icon={Users}>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Players by Region" icon={Globe} delay={0.1}>
                  <div className="h-72"><BarChart data={toBarData(overallStats.regionPopulation)} colors={COLORS} /></div>
                </ChartCard>
                <ChartCard title="Players by Gamemode" icon={Gamepad2} delay={0.15}>
                  <div className="h-72"><BarChart data={toBarData(overallStats.primaryGamemodePopulation)} colors={COLORS} /></div>
                </ChartCard>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Map & World Insights" icon={MapPin}>
              <ChartCard title="Most Popular Monuments" icon={MapPin} delay={0.1} className="mb-6">
                <div className="h-80"><BarChart data={toBarData(overallStats.monumentPopulation, 20)} colors={COLORS} maxItems={20} /></div>
              </ChartCard>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Top Maps by Player Count" icon={Globe} delay={0.15}>
                  <div className="h-72"><BarChart data={toBarData(overallStats.mapNamePopulation)} colors={COLORS} /></div>
                </ChartCard>
                <ChartCard title="Wipe Schedule Distribution" icon={CalendarDays} delay={0.2}>
                  <div className="h-72"><BarChart data={toBarData(overallStats.wipeSchedulePopulation)} colors={COLORS} /></div>
                </ChartCard>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Gameplay Mechanics" icon={Box}>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Blueprint System" icon={Shield} delay={0.1}>
                  <div className="h-64"><BarChart data={toBarData(overallStats.blueprintStatusPopulation)} colors={COLORS} /></div>
                </ChartCard>
                <ChartCard title="Kit Availability" icon={Box} delay={0.15}>
                  <div className="h-64"><BarChart data={toBarData(overallStats.kitsPopulation)} colors={COLORS} /></div>
                </ChartCard>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Economic Rate Analysis" icon={Axe}>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Players by Gather Rate" icon={Axe} delay={0.1}>
                  <div className="h-64"><BarChart data={toBarData(overallStats.gatherRatePopulation)} colors={COLORS} /></div>
                </ChartCard>
                <ChartCard title="Players by Craft Rate" icon={Axe} delay={0.15}>
                  <div className="h-64"><BarChart data={toBarData(overallStats.craftRatePopulation)} colors={COLORS} /></div>
                </ChartCard>
                <ChartCard title="Players by Component Rate" icon={Axe} delay={0.2}>
                  <div className="h-64"><BarChart data={toBarData(overallStats.componentRatePopulation)} colors={COLORS} /></div>
                </ChartCard>
                <ChartCard title="Players by Scrap Rate" icon={Axe} delay={0.25}>
                  <div className="h-64"><BarChart data={toBarData(overallStats.scrapRatePopulation)} colors={COLORS} /></div>
                </ChartCard>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Popular Keywords (Server Names)" icon={KeySquare}>
              <ChartCard title="Top Keywords by Player Count" icon={Tag} delay={0.1}>
                <div className="h-80"><BarChart data={toBarData(overallStats.keywordNamePopulation, 30)} colors={COLORS} maxItems={30} /></div>
              </ChartCard>
            </CollapsibleSection>

            <CollapsibleSection title="Keyword Cloud" icon={Tag} defaultOpen={false}>
              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
                <h4 className="text-sm font-semibold text-purple-400 mb-4">Top 50 Keywords (Click to search)</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(overallStats.keywordFrequency).sort(([, a], [, b]) => b - a).slice(0, 50).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => handleKeywordClick(k)}
                      className="text-zinc-400 hover:text-white text-sm px-3 py-1 rounded-full transition-all bg-white/[0.03] border border-white/5 hover:border-purple-500/30"
                    >
                      {k}
                      <span className="ml-2 text-xs text-purple-400 font-mono px-1.5 py-0.5 rounded bg-purple-500/20">{v}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CollapsibleSection>

            {filteredServers.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h3 className="text-xl font-semibold text-center text-white mb-6 mt-8">
                  Server List ({filteredServers.length.toLocaleString()} servers)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {paginatedServers.map(s => <ServerCard key={s.id} server={s} />)}
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-center mt-8">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </motion.div>
            ) : (
              <EmptyState
                leftIcon={<Server className="h-12 w-12" />}
                title="No servers found matching your criteria"
                description={searchTerm ? `Your search for "${searchTerm}" yielded no results.` : undefined}
              />
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
