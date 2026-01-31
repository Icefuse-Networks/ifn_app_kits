"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Server, Users, RefreshCw, Clock, Globe, Search, X, User, Plus, Save,
} from "lucide-react";

interface ServerInfo {
  id: number;
  name: string;
  ip: string;
  port: number;
  players: number;
  maxPlayers: number;
  game: string;
  isActive: boolean;
  battlemetricsId?: string;
  imageUrl?: string;
  wipeSchedule?: string;
  createdAt?: string;
  updatedAt?: string;
  wipeStart?: number;
  wipeEnd?: number;
  daysUntilWipe?: number;
}

interface Player {
  steamID: string;
  personaname: string;
  idleTimeSeconds?: number;
}

interface LiveServerData {
  ip: string;
  port: number;
  name: string;
  players: number;
  maxPlayers: number;
  game: string;
  imageUrl: string;
  wipeStart?: number;
  wipeEnd?: number;
  wipeSchedule?: string;
  daysUntilWipe?: number;
  battlemetricsId?: string;
}

const BATTLEMETRICS_MAP: Record<string, string> = {
  "usvanilla.icefuse.net": "3260244",
  "euvanilla.icefuse.net": "24761935",
  "eu2xquad.icefuse.net": "23758263",
  "2xoblivion.icefuse.net": "8939401",
  "3xamigos.icefuse.net": "3665933",
  "us3xquad.icefuse.net": "24122717",
  "us3xunlimited.icefuse.net": "28427024",
  "5xalpha.icefuse.net": "2801795",
  "5xbravo.icefuse.net": "2801208",
  "10xomega.icefuse.net": "2930255",
  "eu10xnobps.icefuse.net": "3657891",
  "us20x.icefuse.net": "29377002",
  "us100x.icefuse.net": "5192962",
  "eu100x.icefuse.net": "29401949",
  "us1000x.icefuse.net": "3044995",
  "eu1000000x.icefuse.net": "4032701",
  "us1000000x.icefuse.net": "28009208",
};

const getBattlemetricsId = (ip: string): string | undefined => {
  for (const [hostname, bmId] of Object.entries(BATTLEMETRICS_MAP)) {
    if (ip.includes(hostname.split(".")[0])) return bmId;
  }
  return BATTLEMETRICS_MAP[ip] || undefined;
};

