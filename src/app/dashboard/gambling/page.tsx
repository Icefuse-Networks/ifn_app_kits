"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Dice5, TrendingUp, Trophy, DollarSign, Search, ChevronLeft, ChevronRight } from "lucide-react";

interface GamblingPlayerStats {
  id: string;
  steamId: string;
  playerName: string;
  serverId: string;
  gameType: string;
  wins: number;
  totalWinnings: number;
  totalWagered: number;
  biggestWin: number;
  lastPlayedAt: string;
}

interface GamblingResponse {
  success: boolean;
  data: GamblingPlayerStats[];
  recordsTotal: number;
  recordsFiltered: number;
  page: number;
  limit: number;
}

interface SummaryStats {
  totalPlayers: number;
  totalWins: number;
  totalWinnings: number;
  totalWagered: number;
}

const GAME_TYPES = [
  { value: "", label: "All Games" },
  { value: "coinflip", label: "Coin Flip" },
  { value: "deathroll", label: "Death Roll" },
  { value: "diceduel", label: "Dice Duel" },
];

const SORT_OPTIONS = [
  { value: "totalWinnings", label: "Total Won" },
  { value: "wins", label: "Wins" },
  { value: "biggestWin", label: "Biggest Win" },
  { value: "totalWagered", label: "Total Wagered" },
];

const GAME_TYPE_COLORS: Record<string, string> = {
  coinflip: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  deathroll: "text-red-400 bg-red-400/10 border-red-400/20",
  diceduel: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

const GAME_TYPE_LABELS: Record<string, string> = {
  coinflip: "Coin Flip",
  deathroll: "Death Roll",
  diceduel: "Dice Duel",
};

export default function GamblingAnalyticsPage() {
  const [data, setData] = useState<GamblingPlayerStats[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({ totalPlayers: 0, totalWins: 0, totalWinnings: 0, totalWagered: 0 });
  const [loading, setLoading] = useState(true);
  const [gameFilter, setGameFilter] = useState("");
  const [sortBy, setSortBy] = useState("totalWinnings");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 15;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        order: sortOrder,
        page: page.toString(),
        limit: limit.toString(),
      });
      if (gameFilter) params.set("gameType", gameFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/gambling/stats?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const json: GamblingResponse = await res.json();
      setData(json.data || []);
      setTotalRecords(json.recordsFiltered || 0);
    } catch {
      setData([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [gameFilter, sortBy, sortOrder, search, page]);

  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams({ sortBy: "totalWinnings", order: "desc", page: "0", limit: "1000" });
      if (gameFilter) params.set("gameType", gameFilter);
      const res = await fetch(`/api/gambling/stats?${params}`, { credentials: "include" });
      if (!res.ok) return;
      const json: GamblingResponse = await res.json();
      const all = json.data || [];
      setSummary({
        totalPlayers: json.recordsTotal,
        totalWins: all.reduce((sum, p) => sum + p.wins, 0),
        totalWinnings: all.reduce((sum, p) => sum + p.totalWinnings, 0),
        totalWagered: all.reduce((sum, p) => sum + p.totalWagered, 0),
      });
    } catch {}
  }, [gameFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(0);
  };

  const statCards = [
    { label: "Total Players", value: summary.totalPlayers.toLocaleString(), icon: Trophy, color: "text-yellow-400", bg: "from-yellow-500/10 to-yellow-600/5" },
    { label: "Total Wins", value: summary.totalWins.toLocaleString(), icon: TrendingUp, color: "text-green-400", bg: "from-green-500/10 to-green-600/5" },
    { label: "Total Won", value: `$${summary.totalWinnings.toLocaleString()}`, icon: DollarSign, color: "text-emerald-400", bg: "from-emerald-500/10 to-emerald-600/5" },
    { label: "Total Wagered", value: `$${summary.totalWagered.toLocaleString()}`, icon: Dice5, color: "text-purple-400", bg: "from-purple-500/10 to-purple-600/5" },
  ];

  return (
    <div className="p-8">
      <div className="anim-fade-slide-up space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[var(--accent-primary)]/20">
                <Dice5 className="h-6 w-6 text-[var(--accent-primary)]" />
              </div>
              Gambling Analytics
            </h1>
            <p className="text-[var(--text-muted)] mt-2">Leaderboard and statistics across all gambling games</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, idx) => (
            <div
              key={card.label}
              className={`anim-stagger-item rounded-xl bg-gradient-to-br ${card.bg} border border-white/5 p-6 transition-all`}
              style={{ animationDelay: `${(idx + 1) * 80}ms` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-white/5">
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <span className="text-sm text-[var(--text-muted)]">{card.label}</span>
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Game Type Filter */}
          <div className="flex gap-1 bg-[var(--glass-bg)] rounded-lg p-1 border border-white/5">
            {GAME_TYPES.map(gt => (
              <button
                key={gt.value}
                onClick={() => { setGameFilter(gt.value); setPage(0); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  gameFilter === gt.value
                    ? "bg-[var(--accent-primary)] text-white"
                    : "text-[var(--text-muted)] hover:text-white hover:bg-white/5"
                }`}
              >
                {gt.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(0); }}
            className="bg-[var(--glass-bg)] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)]"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
            className="bg-[var(--glass-bg)] border border-white/10 rounded-lg px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors"
          >
            {sortOrder === "desc" ? "▼ Desc" : "▲ Asc"}
          </button>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search player..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="bg-[var(--glass-bg)] border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] w-48"
              />
            </div>
            <button
              type="submit"
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }}
                className="bg-white/5 hover:bg-white/10 text-[var(--text-muted)] px-3 py-2 rounded-lg text-sm transition-colors"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-white/5 overflow-hidden bg-[var(--glass-bg)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider w-16">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Player</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Game</th>
                {SORT_OPTIONS.map(opt => (
                  <th
                    key={opt.value}
                    onClick={() => handleSort(opt.value)}
                    className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  >
                    <span className={sortBy === opt.value ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}>
                      {opt.label} {sortBy === opt.value ? (sortOrder === "desc" ? "▼" : "▲") : ""}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--text-muted)]">Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--text-muted)]">No gambling data found</td></tr>
              ) : (
                data.map((player, idx) => {
                  const rank = page * limit + idx + 1;
                  const rankColor = rank === 1 ? "text-yellow-400" : rank === 2 ? "text-gray-300" : rank === 3 ? "text-amber-600" : "text-[var(--text-muted)]";
                  const gtColor = GAME_TYPE_COLORS[player.gameType] || "text-[var(--text-muted)] bg-white/5 border-white/10";

                  return (
                    <tr key={player.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className={`px-4 py-3 font-bold ${rankColor}`}>{rank}</td>
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">{player.playerName}</span>
                        <span className="text-[var(--text-muted)] text-xs ml-2">{player.steamId}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium border ${gtColor}`}>
                          {GAME_TYPE_LABELS[player.gameType] || player.gameType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-400">${player.totalWinnings.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center font-bold text-yellow-400">{player.wins.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center font-bold text-[var(--accent-primary)]">${player.biggestWin.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-[var(--text-muted)]">${player.totalWagered.toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-muted)]">
              Showing {page * limit + 1}-{Math.min((page + 1) * limit, totalRecords)} of {totalRecords}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-white/10 text-sm text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <span className="flex items-center px-3 py-2 text-sm text-[var(--text-muted)]">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--glass-bg)] border border-white/10 text-sm text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition-colors"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
