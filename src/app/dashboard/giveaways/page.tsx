"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Gift,
  Server,
  Filter,
  Download,
  Eye,
  Trash2,
  User,
  RefreshCw,
  BarChart3,
  Activity,
  Users,
  Search,
  Plus,
} from "lucide-react";

interface GiveawayPlayer {
  id: string;
  playerName: string;
  playerSteamId64: string;
  playTime: number;
  server: string;
  createdAt: string;
  updatedAt: string;
}

interface Analytics {
  totalPlayers: number;
  totalPlayTime: number;
  playersByServer: { [key: string]: number };
  topPlayers: Array<{
    playerName: string;
    playerSteamId64: string;
    playTime: number;
    server: string;
  }>;
  playTimeDistribution: { [key: string]: number };
  averagePlayTime: number;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
  uniqueServers: number;
}

const StatCard = ({ icon: Icon, title, value, subtitle, delay = 0 }: {
  icon: React.ElementType;
  title: string;
  value: string | number;
  subtitle?: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="rounded-xl p-6 transition-all duration-300"
    style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}
  >
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-[#888] text-sm font-medium mb-1">{title}</p>
        <p className="text-3xl font-bold text-white mb-1">{value}</p>
        {subtitle && <p className="text-xs text-[#a855f7]">{subtitle}</p>}
      </div>
      <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{background:'rgba(168,85,247,0.2)'}}>
        <Icon className="h-6 w-6 text-[#a855f7]" />
      </div>
    </div>
  </motion.div>
);