const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds < 60) return "<1m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const ServerCard = React.memo(({ server, onSelect, isSelected }: { server: ServerInfo; onSelect: (server: ServerInfo) => void; isSelected: boolean }) => {
  const playerPercentage = server.maxPlayers > 0 ? (server.players / server.maxPlayers) * 100 : 0;
  return (
    <motion.div
      className="rounded-xl p-6 cursor-pointer transition-all duration-300 group"
      style={{ background: isSelected ? "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(236,72,153,0.2))" : "rgba(255,255,255,0.02)", border: isSelected ? "1px solid rgba(168,85,247,0.5)" : "1px solid rgba(255,255,255,0.05)" }}
      onClick={() => onSelect(server)}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white truncate pr-2 group-hover:text-purple-400 transition-colors">{server.name}</h3>
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${server.isActive ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
      </div>
      <div className="space-y-3">
        <div className="flex items-center text-zinc-500">
          <Globe className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="text-sm truncate">{server.ip}:{server.port}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center text-zinc-500">
            <Users className="h-4 w-4 mr-2" />
            <span className="text-sm">{server.players}/{server.maxPlayers}</span>
          </div>
          <span className="text-purple-400 font-semibold text-sm">{Math.round(playerPercentage)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
            initial={{ width: "0%" }}
            animate={{ width: `${playerPercentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center text-zinc-600 text-xs">
            <Server className="h-3 w-3 mr-1" />
            <span>{server.game}</span>
          </div>
          {server.daysUntilWipe !== undefined && server.game === "rust" && (
            <div className="flex items-center text-xs">
              <Clock className="h-3 w-3 mr-1 text-orange-400" />
              <span className={server.daysUntilWipe <= 1 ? "text-orange-400" : "text-zinc-500"}>
                {server.daysUntilWipe === 0 ? "Wipes today" : `${server.daysUntilWipe}d until wipe`}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
ServerCard.displayName = "ServerCard";

const PlayerRow = React.memo(({ player }: { player: Player }) => (
  <motion.div
    className="grid grid-cols-3 gap-4 items-center py-3 px-4 rounded-lg hover:bg-white/[0.02] transition-colors"
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
  >
    <div className="flex items-center space-x-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-500/20">
        <User className="h-4 w-4 text-purple-400" />
      </div>
      <span className="font-medium text-white truncate">{player.personaname || "Unknown"}</span>
    </div>
    <span className="text-zinc-500 text-sm font-mono truncate">{player.steamID}</span>
    <div className="text-right">
      {player.idleTimeSeconds !== undefined && player.idleTimeSeconds > 300 && (
        <div className="inline-flex items-center space-x-1.5 text-orange-400 text-sm px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20">
          <Clock className="h-4 w-4" />
          <span>{formatDuration(player.idleTimeSeconds)}</span>
        </div>
      )}
    </div>
  </motion.div>
));
PlayerRow.displayName = "PlayerRow";

export default function ServersPage() {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selectedServer, setSelectedServer] = useState<ServerInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingServers, setLoadingServers] = useState(true);
  const [playersModalOpen, setPlayersModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newServer, setNewServer] = useState({ name: "", ip: "", port: 27015, game: "rust", maxPlayers: 200, battlemetricsId: "", imageUrl: "", wipeSchedule: "" });

  const fetchLiveServerData = async (): Promise<LiveServerData[]> => {
    try {
      const res = await fetch("https://icefuse.net/api/servers/result_main.json");
      if (!res.ok) return [];
      const data = await res.json();
      const liveServers: LiveServerData[] = [];
      for (const entry of data) {
        if (!Array.isArray(entry)) continue;
        const gameType = entry[0];
        const gameMap: Record<number, string> = { 1: "gmod", 2: "rust", 5: "hytale" };
        liveServers.push({
          ip: entry[1],
          port: entry[2],
          imageUrl: entry[3],
          name: entry[4],
          game: gameMap[gameType] || "other",
          players: entry[7] || 0,
          maxPlayers: entry[8] || 0,
          wipeStart: gameType === 2 ? entry[9] : undefined,
          wipeEnd: gameType === 2 ? entry[10] : undefined,
          wipeSchedule: gameType === 2 ? entry[11] : undefined,
          daysUntilWipe: gameType === 2 ? entry[12] : undefined,
        });
      }
      return liveServers;
    } catch {
      return [];
    }
  };

  const fetchServers = useCallback(async () => {
    setLoadingServers(true);
    try {
      const [dbRes, liveData] = await Promise.all([
        fetch("/api/servers"),
        fetchLiveServerData(),
      ]);

      let dbServers: ServerInfo[] = [];
      if (dbRes.ok) {
        dbServers = await dbRes.json();
      }

      const mergedServers = dbServers.map((server) => {
        const live = liveData.find((l) => l.ip === server.ip && l.port === server.port);
        if (live) {
          return {
            ...server,
            players: live.players,
            maxPlayers: live.maxPlayers,
            isActive: true,
            imageUrl: live.imageUrl || server.imageUrl,
            wipeSchedule: live.wipeSchedule || server.wipeSchedule,
            wipeStart: live.wipeStart,
            wipeEnd: live.wipeEnd,
            daysUntilWipe: live.daysUntilWipe,
          };
        }
        return { ...server, isActive: false };
      });

      for (const live of liveData) {
        const exists = mergedServers.some((s) => s.ip === live.ip && s.port === live.port);
        if (!exists) {
          mergedServers.push({
            id: 0,
            name: live.name,
            ip: live.ip,
            port: live.port,
            players: live.players,
            maxPlayers: live.maxPlayers,
            game: live.game,
            isActive: true,
            imageUrl: live.imageUrl,
            wipeSchedule: live.wipeSchedule,
            wipeStart: live.wipeStart,
            wipeEnd: live.wipeEnd,
            daysUntilWipe: live.daysUntilWipe,
            battlemetricsId: getBattlemetricsId(live.ip),
          });
        }
      }

      mergedServers.sort((a, b) => b.players - a.players);
      setServers(mergedServers);
    } catch (error) {
      console.error("Failed to fetch servers:", error);
      toast.error("Failed to fetch servers");
    } finally {
      setLoadingServers(false);
    }
  }, []);

  const fetchPlayers = useCallback(async (server: ServerInfo) => {
    setLoading(true);
    setPlayers([]);

    const bmId = server.battlemetricsId || getBattlemetricsId(server.ip);
    if (!bmId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/server/players/${bmId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.players) {
          setPlayers(data.players.map((p: { steamID: string; personaname: string }) => ({
            steamID: p.steamID,
            personaname: p.personaname,
          })));
        }
      }
    } catch (error) {
      console.error("Failed to fetch players:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleServerSelect = useCallback((server: ServerInfo) => {
    setSelectedServer(server);
    setPlayersModalOpen(true);
    fetchPlayers(server);
  }, [fetchPlayers]);

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.ip || !newServer.port) {
      toast.error("Name, IP, and Port are required");
      return;
    }
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newServer),
      });
      if (res.ok) {
        toast.success("Server added");
        setShowAddModal(false);
        setNewServer({ name: "", ip: "", port: 27015, game: "rust", maxPlayers: 200, battlemetricsId: "", imageUrl: "", wipeSchedule: "" });
        fetchServers();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to add server");
      }
    } catch {
      toast.error("Failed to add server");
    }
  };

  const _handleDeleteServer = async (id: number) => {
    if (!confirm("Delete this server?")) return;
    try {
      const res = await fetch(`/api/servers/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Server deleted");
        fetchServers();
      } else {
        toast.error("Failed to delete server");
      }
    } catch {
      toast.error("Failed to delete server");
    }
  };

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const filteredServers = useMemo(() => servers.filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.ip.includes(searchTerm)), [servers, searchTerm]);

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <Server className="h-6 w-6 text-purple-400" />
              </div>
              Servers
            </h1>
            <p className="text-zinc-500 mt-2">Manage and monitor your game servers</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search servers..." className="rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-600 bg-white/5 border border-white/10 focus:outline-none w-64" />
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-purple-500 to-pink-500">
              <Plus className="h-4 w-4" />
              Add Server
            </button>
            <button onClick={fetchServers} className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-colors">
              <RefreshCw className={`h-5 w-5 ${loadingServers ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {loadingServers ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : filteredServers.length === 0 ? (
          <div className="text-center py-20">
            <Server className="h-16 w-16 mx-auto mb-4 text-zinc-600 opacity-30" />
            <h3 className="text-xl font-medium text-zinc-500 mb-2">No servers found</h3>
            <p className="text-zinc-600 mb-4">Add your first server to get started</p>
            <button onClick={() => setShowAddModal(true)} className="text-purple-400 hover:text-purple-300">Add a server</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServers.map((server, index) => (
              <motion.div key={server.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                <ServerCard server={server} onSelect={handleServerSelect} isSelected={selectedServer?.id === server.id} />
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {playersModalOpen && selectedServer && (
            <motion.div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPlayersModalOpen(false)}
            >
              <motion.div
                className="rounded-xl p-6 w-full max-w-4xl max-h-[80vh] flex flex-col bg-zinc-900 border border-white/10"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedServer.name}</h3>
                    <p className="text-sm text-zinc-500">{selectedServer.ip}:{selectedServer.port}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Users className="h-5 w-5" />
                      <span>{players.length} players</span>
                    </div>
                    <button onClick={() => setPlayersModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 text-purple-400 animate-spin" />
                    <span className="ml-3 text-zinc-500">Loading players...</span>
                  </div>
                ) : players.length > 0 ? (
                  <div className="overflow-y-auto flex-1">
                    <div className="grid grid-cols-3 gap-4 py-2 px-4 text-zinc-500 text-sm font-medium border-b border-white/5 sticky top-0 bg-zinc-900 z-10">
                      <span>Player</span>
                      <span>Steam ID</span>
                      <span className="text-right">Idle Time</span>
                    </div>
                    <div className="space-y-1">
                      {players.map((player, index) => (
                        <PlayerRow key={`${player.steamID}-${index}`} player={player} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-500">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No players online</p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showAddModal && (
            <motion.div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
            >
              <motion.div
                className="rounded-xl p-6 w-full max-w-md bg-zinc-900 border border-white/10"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white">Add Server</h3>
                  <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white"><X className="h-5 w-5" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Name *</label>
                    <input type="text" value={newServer.name} onChange={(e) => setNewServer({ ...newServer, name: e.target.value })} placeholder="My Server" className="w-full rounded-lg px-3 py-2 text-white placeholder-zinc-600 bg-white/5 border border-white/10 focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">IP *</label>
                      <input type="text" value={newServer.ip} onChange={(e) => setNewServer({ ...newServer, ip: e.target.value })} placeholder="192.168.1.1" className="w-full rounded-lg px-3 py-2 text-white placeholder-zinc-600 bg-white/5 border border-white/10 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Port *</label>
                      <input type="number" value={newServer.port} onChange={(e) => setNewServer({ ...newServer, port: parseInt(e.target.value) || 0 })} className="w-full rounded-lg px-3 py-2 text-white bg-white/5 border border-white/10 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Game</label>
                      <select value={newServer.game} onChange={(e) => setNewServer({ ...newServer, game: e.target.value })} className="w-full rounded-lg px-3 py-2 text-white bg-white/5 border border-white/10 focus:outline-none">
                        <option value="rust">Rust</option>
                        <option value="gmod">GMod</option>
                        <option value="minecraft">Minecraft</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Max Players</label>
                      <input type="number" value={newServer.maxPlayers} onChange={(e) => setNewServer({ ...newServer, maxPlayers: parseInt(e.target.value) || 0 })} className="w-full rounded-lg px-3 py-2 text-white bg-white/5 border border-white/10 focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Battlemetrics ID</label>
                    <input type="text" value={newServer.battlemetricsId} onChange={(e) => setNewServer({ ...newServer, battlemetricsId: e.target.value })} placeholder="Optional" className="w-full rounded-lg px-3 py-2 text-white placeholder-zinc-600 bg-white/5 border border-white/10 focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg">Cancel</button>
                  <button onClick={handleAddServer} className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                    <Save className="h-4 w-4" />
                    Add Server
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
