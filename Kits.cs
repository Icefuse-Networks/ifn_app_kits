using Facepunch;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Oxide.Core;
using Oxide.Core.Libraries;
using Oxide.Core.Plugins;
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Runtime.CompilerServices;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("Kits", "Icefuse", "5.0.0"), Description("Lightweight kit system with full API for external UI plugins")]
    class Kits : RustPlugin
    {
        #region Configuration (Hardcoded)
        private const string CHAT_COMMAND = "kit";
        private const string ADMIN_PERMISSION = "kits.admin";
        private const bool WIPE_DATA_ON_WIPE = true;
        private const bool ALLOW_AUTO_TOGGLE = true;
        private const bool SHOW_PERMISSION_KITS = false;

        // API Configuration
        private const string API_URL = "https://kits.icefuse.com/api/servers/kits";
        private const string CONFIG_ID = "category_9dd76b86-2f21-4efe-a18b-7f2757045e7c"; // Category ID from Kit Manager (prefixed CUID)

        // FULL API TOKEN ifn_kit_bded2aacb1e3ab09ec07db11aceb6e0f
        private const string API_KEY = "ifn_kit_ebe1ed5f9d9ae065c5f4de692cac514e";
        private const float API_TIMEOUT = 30f; // Request timeout in seconds

        // perf: static readonly to avoid repeated allocations
        private static readonly string[] AUTO_KITS = { };
        private static readonly Dictionary<string, int> WIPE_COOLDOWNS = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        #endregion

        #region Messages (Hardcoded)
        private const string MSG_NO_KIT_NAME = "No kit name was specified";
        private const string MSG_INVALID_KIT = "No kit exists with that name";
        private const string MSG_CANT_CLAIM = "Another plugin is preventing you from receiving a kit";
        private const string MSG_NO_AUTH = "You do not have the required auth level for this kit";
        private const string MSG_NO_PERMISSION = "You do not have permission to use this kit";
        private const string MSG_ON_COOLDOWN = "This kit is on cooldown for {0}";
        private const string MSG_WIPE_COOLDOWN = "This kit has a post-wipe cooldown of {0}";
        private const string MSG_NO_SPACE = "You do not have enough inventory space";
        private const string MSG_KIT_RECEIVED = "You received the kit: <color=#ce422b>{0}</color>";
        private const string MSG_AUTO_DISABLED = "Auto-kits are disabled. Use /kit autokit to enable";
        private const string MSG_AUTO_TOGGLE = "Auto-kits have been <color=#ce422b>{0}</color>";
        private const string MSG_KIT_LIST = "<color=#ce422b>Available kits:</color> {0}";
        private const string MSG_HELP_TITLE = "<size=18><color=#ce422b>Kits</color></size> v5.0";
        private const string MSG_HELP_1 = "<color=#ce422b>/kit list</color> - List available kits";
        private const string MSG_HELP_2 = "<color=#ce422b>/kit <name></color> - Claim a kit";
        private const string MSG_HELP_3 = "<color=#ce422b>/kit autokit</color> - Toggle auto-kits on/off";
        private const string MSG_KITS_LOADING = "Kits are still loading, please try again in a moment";
        private const string MSG_DATA_LOADING = "Player data is still loading, please try again in a moment";
        private const string MSG_RATE_LIMITED = "Please wait before using another command";
        private const string MSG_MUST_BE_ALIVE = "You must be alive to claim a kit";
        #endregion

        #region Fields
        private KitData _kitData;
        private PlayerData _playerData;
        private bool _kitsLoaded;
        private bool _playerDataLoaded;
        private Coroutine _loadCoroutine;
        private Timer _cleanupTimer;

        // perf: track online players to avoid cleaning their data
        private HashSet<ulong> _onlinePlayers;

        // perf: cache wipe time once
        private static double _lastWipeTime;
        private static readonly DateTime Epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        // perf: cache API headers
        private static readonly Dictionary<string, string> ApiHeaders = new Dictionary<string, string>
        {
            ["Authorization"] = "Bearer " + API_KEY,
            ["Content-Type"] = "application/json"
        };

        // Player data config
        private const int PLAYER_DATA_LOAD_BATCH_SIZE = 100; // Load X players per frame
        private const int STALE_PLAYER_DAYS = 10; // Remove players inactive for X days on load
        private const int EXPECTED_PLAYER_COUNT = 1000; // Pre-size dictionary capacity
        private const float CLEANUP_INTERVAL = 3600f; // Run cleanup every hour (3600 seconds)
        private const int RUNTIME_STALE_HOURS = 24; // Remove offline players inactive for X hours during runtime

        // API retry config
        private const int API_MAX_RETRIES = 5; // Max retry attempts before giving up
        private const float API_RETRY_BASE_DELAY = 5f; // Base delay in seconds (doubles each retry)
        private int _apiRetryCount;
        private Timer _apiRetryTimer;

        // Rate limiting config
        private const float COMMAND_COOLDOWN = 1f; // Minimum seconds between commands per player
        private Dictionary<ulong, float> _commandCooldowns; // Track last command time per player
        #endregion

        #region Oxide Hooks
        private void Loaded()
        {
            _kitData = new KitData(); // Start with empty kits until API responds
            _playerData = new PlayerData(EXPECTED_PLAYER_COUNT); // Pre-sized, empty until loaded
            _onlinePlayers = new HashSet<ulong>(); // Track online players for cleanup
            _commandCooldowns = new Dictionary<ulong, float>(); // Rate limiting
            _apiRetryCount = 0; // Reset retry counter on load
            permission.RegisterPermission(ADMIN_PERMISSION, this);
            cmd.AddChatCommand(CHAT_COMMAND, this, CmdKit);
            cmd.AddConsoleCommand(CHAT_COMMAND, this, nameof(ConsoleCmdKit));

            Puts("Plugin loaded. Waiting for server initialization...");
        }

        private void OnServerInitialized()
        {
            _lastWipeTime = SaveRestore.SaveCreatedTime.Subtract(Epoch).TotalSeconds;

            // Populate online players set with current players
            foreach (BasePlayer player in BasePlayer.activePlayerList)
            {
                if (player != null && !player.IsDestroyed)
                    _onlinePlayers.Add(player.userID);
            }

            Puts($"Server initialized. {_onlinePlayers.Count} players online. Loading player data...");

            // Start async player data load
            _loadCoroutine = ServerMgr.Instance.StartCoroutine(LoadPlayerDataAsync());

            // Fetch kits from API (deferred so plugin finishes loading first)
            Puts("Scheduling API kit fetch (deferred to next tick)...");
            NextTick(FetchKitsFromApi);

            // Start periodic cleanup timer for memory management
            _cleanupTimer = timer.Every(CLEANUP_INTERVAL, RunMemoryCleanup);

            if (AUTO_KITS.Length == 0)
                Unsubscribe(nameof(OnPlayerRespawned));
        }

        private void OnNewSave(string filename)
        {
            if (WIPE_DATA_ON_WIPE)
            {
                _playerData?.Wipe();
                SavePlayerData();
            }
        }

        private void OnPlayerRespawned(BasePlayer player)
        {
            if (player == null || player.IsDestroyed) return; // validity: player destroyed
            if (!_kitsLoaded || !_playerDataLoaded) return; // guard: data not loaded yet

            if (Interface.Oxide.CallHook("CanRedeemKit", player) != null) return;
            if (Interface.Oxide.CallHook("CanRedeemAutoKit", player) != null) return;

            if (ALLOW_AUTO_TOGGLE && !_playerData[player.userID].ClaimAutoKits)
            {
                player.ChatMessage(MSG_AUTO_DISABLED);
                return;
            }

            // perf: manual loop, no LINQ
            for (int i = 0; i < AUTO_KITS.Length; i++)
            {
                if (!_kitData.TryFind(AUTO_KITS[i], out KitData.Kit kit)) continue;

                string error = CanClaimKit(player, kit, true);
                if (error != null) continue;

                player.inventory.Strip();
                kit.GiveItemsTo(player);
                OnKitReceived(player, kit);
                return;
            }
        }

        private void OnServerSave()
        {
            if (_playerData != null && _playerData.IsDirty && _playerDataLoaded)
                SavePlayerData();
        }

        private void OnPlayerConnected(BasePlayer player)
        {
            if (player == null) return;
            _onlinePlayers?.Add(player.userID); // Track player as online
        }

        private void OnPlayerDisconnected(BasePlayer player, string reason)
        {
            if (player == null) return;
            _onlinePlayers?.Remove(player.userID); // Remove from online tracking
            _commandCooldowns?.Remove(player.userID); // cleanup: remove rate limit tracking

            // Update last activity timestamp for cleanup tracking
            if (_playerDataLoaded && _playerData != null && _playerData.Exists(player.userID))
            {
                _playerData[player.userID].LastActivity = CurrentTime;
                _playerData.OnPlayerModified(player.userID);
            }
        }

        private void RunMemoryCleanup()
        {
            if (!_playerDataLoaded || _playerData == null) return;

            double staleThreshold = CurrentTime - (RUNTIME_STALE_HOURS * 3600); // Convert hours to seconds
            int removed = _playerData.RemoveStaleOfflinePlayers(_onlinePlayers, staleThreshold);

            if (removed > 0)
            {
                Puts($"Memory cleanup: removed {removed} stale offline player entries");
                _playerData.MarkDirty(); // Ensure changes are saved
            }
        }

        private void Unload()
        {
            Puts("Unloading plugin. Cleaning up resources...");

            // cleanup: stop retry timer
            if (_apiRetryTimer != null)
            {
                _apiRetryTimer.Destroy();
                _apiRetryTimer = null;
            }

            // cleanup: stop cleanup timer
            if (_cleanupTimer != null)
            {
                _cleanupTimer.Destroy();
                _cleanupTimer = null;
            }

            // cleanup: stop any running coroutine
            if (_loadCoroutine != null)
            {
                ServerMgr.Instance.StopCoroutine(_loadCoroutine);
                _loadCoroutine = null;
            }

            // cleanup: save dirty player data before unload
            if (!Interface.Oxide.IsShuttingDown && _playerData != null && _playerData.IsDirty)
                SavePlayerData();

            // cleanup: clear online players tracking
            if (_onlinePlayers != null)
            {
                _onlinePlayers.Clear();
                _onlinePlayers = null;
            }

            // cleanup: clear command cooldowns
            if (_commandCooldowns != null)
            {
                _commandCooldowns.Clear();
                _commandCooldowns = null;
            }

            // cleanup: clear kit data
            if (_kitData != null)
            {
                _kitData.Clear();
                _kitData = null;
            }

            // cleanup: clear player data
            if (_playerData != null)
            {
                _playerData.Clear();
                _playerData = null;
            }

            // cleanup: reset state flags
            _kitsLoaded = false;
            _playerDataLoaded = false;
        }
        #endregion

        #region API Fetching
        private void FetchKitsFromApi()
        {
            if (string.IsNullOrEmpty(CONFIG_ID))
            {
                PrintError("CONFIG_ID is not set. Copy the category ID from the Kit Manager UI.");
                _kitsLoaded = false;
                return;
            }

            // Use id= parameter for prefixed CUID lookups (preferred over legacy config= name lookups)
            string url = API_URL + "?id=" + Uri.EscapeDataString(CONFIG_ID);

            Puts($"[API] Fetching kits from: {url}");

            webrequest.Enqueue(url, null, (code, response) =>
            {
                if (!IsLoaded) return; // validity: plugin may have unloaded

                if (code != 200 || string.IsNullOrEmpty(response))
                {
                    PrintError($"[API] Kit fetch failed. HTTP {code}, Response length: {response?.Length ?? 0}");

                    if (!string.IsNullOrEmpty(response))
                    {
                        // Log truncated response body for debugging (max 200 chars)
                        string preview = response.Length > 200 ? response.Substring(0, 200) + "..." : response;
                        PrintError($"[API] Response body: {preview}");
                    }

                    ScheduleRetry();
                    return;
                }

                Puts($"[API] Received response ({response.Length} bytes). Parsing kit data...");

                // Validate response is JSON before parsing
                char firstChar = response.TrimStart()[0];
                if (firstChar != '[' && firstChar != '{')
                {
                    string preview = response.Length > 300 ? response.Substring(0, 300) + "..." : response;
                    PrintError($"[API] Response is not JSON (starts with '{firstChar}'). Likely a Cloudflare challenge or HTML error page.");
                    PrintError($"[API] Response preview: {preview}");
                    ScheduleRetry();
                    return;
                }

                try
                {
                    List<KitData.Kit> kits = JsonConvert.DeserializeObject<List<KitData.Kit>>(response);
                    if (kits == null)
                    {
                        PrintError("[API] Deserialized kit list is null");
                        ScheduleRetry();
                        return;
                    }

                    _kitData = new KitData();
                    int count = 0;
                    int skipped = 0;

                    for (int i = 0; i < kits.Count; i++)
                    {
                        KitData.Kit kit = kits[i];
                        if (string.IsNullOrEmpty(kit.Name))
                        {
                            skipped++;
                            continue;
                        }

                        _kitData[kit.Name] = kit;
                        count++;

                        int itemCount = (kit.MainItems?.Length ?? 0) + (kit.WearItems?.Length ?? 0) + (kit.BeltItems?.Length ?? 0);
                        Puts($"[API]   Loaded kit: {kit.Name} ({itemCount} items)");

                        // Register permission if needed
                        if (!string.IsNullOrEmpty(kit.RequiredPermission) && !permission.PermissionExists(kit.RequiredPermission, this))
                        {
                            permission.RegisterPermission(kit.RequiredPermission, this);
                            Puts($"[API]   Registered permission: {kit.RequiredPermission}");
                        }
                    }

                    _kitsLoaded = true;
                    _apiRetryCount = 0; // Reset retry counter on success

                    if (skipped > 0)
                        PrintWarning($"[API] Skipped {skipped} kits with empty names");

                    Puts($"[API] Successfully loaded {count} kits from category '{CONFIG_ID}'");
                }
                catch (Exception ex)
                {
                    string preview = response.Length > 300 ? response.Substring(0, 300) + "..." : response;
                    PrintError($"[API] Failed to parse kit data: {ex.Message}");
                    PrintError($"[API] Response preview: {preview}");
                    ScheduleRetry();
                }
            }, this, RequestMethod.GET, ApiHeaders, API_TIMEOUT);
        }

        private void ScheduleRetry()
        {
            _kitsLoaded = false;

            if (_apiRetryCount >= API_MAX_RETRIES)
            {
                PrintError($"[API] All {API_MAX_RETRIES} retry attempts exhausted. Kits will NOT be available.");
                PrintError("[API] To retry, reload the plugin: oxide.reload Kits");
                return;
            }

            _apiRetryCount++;
            float delay = API_RETRY_BASE_DELAY * (1 << (_apiRetryCount - 1)); // Exponential backoff: 5s, 10s, 20s, 40s, 80s
            PrintWarning($"[API] Scheduling retry {_apiRetryCount}/{API_MAX_RETRIES} in {delay}s...");

            _apiRetryTimer?.Destroy();
            _apiRetryTimer = timer.Once(delay, () =>
            {
                if (IsLoaded) FetchKitsFromApi();
            });
        }
        #endregion

        #region Kit Claiming
        private bool TryClaimKit(BasePlayer player, string name)
        {
            if (player == null || player.IsDestroyed) return false; // validity: player destroyed

            if (player.IsDead())
            {
                player.ChatMessage(MSG_MUST_BE_ALIVE);
                return false;
            }

            if (!_kitsLoaded)
            {
                player.ChatMessage(MSG_KITS_LOADING);
                return false;
            }

            if (!_playerDataLoaded)
            {
                player.ChatMessage(MSG_DATA_LOADING);
                return false;
            }

            if (string.IsNullOrEmpty(name))
            {
                player.ChatMessage(MSG_NO_KIT_NAME);
                return false;
            }

            if (!_kitData.TryFind(name, out KitData.Kit kit))
            {
                player.ChatMessage(MSG_INVALID_KIT);
                return false;
            }

            string error = CanClaimKit(player, kit);
            if (error != null)
            {
                player.ChatMessage(error);
                return false;
            }

            kit.GiveItemsTo(player);
            OnKitReceived(player, kit);
            player.ChatMessage(string.Format(MSG_KIT_RECEIVED, kit.Name));
            return true;
        }

        private string CanClaimKit(BasePlayer player, KitData.Kit kit, bool isAutoKit = false)
        {
            // Check external hooks
            object hookResult = Interface.Oxide.CallHook("CanRedeemKit", player);
            if (hookResult != null)
                return hookResult is string s ? s : MSG_CANT_CLAIM;

            // Auth level check
            if (!isAutoKit && kit.RequiredAuth > 0 && player.net?.connection != null && player.net.connection.authLevel < kit.RequiredAuth)
                return MSG_NO_AUTH;

            // Permission check
            if (!string.IsNullOrEmpty(kit.RequiredPermission) && !permission.UserHasPermission(player.UserIDString, kit.RequiredPermission))
                return MSG_NO_PERMISSION;

            // Wipe cooldown check
            if (WIPE_COOLDOWNS.TryGetValue(kit.Name, out int wipeCooldownSeconds))
            {
                if (IsOnWipeCooldown(wipeCooldownSeconds, out int remaining))
                    return string.Format(MSG_WIPE_COOLDOWN, FormatTime(remaining));
            }

            // Player cooldown check
            if (_playerData.TryFind(player.userID, out PlayerData.PlayerUsageData usageData))
            {
                if (kit.Cooldown > 0)
                {
                    double cooldownRemaining = usageData.GetCooldownRemaining(kit.Name);
                    if (cooldownRemaining > 0)
                        return string.Format(MSG_ON_COOLDOWN, FormatTime(cooldownRemaining));
                }
            }

            // Inventory space check
            if (!kit.HasSpaceForItems(player))
                return MSG_NO_SPACE;

            return null;
        }

        private void OnKitReceived(BasePlayer player, KitData.Kit kit)
        {
            if (player == null || player.IsDestroyed) return; // validity: player destroyed

            _playerData[player.userID].OnKitClaimed(kit);
            _playerData.OnPlayerModified(player.userID); // perf: mark dirty for selective save
            Interface.CallHook("OnKitRedeemed", player, kit.Name);
        }
        #endregion

        #region API
        [HookMethod("GiveKit")]
        public object GiveKit(BasePlayer player, string name)
        {
            if (player == null || player.IsDestroyed) return null; // validity: player destroyed
            if (player.IsDead()) return MSG_MUST_BE_ALIVE; // validity: player dead
            if (!_kitsLoaded || _kitData == null) return MSG_KITS_LOADING; // guard: data not ready
            if (string.IsNullOrEmpty(name)) return MSG_NO_KIT_NAME;
            if (!_kitData.TryFind(name, out KitData.Kit kit)) return MSG_INVALID_KIT;

            // guard: rate limit API calls per player
            if (_commandCooldowns != null) // guard: field may be null during early load
            {
                float currentTime = UnityEngine.Time.realtimeSinceStartup;
                if (_commandCooldowns.TryGetValue(player.userID, out float lastTime))
                {
                    if (currentTime - lastTime < COMMAND_COOLDOWN)
                        return MSG_RATE_LIMITED;
                }
                _commandCooldowns[player.userID] = currentTime;
            }

            kit.GiveItemsTo(player);
            return true;
        }

        [HookMethod("IsKit")]
        public bool IsKit(string name) => !string.IsNullOrEmpty(name) && _kitData != null && _kitData.Exists(name);

        [HookMethod("GetKitNames")]
        public void GetKitNames(List<string> list)
        {
            if (_kitData != null) list.AddRange(_kitData.Keys); // guard: data may be null
        }

        [HookMethod("GetAllKits")]
        public string[] GetAllKits()
        {
            if (_kitData == null) return Array.Empty<string>(); // guard: data not ready
            List<string> names = Pool.Get<List<string>>();
            names.AddRange(_kitData.Keys);
            string[] result = names.ToArray();
            Pool.FreeUnmanaged(ref names);
            return result;
        }

        [HookMethod("GetKitDescription")]
        public string GetKitDescription(string name) => _kitData?[name]?.Description ?? string.Empty;

        [HookMethod("GetKitCooldown")]
        public int GetKitCooldown(string name) => _kitData?[name]?.Cooldown ?? 0;

        [HookMethod("GetPlayerKitUses")]
        public int GetPlayerKitUses(ulong playerId, string name) =>
            _playerData != null && _playerData.Exists(playerId) ? _playerData[playerId].GetKitUses(name) : 0;

        [HookMethod("SetPlayerKitUses")]
        public void SetPlayerKitUses(ulong playerId, string name, int amount)
        {
            if (_playerData != null && _playerData.Exists(playerId)) // guard: data may be null
            {
                _playerData[playerId].SetKitUses(name, amount);
                _playerData.OnPlayerModified(playerId); // perf: mark dirty for save
            }
        }

        [HookMethod("GetPlayerKitCooldown")]
        public double GetPlayerKitCooldown(ulong playerId, string name) =>
            _playerData != null && _playerData.Exists(playerId) ? _playerData[playerId].GetCooldownRemaining(name) : 0;

        [HookMethod("SetPlayerKitCooldown")]
        public void SetPlayerCooldown(ulong playerId, string name, double seconds)
        {
            if (_playerData != null && _playerData.Exists(playerId)) // guard: data may be null
            {
                _playerData[playerId].SetCooldownRemaining(name, seconds);
                _playerData.OnPlayerModified(playerId); // perf: mark dirty for save
            }
        }

        [HookMethod("GetKitObject")]
        public JObject GetKitObject(string name)
        {
            if (_kitData == null || !_kitData.TryFind(name, out KitData.Kit kit)) return null; // guard: data may be null
            return kit.ToJObject;
        }

        [HookMethod("CreateKitItems")]
        public IEnumerable<Item> CreateKitItems(string name)
        {
            if (_kitData == null || !_kitData.TryFind(name, out KitData.Kit kit)) // guard: data may be null
                yield break;

            foreach (Item item in kit.CreateItems())
                yield return item;
        }

        [HookMethod("GetKitContents")]
        public string[] GetKitContents(string name)
        {
            if (_kitData == null || !_kitData.TryFind(name, out KitData.Kit kit)) return null; // guard: data may be null

            List<string> items = Pool.Get<List<string>>();

            AppendItemStrings(items, kit.MainItems);
            AppendItemStrings(items, kit.WearItems);
            AppendItemStrings(items, kit.BeltItems);

            string[] result = items.ToArray();
            Pool.FreeUnmanaged(ref items);
            return result;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private static void AppendItemStrings(List<string> items, ItemData[] itemData)
        {
            // perf: pre-allocate list for string parts, use string.Join to avoid += allocations
            List<string> parts = Pool.Get<List<string>>();

            for (int i = 0; i < itemData.Length; i++)
            {
                ItemData item = itemData[i];
                parts.Clear();
                parts.Add(item.ItemID.ToString());
                parts.Add(item.Amount.ToString());

                if (item.Contents is { Length: > 0 })
                {
                    for (int j = 0; j < item.Contents.Length; j++)
                        parts.Add(item.Contents[j].ItemID.ToString());
                }

                if (item.Container?.contents?.Count > 0)
                {
                    for (int j = 0; j < item.Container.contents.Count; j++)
                        parts.Add(item.Container.contents[j].ItemID.ToString());
                }

                items.Add(string.Join("_", parts));
            }

            Pool.FreeUnmanaged(ref parts);
        }
        #endregion

        #region Chat Commands
        private void CmdKit(BasePlayer player, string command, string[] args)
        {
            if (player == null || player.IsDestroyed) return; // validity: player destroyed
            if (_commandCooldowns == null) return; // guard: plugin not fully initialized

            // Rate limiting check
            float currentTime = UnityEngine.Time.realtimeSinceStartup;
            if (_commandCooldowns.TryGetValue(player.userID, out float lastCommandTime))
            {
                if (currentTime - lastCommandTime < COMMAND_COOLDOWN)
                {
                    player.ChatMessage(MSG_RATE_LIMITED);
                    return;
                }
            }
            _commandCooldowns[player.userID] = currentTime;

            if (args.Length == 0)
            {
                ShowHelp(player);
                return;
            }

            string cmd = args[0];
            if (cmd.Equals("help", StringComparison.OrdinalIgnoreCase))
            {
                ShowHelp(player);
                return;
            }

            if (cmd.Equals("list", StringComparison.OrdinalIgnoreCase))
            {
                ShowKitList(player);
                return;
            }

            if (cmd.Equals("autokit", StringComparison.OrdinalIgnoreCase))
            {
                if (ALLOW_AUTO_TOGGLE)
                {
                    if (!_playerDataLoaded)
                    {
                        player.ChatMessage(MSG_DATA_LOADING);
                        return;
                    }
                    bool newValue = !_playerData[player.userID].ClaimAutoKits;
                    _playerData[player.userID].ClaimAutoKits = newValue;
                    _playerData.OnPlayerModified(player.userID); // perf: mark dirty
                    player.ChatMessage(string.Format(MSG_AUTO_TOGGLE, newValue ? "enabled" : "disabled"));
                }
                return;
            }

            // Default: treat as kit name
            if (_kitData == null || !_kitData.Exists(cmd)) // guard: data may be null
            {
                player.ChatMessage(MSG_INVALID_KIT);
                return;
            }
            TryClaimKit(player, cmd);
        }

        private void ConsoleCmdKit(ConsoleSystem.Arg arg)
        {
            BasePlayer player = arg.Connection?.player as BasePlayer;
            if (player == null) return;

            if (arg.Args == null || arg.Args.Length == 0)
            {
                ShowHelp(player);
                return;
            }

            CmdKit(player, CHAT_COMMAND, arg.Args);
        }

        private void ShowHelp(BasePlayer player)
        {
            if (player == null || player.IsDestroyed) return; // validity: player destroyed

            player.ChatMessage(MSG_HELP_TITLE);
            player.ChatMessage(MSG_HELP_1);
            player.ChatMessage(MSG_HELP_2);
            if (ALLOW_AUTO_TOGGLE)
                player.ChatMessage(MSG_HELP_3);
        }

        private void ShowKitList(BasePlayer player)
        {
            if (player == null || player.IsDestroyed) return; // validity: player destroyed

            if (!_kitsLoaded)
            {
                player.ChatMessage(MSG_KITS_LOADING);
                return;
            }

            List<string> validKits = Pool.Get<List<string>>();
            GetUserValidKits(player, validKits);

            if (validKits.Count == 0)
            {
                player.ChatMessage("No kits available");
                Pool.FreeUnmanaged(ref validKits);
                return;
            }

            player.ChatMessage(string.Format(MSG_KIT_LIST, string.Join(", ", validKits)));
            Pool.FreeUnmanaged(ref validKits);
        }
        #endregion

        #region Helpers
        private static double CurrentTime => DateTime.UtcNow.Subtract(Epoch).TotalSeconds;

        private static string FormatTime(double time)
        {
            TimeSpan ts = TimeSpan.FromSeconds(time);
            if (ts.Days > 0) return $"~{ts.Days:00}d:{ts.Hours:00}h";
            if (ts.Hours > 0) return $"~{ts.Hours:00}h:{ts.Minutes:00}m";
            if (ts.Minutes > 0) return $"{ts.Minutes:00}m:{ts.Seconds:00}s";
            return $"{ts.Seconds}s";
        }

        private static bool IsOnWipeCooldown(int seconds, out int remaining)
        {
            double nextUseTime = _lastWipeTime + seconds;
            double currentTime = CurrentTime;

            if (currentTime < nextUseTime)
            {
                remaining = (int)(nextUseTime - currentTime);
                return true;
            }

            remaining = 0;
            return false;
        }

        private void GetUserValidKits(BasePlayer player, List<string> list)
        {
            if (player == null || player.IsDestroyed) return; // validity: player destroyed
            if (_kitData == null) return; // guard: data not ready

            bool isAdmin = permission.UserHasPermission(player.UserIDString, ADMIN_PERMISSION);
            int authLevel = (int)(player.net?.connection?.authLevel ?? 0);

            // perf: manual iteration, no LINQ
            foreach (KitData.Kit kit in _kitData.Values)
            {
                if (kit.IsHidden && !isAdmin) continue;

                if (!SHOW_PERMISSION_KITS && !string.IsNullOrEmpty(kit.RequiredPermission))
                {
                    if (!permission.UserHasPermission(player.UserIDString, kit.RequiredPermission) && !isAdmin)
                        continue;
                }

                if (authLevel < kit.RequiredAuth) continue;

                list.Add(kit.Name);
            }
        }

        #endregion

        #region Data Management
        private static readonly string PlayerDataPath = Path.Combine(Interface.Oxide.DataDirectory, "Kits", "player_data.json");

        private IEnumerator LoadPlayerDataAsync()
        {
            PrintWarning("Loading player data asynchronously...");
            _playerDataLoaded = false;

            // Check if file exists
            if (!File.Exists(PlayerDataPath))
            {
                Puts("No player data file found, starting fresh");
                _playerData = new PlayerData(EXPECTED_PLAYER_COUNT);
                _playerDataLoaded = true;
                yield break;
            }

            string json = null;
            Dictionary<ulong, PlayerData.PlayerUsageData> rawData = null;

            // Read file in background-safe manner
            try
            {
                json = File.ReadAllText(PlayerDataPath);
            }
            catch (Exception ex)
            {
                PrintError($"Failed to read player data file: {ex.Message}");
                _playerData = new PlayerData(EXPECTED_PLAYER_COUNT);
                _playerDataLoaded = true;
                yield break;
            }

            if (string.IsNullOrEmpty(json))
            {
                PrintWarning("Player data file is empty, starting fresh");
                _playerData = new PlayerData(EXPECTED_PLAYER_COUNT);
                _playerDataLoaded = true;
                yield break;
            }

            yield return null; // yield after file read

            // Parse JSON with corruption protection and legacy format support
            try
            {
                // Detect format: legacy wraps data in { "_players": { ... } }
                JObject root = JObject.Parse(json);
                JToken playersToken = root["_players"];

                if (playersToken != null)
                {
                    Puts("Detected legacy player data format (_players wrapper). Migrating...");
                    rawData = playersToken.ToObject<Dictionary<ulong, PlayerData.PlayerUsageData>>();
                }
                else
                {
                    rawData = root.ToObject<Dictionary<ulong, PlayerData.PlayerUsageData>>();
                }
            }
            catch (JsonException ex)
            {
                PrintError($"Player data file is corrupted: {ex.Message}. Backing up and starting fresh.");
                BackupCorruptedFile();
                _playerData = new PlayerData(EXPECTED_PLAYER_COUNT);
                _playerDataLoaded = true;
                yield break;
            }
            catch (Exception ex)
            {
                PrintError($"Failed to parse player data: {ex.Message}");
                _playerData = new PlayerData(EXPECTED_PLAYER_COUNT);
                _playerDataLoaded = true;
                yield break;
            }

            if (rawData == null)
            {
                PrintWarning("Player data deserialized to null, starting fresh");
                _playerData = new PlayerData(EXPECTED_PLAYER_COUNT);
                _playerDataLoaded = true;
                yield break;
            }

            yield return null; // yield after parse

            // Load in batches to prevent lag spikes
            _playerData = new PlayerData(Math.Max(rawData.Count, EXPECTED_PLAYER_COUNT));
            double staleThreshold = CurrentTime - (STALE_PLAYER_DAYS * 86400); // 86400 = seconds per day
            int loaded = 0;
            int skipped = 0;
            int batch = 0;

            foreach (KeyValuePair<ulong, PlayerData.PlayerUsageData> kvp in rawData)
            {
                if (!IsLoaded) yield break; // validity: plugin unloaded during load

                // Skip null entries
                if (kvp.Value == null)
                {
                    skipped++;
                    continue;
                }

                // Skip stale players (no activity in X days)
                if (kvp.Value.LastActivity > 0 && kvp.Value.LastActivity < staleThreshold)
                {
                    skipped++;
                    continue;
                }

                _playerData.LoadPlayer(kvp.Key, kvp.Value);
                loaded++;
                batch++;

                // Yield every BATCH_SIZE entries to prevent lag
                if (batch >= PLAYER_DATA_LOAD_BATCH_SIZE)
                {
                    batch = 0;
                    yield return null;
                }
            }

            _playerDataLoaded = true;
            _loadCoroutine = null;
            Puts($"Loaded {loaded} players, skipped {skipped} stale/invalid entries");

            // Mark dirty if we pruned stale data so it saves the cleaned version
            if (skipped > 0)
                _playerData.MarkDirty();
        }

        private void BackupCorruptedFile()
        {
            try
            {
                string backupPath = PlayerDataPath + $".corrupted.{DateTime.UtcNow:yyyyMMddHHmmss}";
                File.Move(PlayerDataPath, backupPath);
                PrintWarning($"Corrupted file backed up to: {backupPath}");
            }
            catch (Exception ex)
            {
                PrintError($"Failed to backup corrupted file: {ex.Message}");
            }
        }

        private void SavePlayerData()
        {
            if (_playerData == null) return;

            try
            {
                // Update last activity for all modified players
                _playerData.UpdateLastActivity();

                string directory = Path.GetDirectoryName(PlayerDataPath);
                if (!Directory.Exists(directory))
                    Directory.CreateDirectory(directory);

                string json = JsonConvert.SerializeObject(_playerData.GetDataForSave(), Formatting.Indented);
                File.WriteAllText(PlayerDataPath, json);
                _playerData.ClearDirty();
            }
            catch (Exception ex)
            {
                PrintError($"Failed to save player data: {ex.Message}");
            }
        }

        private class KitData
        {
            [JsonProperty]
            private Dictionary<string, Kit> _kits = new Dictionary<string, Kit>(StringComparer.OrdinalIgnoreCase);

            internal Kit this[string key]
            {
                get => _kits.TryGetValue(key, out Kit kit) ? kit : null;
                set
                {
                    if (value == null) _kits.Remove(key);
                    else _kits[key] = value;
                }
            }

            internal bool TryFind(string name, out Kit kit) => _kits.TryGetValue(name, out kit);
            internal bool Exists(string name) => _kits.ContainsKey(name);
            internal ICollection<string> Keys => _kits.Keys;
            internal ICollection<Kit> Values => _kits.Values;
            internal bool IsValid => _kits != null;

            internal void RegisterPermissions(Oxide.Core.Libraries.Permission permission, Oxide.Core.Plugins.Plugin plugin)
            {
                foreach (Kit kit in _kits.Values)
                {
                    if (!string.IsNullOrEmpty(kit.RequiredPermission) && !permission.PermissionExists(kit.RequiredPermission, plugin))
                        permission.RegisterPermission(kit.RequiredPermission, plugin);
                }
            }

            // cleanup: clear all kit data and cached JObjects
            internal void Clear()
            {
                foreach (Kit kit in _kits.Values)
                    kit.ClearCache();
                _kits.Clear();
            }

            public class Kit
            {
                public string Name { get; set; } = string.Empty;
                public string Description { get; set; } = string.Empty;
                public string RequiredPermission { get; set; } = string.Empty;
                public int RequiredAuth { get; set; }
                public int Cooldown { get; set; }
                public bool IsHidden { get; set; }
                public string Category { get; set; }
                public string Subcategory { get; set; }

                public ItemData[] MainItems { get; set; } = Array.Empty<ItemData>();
                public ItemData[] WearItems { get; set; } = Array.Empty<ItemData>();
                public ItemData[] BeltItems { get; set; } = Array.Empty<ItemData>();

                [JsonIgnore]
                internal int ItemCount => MainItems.Length + WearItems.Length + BeltItems.Length;

                [JsonIgnore]
                private JObject _jObject;

                // cleanup: clear cached JObject
                internal void ClearCache() => _jObject = null;

                [JsonIgnore]
                internal JObject ToJObject
                {
                    get
                    {
                        if (_jObject == null)
                        {
                            _jObject = new JObject
                            {
                                ["Name"] = Name,
                                ["Description"] = Description,
                                ["RequiredPermission"] = RequiredPermission,
                                ["RequiredAuth"] = RequiredAuth,
                                ["Cooldown"] = Cooldown,
                                ["IsHidden"] = IsHidden,
                                ["Category"] = Category,
                                ["Subcategory"] = Subcategory,
                                ["MainItems"] = new JArray(),
                                ["WearItems"] = new JArray(),
                                ["BeltItems"] = new JArray()
                            };

                            for (int i = 0; i < MainItems.Length; i++)
                                ((JArray)_jObject["MainItems"]).Add(MainItems[i].ToJObject);
                            for (int i = 0; i < WearItems.Length; i++)
                                ((JArray)_jObject["WearItems"]).Add(WearItems[i].ToJObject);
                            for (int i = 0; i < BeltItems.Length; i++)
                                ((JArray)_jObject["BeltItems"]).Add(BeltItems[i].ToJObject);
                        }
                        return _jObject;
                    }
                }

                internal bool HasSpaceForItems(BasePlayer player)
                {
                    int wearFree = 8 - player.inventory.containerWear.itemList.Count;
                    int mainFree = 24 - player.inventory.containerMain.itemList.Count;
                    int beltFree = 6 - player.inventory.containerBelt.itemList.Count;

                    return (wearFree >= WearItems.Length && beltFree >= BeltItems.Length && mainFree >= MainItems.Length)
                           || ItemCount <= mainFree + beltFree;
                }

                internal void GiveItemsTo(BasePlayer player)
                {
                    if (player == null || player.IsDestroyed) return; // validity: player destroyed

                    List<ItemData> leftover = Pool.Get<List<ItemData>>();

                    GiveItems(player, MainItems, player.inventory.containerMain, leftover);
                    GiveItems(player, WearItems, player.inventory.containerWear, leftover, true);
                    GiveItems(player, BeltItems, player.inventory.containerBelt, leftover);

                    // Handle leftover items
                    for (int i = 0; i < leftover.Count; i++)
                    {
                        if (player == null || player.IsDestroyed) break; // validity: re-check in loop

                        Item item = CreateItem(leftover[i]);
                        if (!MoveToIdealContainer(player.inventory, item) &&
                            !item.MoveToContainer(player.inventory.containerMain) &&
                            !item.MoveToContainer(player.inventory.containerBelt))
                        {
                            item.Drop(player.GetDropPosition(), player.GetDropVelocity());
                        }
                    }

                    Pool.FreeUnmanaged(ref leftover);
                }

                private static void GiveItems(BasePlayer player, ItemData[] items, ItemContainer container, List<ItemData> leftover, bool isWear = false)
                {
                    for (int i = 0; i < items.Length; i++)
                    {
                        ItemData data = items[i];
                        if (data.Amount < 1) continue;

                        if (container.GetSlot(data.Position) != null)
                        {
                            leftover.Add(data);
                            continue;
                        }

                        Item item = CreateItem(data);
                        if (!isWear || (item.info.isWearable && CanWearItem(container, item)))
                        {
                            item.position = data.Position;
                            item.SetParent(container);
                        }
                        else
                        {
                            leftover.Add(data);
                            item.Remove();
                        }
                    }
                }

                internal IEnumerable<Item> CreateItems()
                {
                    for (int i = 0; i < MainItems.Length; i++)
                        if (MainItems[i].Amount > 0) yield return CreateItem(MainItems[i]);
                    for (int i = 0; i < WearItems.Length; i++)
                        if (WearItems[i].Amount > 0) yield return CreateItem(WearItems[i]);
                    for (int i = 0; i < BeltItems.Length; i++)
                        if (BeltItems[i].Amount > 0) yield return CreateItem(BeltItems[i]);
                }

                private static bool MoveToIdealContainer(PlayerInventory inv, Item item)
                {
                    if (item.info.isWearable && CanWearItem(inv.containerWear, item))
                        return item.MoveToContainer(inv.containerWear, -1, false);

                    if (item.info.stackable > 1)
                    {
                        if (inv.containerBelt?.FindItemByItemID(item.info.itemid) != null)
                            return item.MoveToContainer(inv.containerBelt);
                        if (inv.containerMain?.FindItemByItemID(item.info.itemid) != null)
                            return item.MoveToContainer(inv.containerMain);
                    }

                    if (item.info.HasFlag(ItemDefinition.Flag.NotStraightToBelt) || !item.info.isUsable)
                        return item.MoveToContainer(inv.containerMain);

                    return item.MoveToContainer(inv.containerBelt, -1, false);
                }

                private static bool CanWearItem(ItemContainer containerWear, Item item)
                {
                    ItemModWearable wearable = item.info.GetComponent<ItemModWearable>();
                    if (wearable == null) return false;

                    for (int i = 0; i < containerWear.itemList.Count; i++)
                    {
                        Item other = containerWear.itemList[i];
                        if (other == null) continue;

                        ItemModWearable otherWearable = other.info.GetComponent<ItemModWearable>();
                        if (otherWearable != null && !wearable.CanExistWith(otherWearable))
                            return false;
                    }
                    return true;
                }
            }
        }

        private class PlayerData
        {
            private Dictionary<ulong, PlayerUsageData> _players;
            private HashSet<ulong> _modifiedPlayers; // Track which players were modified
            private bool _isDirty;

            internal PlayerData(int capacity)
            {
                _players = new Dictionary<ulong, PlayerUsageData>(capacity);
                _modifiedPlayers = new HashSet<ulong>();
                _isDirty = false;
            }

            internal bool IsDirty => _isDirty;
            internal void MarkDirty() => _isDirty = true;
            internal void ClearDirty()
            {
                _isDirty = false;
                _modifiedPlayers.Clear();
            }

            internal bool TryFind(ulong playerId, out PlayerUsageData data) => _players.TryGetValue(playerId, out data);
            internal bool Exists(ulong playerId) => _players.ContainsKey(playerId);

            internal PlayerUsageData this[ulong key]
            {
                get
                {
                    if (_players.TryGetValue(key, out PlayerUsageData data))
                        return data;

                    // Create new player entry
                    data = new PlayerUsageData();
                    _players[key] = data;
                    _modifiedPlayers.Add(key);
                    _isDirty = true;
                    return data;
                }
            }

            internal void LoadPlayer(ulong playerId, PlayerUsageData data)
            {
                _players[playerId] = data;
            }

            internal void OnPlayerModified(ulong playerId)
            {
                _modifiedPlayers.Add(playerId);
                _isDirty = true;
            }

            internal void UpdateLastActivity()
            {
                double now = CurrentTime;
                foreach (ulong playerId in _modifiedPlayers)
                {
                    if (_players.TryGetValue(playerId, out PlayerUsageData data))
                        data.LastActivity = now;
                }
            }

            internal Dictionary<ulong, PlayerUsageData> GetDataForSave() => _players;

            internal void Wipe()
            {
                _players.Clear();
                _modifiedPlayers.Clear();
                _isDirty = true;
            }

            // cleanup: clear all player data for unload
            internal void Clear()
            {
                _players?.Clear();
                _modifiedPlayers?.Clear();
                _players = null;
                _modifiedPlayers = null;
            }

            // cleanup: remove offline players who haven't been active since threshold
            internal int RemoveStaleOfflinePlayers(HashSet<ulong> onlinePlayers, double staleThreshold)
            {
                if (_players == null || onlinePlayers == null) return 0;

                // Collect keys to remove (can't modify during iteration)
                List<ulong> toRemove = Pool.Get<List<ulong>>();

                foreach (KeyValuePair<ulong, PlayerUsageData> kvp in _players)
                {
                    // Skip online players
                    if (onlinePlayers.Contains(kvp.Key)) continue;

                    // Skip players with no activity data (new players)
                    if (kvp.Value.LastActivity <= 0) continue;

                    // Remove if inactive longer than threshold
                    if (kvp.Value.LastActivity < staleThreshold)
                        toRemove.Add(kvp.Key);
                }

                // Remove collected entries
                for (int i = 0; i < toRemove.Count; i++)
                {
                    _players.Remove(toRemove[i]);
                    _modifiedPlayers.Remove(toRemove[i]);
                }

                int removed = toRemove.Count;
                Pool.FreeUnmanaged(ref toRemove);
                return removed;
            }

            internal bool IsValid => _players != null;

            public class PlayerUsageData
            {
                [JsonProperty("_usageData")]
                private Dictionary<string, KitUsageData> _usageData = new Dictionary<string, KitUsageData>(StringComparer.OrdinalIgnoreCase);

                public bool ClaimAutoKits { get; set; } = true;
                public double LastActivity { get; set; } // Track when player last claimed a kit

                internal double GetCooldownRemaining(string name)
                {
                    if (!_usageData.TryGetValue(name, out KitUsageData data)) return 0;
                    double remaining = data.NextUseTime - CurrentTime;
                    return remaining > 0 ? remaining : 0;
                }

                internal void SetCooldownRemaining(string name, double seconds)
                {
                    if (_usageData.TryGetValue(name, out KitUsageData data))
                        data.NextUseTime = CurrentTime + seconds;
                }

                internal int GetKitUses(string name) => _usageData.TryGetValue(name, out KitUsageData data) ? data.TotalUses : 0;

                internal void SetKitUses(string name, int amount)
                {
                    if (_usageData.TryGetValue(name, out KitUsageData data))
                        data.TotalUses = amount;
                }

                internal void OnKitClaimed(KitData.Kit kit)
                {
                    if (kit.Cooldown <= 0) return;

                    if (!_usageData.TryGetValue(kit.Name, out KitUsageData data))
                        data = _usageData[kit.Name] = new KitUsageData();

                    data.TotalUses++;
                    data.NextUseTime = CurrentTime + kit.Cooldown;
                }

                public class KitUsageData
                {
                    public int TotalUses { get; set; }
                    public double NextUseTime { get; set; }
                }
            }
        }
        #endregion

        #region Item Serialization
        private static Item CreateItem(ItemData data)
        {
            Item item = ItemManager.CreateByItemID(data.ItemID, data.Amount, data.Skin);
            if (item == null) return null;

            if (!string.IsNullOrEmpty(data.DisplayName))
                item.name = data.DisplayName;

            if (!string.IsNullOrEmpty(data.Text))
                item.text = data.Text;

            item._condition = data.Condition;
            item._maxCondition = data.MaxCondition;

            // RF frequency
            if (data.Frequency > 0)
            {
                ItemModRFListener rfListener = item.info.GetComponentInChildren<ItemModRFListener>();
                if (rfListener != null)
                {
                    BaseNetworkable entity = BaseNetworkable.serverEntities.Find(item.instanceData?.subEntity ?? default);
                    (entity as PagerEntity)?.ChangeFrequency(data.Frequency);
                }
            }

            // Blueprint target
            if (data.BlueprintItemID != 0)
            {
                if (item.instanceData == null)
                    item.instanceData = new ProtoBuf.Item.InstanceData { ShouldPool = false };

                item.instanceData.blueprintAmount = 1;
                item.instanceData.blueprintTarget = data.BlueprintItemID;
                item.MarkDirty();
            }

            // Flamethrower ammo
            FlameThrower flamethrower = item.GetHeldEntity() as FlameThrower;
            if (flamethrower != null)
                flamethrower.ammo = data.Ammo;

            // Item contents (legacy)
            if (data.Contents != null)
            {
                for (int i = 0; i < data.Contents.Length; i++)
                {
                    Item content = CreateItem(data.Contents[i]);
                    if (content != null && !content.MoveToContainer(item.contents))
                        content.Remove();
                }
            }

            // Item container
            if (data.Container != null)
            {
                if (item.contents == null)
                {
                    ItemModContainerArmorSlot armorSlot = FindItemMod<ItemModContainerArmorSlot>(item);
                    if (armorSlot != null)
                        armorSlot.CreateAtCapacity(data.Container.slots, item);
                    else
                    {
                        item.contents = Pool.Get<ItemContainer>();
                        item.contents.ServerInitialize(item, data.Container.slots);
                        item.contents.GiveUID();
                    }
                }
                data.Container.Load(item.contents);
            }

            // Weapon ammo
            BaseProjectile weapon = item.GetHeldEntity() as BaseProjectile;
            if (weapon != null)
            {
                weapon.DelayedModsChanged();
                if (!string.IsNullOrEmpty(data.Ammotype))
                    weapon.primaryMagazine.ammoType = ItemManager.FindItemDefinition(data.Ammotype);
                weapon.primaryMagazine.contents = data.Ammo;
            }

            item.MarkDirty();
            return item;
        }

        private static T FindItemMod<T>(Item item) where T : ItemMod
        {
            // perf: index loop avoids enumerator allocation
            ItemMod[] mods = item.info.itemMods;
            for (int i = 0; i < mods.Length; i++)
            {
                if (mods[i] is T t) return t;
            }
            return null;
        }

        public class ItemData
        {
            public string Shortname { get; set; }
            public string DisplayName { get; set; }
            public ulong Skin { get; set; }
            public int Amount { get; set; }
            public float Condition { get; set; }
            public float MaxCondition { get; set; }
            public int Ammo { get; set; }
            public string Ammotype { get; set; }
            public int Position { get; set; }
            public int Frequency { get; set; }
            public string BlueprintShortname { get; set; }
            public string Text { get; set; }
            public ItemData[] Contents { get; set; }
            public ItemContainerData Container { get; set; }

            // perf: cached item IDs
            [JsonIgnore] private int _itemId;
            [JsonIgnore] private int _blueprintItemId;
            [JsonIgnore] private JObject _jObject;

            private const string BLUEPRINT_BASE = "blueprintbase";

            [JsonIgnore]
            internal int ItemID
            {
                get
                {
                    if (_itemId == 0 && !string.IsNullOrEmpty(Shortname))
                    {
                        if (ItemManager.itemDictionaryByName.TryGetValue(Shortname, out ItemDefinition def))
                            _itemId = def.itemid;
                    }
                    return _itemId;
                }
            }

            [JsonIgnore]
            internal bool IsBlueprint => Shortname == BLUEPRINT_BASE;

            [JsonIgnore]
            internal int BlueprintItemID
            {
                get
                {
                    if (_blueprintItemId == 0 && !string.IsNullOrEmpty(BlueprintShortname))
                    {
                        if (ItemManager.itemDictionaryByName.TryGetValue(BlueprintShortname, out ItemDefinition def))
                            _blueprintItemId = def.itemid;
                    }
                    return _blueprintItemId;
                }
            }

            [JsonIgnore]
            internal JObject ToJObject
            {
                get
                {
                    if (_jObject == null)
                    {
                        _jObject = new JObject
                        {
                            ["Shortname"] = Shortname,
                            ["DisplayName"] = DisplayName,
                            ["SkinID"] = Skin,
                            ["Amount"] = Amount,
                            ["Condition"] = Condition,
                            ["MaxCondition"] = MaxCondition,
                            ["IsBlueprint"] = BlueprintItemID != 0,
                            ["Ammo"] = Ammo,
                            ["AmmoType"] = Ammotype,
                            ["Text"] = Text,
                            ["Contents"] = new JArray()
                        };

                        if (Contents != null)
                        {
                            for (int i = 0; i < Contents.Length; i++)
                                ((JArray)_jObject["Contents"]).Add(Contents[i].ToJObject);
                        }

                        if (Container?.contents != null)
                        {
                            for (int i = 0; i < Container.contents.Count; i++)
                                ((JArray)_jObject["Contents"]).Add(Container.contents[i].ToJObject);
                        }
                    }
                    return _jObject;
                }
            }

            public class ItemContainerData
            {
                public int slots;
                public float temperature;
                public int flags;
                public int allowedContents;
                public int maxStackSize;
                public List<int> allowedItems;
                public List<int> availableSlots;
                public int volume;
                public List<ItemData> contents;

                public void Load(ItemContainer container)
                {
                    container.capacity = slots;
                    container.itemList = Pool.Get<List<Item>>();
                    container.temperature = temperature;
                    container.flags = (ItemContainer.Flag)flags;
                    container.allowedContents = (ItemContainer.ContentsType)(allowedContents == 0 ? 1 : allowedContents);

                    if (allowedItems is { Count: > 0 })
                    {
                        container.onlyAllowedItems = new ItemDefinition[allowedItems.Count];
                        for (int i = 0; i < allowedItems.Count; i++)
                            container.onlyAllowedItems[i] = ItemManager.FindItemDefinition(allowedItems[i]);
                    }
                    else
                    {
                        container.onlyAllowedItems = null;
                    }

                    container.maxStackSize = maxStackSize;
                    container.containerVolume = volume;
                    container.availableSlots.Clear();

                    if (availableSlots != null)
                    {
                        for (int i = 0; i < availableSlots.Count; i++)
                            container.availableSlots.Add((ItemSlot)availableSlots[i]);
                    }

                    if (contents != null)
                    {
                        for (int i = 0; i < contents.Count; i++)
                        {
                            Item item = CreateItem(contents[i]);
                            if (item != null && !item.MoveToContainer(container, contents[i].Position) && !item.MoveToContainer(container))
                                item.Remove();
                        }
                    }

                    container.MarkDirty();
                }
            }
        }
        #endregion
    }
}