const AnalyticsChart = ({ title, icon: Icon, data, maxItems = 6, delay = 0 }: {
  title: string;
  icon: React.ElementType;
  data: { [key: string]: number };
  maxItems?: number;
  delay?: number;
}) => {
  const totalCount = Object.values(data).reduce((sum, count) => sum + count, 0);
  const sortedEntries = Object.entries(data)
    .sort(([,a], [,b]) => b - a)
    .slice(0, maxItems);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl p-6"
      style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}
    >
      <div className="flex items-center mb-6">
        <div className="p-2 rounded-lg mr-3" style={{background:'rgba(168,85,247,0.2)'}}>
          <Icon className="h-5 w-5 text-[#a855f7]" />
        </div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      <div className="space-y-4">
        {sortedEntries.map(([key, count], index) => {
          const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + (index * 0.1) }}
              className="flex items-center justify-between"
            >
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#888] text-sm font-medium truncate" title={key}>{key}</span>
                  <span className="text-white font-semibold text-sm ml-2">{count}</span>
                </div>
                <div className="w-full rounded-full h-2" style={{background:'rgba(255,255,255,0.1)'}}>
                  <motion.div
                    className="h-2 rounded-full"
                    style={{background:'linear-gradient(135deg, #a855f7, #ec4899)'}}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ delay: delay + (index * 0.1) + 0.3, duration: 0.8 }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default function GiveawayPage() {
  const [players, setPlayers] = useState<GiveawayPlayer[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredPlayers, setFilteredPlayers] = useState<GiveawayPlayer[]>([]);
  const [winner, setWinner] = useState<GiveawayPlayer | null>(null);
  const [isPickingWinner, setIsPickingWinner] = useState(false);
  const [playerAvatars, setPlayerAvatars] = useState<Record<string, string>>({});
  const [unboxingReel, setUnboxingReel] = useState<GiveawayPlayer[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/giveaways/players?limit=100');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const playersData: GiveawayPlayer[] = result.data;
          setPlayers(playersData);
          setFilteredPlayers(playersData);
          const calculatedAnalytics = calculateAnalyticsFromPlayers(playersData);
          setAnalytics(calculatedAnalytics);
          await fetchPlayerAvatars(playersData);
        }
      }
    } catch (error) {
      console.error('Failed to fetch players:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlayerAvatars = async (playersData: GiveawayPlayer[]) => {
    try {
      const steamIds = playersData.map(p => p.playerSteamId64).join(',');
      const response = await fetch(`https://icefuse.net/api/steam/avatars?steamids=${steamIds}`);
      if (response.ok) {
        const avatars = await response.json();
        setPlayerAvatars(avatars);
      }
    } catch (error) {
      console.error('Failed to fetch avatars:', error);
    }
  };

  const calculateAnalyticsFromPlayers = (playersData: GiveawayPlayer[]): Analytics => {
    const totalPlayers = playersData.length;
    const totalPlayTime = playersData.reduce((sum, player) => sum + player.playTime, 0);
    const averagePlayTime = totalPlayers > 0 ? totalPlayTime / totalPlayers : 0;
    const playersByServer = playersData.reduce((acc, player) => {
      acc[player.server] = (acc[player.server] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    const topPlayers = playersData.sort((a, b) => b.playTime - a.playTime).slice(0, 10);
    const playTimeRanges: { [key: string]: number } = { "0-1h": 0, "1-5h": 0, "5-10h": 0, "10-50h": 0, "50h+": 0 };
    playersData.forEach(player => {
      const hours = player.playTime / 3600;
      if (hours < 1) playTimeRanges["0-1h"]++;
      else if (hours < 5) playTimeRanges["1-5h"]++;
      else if (hours < 10) playTimeRanges["5-10h"]++;
      else if (hours < 50) playTimeRanges["10-50h"]++;
      else playTimeRanges["50h+"]++;
    });
    const recentActivity = playersData.reduce((acc, player) => {
      const date = new Date(player.createdAt).toDateString();
      const existing = acc.find(item => item.date === date);
      if (existing) existing.count++;
      else acc.push({ date, count: 1 });
      return acc;
    }, [] as Array<{ date: string; count: number }>)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);
    const uniqueServers = Object.keys(playersByServer).length;
    return { totalPlayers, totalPlayTime, playersByServer, topPlayers, playTimeDistribution: playTimeRanges, averagePlayTime, recentActivity, uniqueServers };
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredPlayers(players);
    } else {
      const filtered = players.filter(player =>
        player.playerName.toLowerCase().includes(term.toLowerCase()) ||
        player.playerSteamId64.includes(term) ||
        player.server.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredPlayers(filtered);
    }
  };

  const generateUnboxingReel = (finalWinner: GiveawayPlayer): GiveawayPlayer[] => {
    const reelItems: GiveawayPlayer[] = [];
    for (let i = 0; i < 49; i++) {
      const randomPlayer = players[Math.floor(Math.random() * players.length)];
      reelItems.push({ ...randomPlayer, id: `${randomPlayer.id}_${i}` });
    }
    reelItems.push({ ...finalWinner, id: `${finalWinner.id}_winner` });
    return reelItems;
  };

  const pickRandomWinner = () => {
    if (players.length === 0) return;
    setIsPickingWinner(true);
    setWinner(null);
    const finalWinner = players[Math.floor(Math.random() * players.length)];
    const newReel = generateUnboxingReel(finalWinner);
    setUnboxingReel(newReel);
    const audio = new Audio('/unbox.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
    setTimeout(() => {
      if (scrollRef.current) {
        const containerWidth = scrollRef.current.offsetWidth;
        const itemWidth = 120;
        const centerOffset = containerWidth / 2 - itemWidth / 2;
        const finalPosition = (newReel.length - 1) * itemWidth - centerOffset;
        scrollRef.current.style.transform = `translateX(-${finalPosition}px)`;
        scrollRef.current.style.transition = 'transform 4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      }
    }, 100);
    setTimeout(() => {
      setWinner(finalWinner);
      setIsPickingWinner(false);
      const victoryAudio = new Audio('/unbox.mp3');
      victoryAudio.volume = 0.3;
      victoryAudio.play().catch(() => {});
    }, 4500);
  };

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);
  useEffect(() => { handleSearch(searchTerm); }, [players, searchTerm]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{background:'rgba(168,85,247,0.2)'}}>
              <Gift className="h-6 w-6 text-[#a855f7]" />
            </div>
            Giveaway Players
          </h2>
          <p className="text-[#666] mt-2">Monitor player activity and playtime statistics</p>
        </div>
        <div className="flex space-x-3">
          <motion.button
            onClick={fetchPlayers}
            disabled={loading}
            className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg transition-colors"
            style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </motion.button>
          <motion.button
            onClick={pickRandomWinner}
            disabled={players.length === 0 || isPickingWinner}
            className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50"
            style={{background:'linear-gradient(135deg, #a855f7, #ec4899)'}}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Gift className={`h-4 w-4 ${isPickingWinner ? 'animate-spin' : ''}`} />
            <span>{isPickingWinner ? 'Picking...' : 'Pick Winner'}</span>
          </motion.button>
          <motion.button
            className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg transition-colors"
            style={{background:'rgba(34,197,94,0.2)',border:'1px solid rgba(34,197,94,0.3)'}}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="h-4 w-4 text-green-400" />
            <span className="text-green-400">Add Player</span>
          </motion.button>
        </div>
      </div>

      {analytics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard icon={Users} title="Total Players" value={analytics.totalPlayers.toLocaleString()} delay={0.1} />
            <StatCard icon={Clock} title="Total Playtime" value={formatTime(analytics.totalPlayTime)} delay={0.2} />
            <StatCard icon={Activity} title="Average Playtime" value={formatTime(analytics.averagePlayTime)} delay={0.3} />
            <StatCard icon={Server} title="Unique Servers" value={analytics.uniqueServers} delay={0.4} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsChart title="Players by Server" icon={Server} data={analytics.playersByServer} delay={0.5} />
            <AnalyticsChart title="Playtime Distribution" icon={BarChart3} data={analytics.playTimeDistribution} delay={0.6} />
          </div>
        </>
      )}

      {winner && !isPickingWinner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="rounded-xl p-8 shadow-2xl"
          style={{background:'rgba(168,85,247,0.1)',border:'2px solid rgba(168,85,247,0.3)'}}
        >
          <div className="text-center">
            <motion.h3
              className="text-3xl font-bold text-white mb-6 flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
            >
              <Gift className="h-8 w-8 mr-3 text-[#a855f7]" />
              Winner Selected!
            </motion.h3>
            <motion.div
              className="rounded-lg p-8 max-w-lg mx-auto"
              style={{background:'rgba(255,255,255,0.03)',border:'2px solid rgba(168,85,247,0.3)'}}
              initial={{ rotateY: 180, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <div className="flex items-center space-x-6">
                <motion.div
                  className="relative"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.8, duration: 0.5, type: "spring" }}
                >
                  <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg" style={{border:'4px solid #a855f7'}}>
                    {playerAvatars[winner.playerSteamId64] ? (
                      <img src={playerAvatars[winner.playerSteamId64]} alt={winner.playerName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{background:'linear-gradient(135deg, #a855f7, #ec4899)'}}>
                        <User className="h-10 w-10 text-white" />
                      </div>
                    )}
                  </div>
                  <motion.div
                    className="absolute -inset-2 rounded-full"
                    style={{border:'2px solid #a855f7'}}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                </motion.div>
                <div className="flex-1 text-left">
                  <motion.p className="text-2xl font-bold text-white mb-2" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 1.0, duration: 0.5 }}>{winner.playerName}</motion.p>
                  <motion.p className="text-[#888] font-mono text-sm mb-2" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 1.1, duration: 0.5 }}>{winner.playerSteamId64}</motion.p>
                  <motion.p className="text-[#a855f7] text-sm" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 1.2, duration: 0.5 }}>
                    <Clock className="h-4 w-4 inline mr-1" />
                    {formatTime(winner.playTime)} • {winner.server}
                  </motion.p>
                </div>
              </div>
            </motion.div>
            <motion.button
              onClick={() => setWinner(null)}
              className="mt-6 px-8 py-3 text-white rounded-lg transition-all duration-300 font-semibold shadow-lg"
              style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.4, duration: 0.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Close
            </motion.button>
          </div>
        </motion.div>
      )}

      {isPickingWinner && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="rounded-xl p-8 max-w-4xl w-full mx-4" style={{background:'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f1419 100%)',border:'2px solid rgba(168,85,247,0.3)'}}>
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold text-white mb-2">Selecting Winner...</h3>
              <p className="text-[#888]">The reel is spinning to find your winner!</p>
            </div>
            <div className="relative rounded-lg p-6 overflow-hidden" style={{background:'rgba(255,255,255,0.03)',height:'180px'}}>
              <div className="absolute top-0 bottom-0 left-1/2 w-1 transform -translate-x-1/2 z-10 opacity-80" style={{background:'#a855f7'}}></div>
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 transform -translate-x-1/2 z-10" style={{background:'#ec4899'}}></div>
              <div className="absolute top-0 bottom-0 left-0 w-24 z-10" style={{background:'linear-gradient(to right, #0a0a0f, transparent)'}}></div>
              <div className="absolute top-0 bottom-0 right-0 w-24 z-10" style={{background:'linear-gradient(to left, #0a0a0f, transparent)'}}></div>
              <div ref={scrollRef} className="flex items-center space-x-4 h-full" style={{ transform: 'translateX(0px)', transition: 'none' }}>
                {unboxingReel.map((player, index) => (
                  <div key={`${player.id}-${index}`} className="flex-shrink-0 rounded-lg p-4 text-center" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',width:'100px'}}>
                    <div className="w-14 h-14 rounded-full overflow-hidden mx-auto mb-2" style={{border:'2px solid rgba(168,85,247,0.5)'}}>
                      {playerAvatars[player.playerSteamId64] ? (
                        <img src={playerAvatars[player.playerSteamId64]} alt={player.playerName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{background:'linear-gradient(135deg, #a855f7, #ec4899)'}}>
                          <User className="h-7 w-7 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-white font-medium truncate mb-1">{player.playerName}</p>
                    <p className="text-xs text-[#888] flex items-center justify-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTime(player.playTime)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center mt-6">
              <div className="flex items-center space-x-2 text-[#888]">
                <Gift className="h-5 w-5 animate-spin text-[#a855f7]" />
                <span>Rolling the reel...</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="rounded-xl overflow-hidden"
        style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}
      >
        <div className="flex items-center justify-between p-6" style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <h3 className="text-xl font-bold text-white flex items-center">
            <Eye className="h-5 w-5 mr-2 text-[#a855f7]" />
            Player Records ({filteredPlayers.length})
          </h3>
          <div className="flex space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#888]" />
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg text-white placeholder-[#666] focus:outline-none"
                style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}
              />
            </div>
            <button className="flex items-center space-x-2 text-[#888] px-3 py-2 rounded-lg text-sm transition-colors" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}>
              <Filter className="h-4 w-4" />
              <span>Filter</span>
            </button>
            <button className="flex items-center space-x-2 text-white px-3 py-2 rounded-lg text-sm transition-colors" style={{background:'linear-gradient(135deg, #a855f7, #ec4899)'}}>
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{background:'rgba(255,255,255,0.03)'}}>
              <tr>
                <th className="text-left py-4 px-6 text-[#888] font-medium">Player</th>
                <th className="text-left py-4 px-6 text-[#888] font-medium">Steam ID</th>
                <th className="text-left py-4 px-6 text-[#888] font-medium">Playtime</th>
                <th className="text-left py-4 px-6 text-[#888] font-medium">Server</th>
                <th className="text-left py-4 px-6 text-[#888] font-medium">Added</th>
                <th className="text-left py-4 px-6 text-[#888] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody style={{borderTop:'1px solid rgba(255,255,255,0.08)'}}>
              {filteredPlayers.map((player, index) => (
                <motion.tr
                  key={player.id}
                  className="transition-colors"
                  style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + (index * 0.02) }}
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{border:'2px solid rgba(168,85,247,0.3)'}}>
                        {playerAvatars[player.playerSteamId64] ? (
                          <img src={playerAvatars[player.playerSteamId64]} alt={player.playerName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{background:'linear-gradient(135deg, #a855f7, #ec4899)'}}>
                            <User className="h-5 w-5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium truncate">{player.playerName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-[#888] font-mono text-sm">{player.playerSteamId64}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-[#a855f7]" />
                      <span className="text-white font-medium">{formatTime(player.playTime)}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-[#888] truncate max-w-40" title={player.server}>{player.server}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-[#888] text-sm">
                      <div>{new Date(player.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-[#666]">{new Date(player.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex space-x-2">
                      <button className="text-[#a855f7] hover:text-[#c084fc] transition-colors p-1 rounded">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="text-[#ef4444] hover:text-[#f87171] transition-colors p-1 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filteredPlayers.length === 0 && (
            <div className="text-center py-12 text-[#888]">
              <Gift className="h-12 w-12 mx-auto mb-4 opacity-50 text-[#a855f7]" />
              <p>{searchTerm ? "No players found matching your search" : "No giveaway players found"}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
