using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Core.Libraries;
using Oxide.Core.Libraries.Covalence;
using System;
using System.Collections.Generic;

namespace Oxide.Plugins
{
    [Info("ServerID", "IFN.GG", "2.8.0")]
    public class ServerID : RustPlugin
    {
        private const string ApiToken = "ifn_kit_2332cee8bbf922c98d547a901d725460";
        private const string ApiUrl = "https://kits.icefuse.com/api/identifiers/register";
        private const string PlayersApiUrl = "https://kits.icefuse.com/api/identifiers/players";
        private const int MaxRetries = 3;
        private const float RetryDelay = 5f;
        private const float PlayerPollInterval = 60f;

        private string _serverId;
        private int _retryCount;
        private Timer _masterTimer;
        private float _nextRetry;
        private float _nextPlayerPoll;
        private bool _pendingRetry;
        private readonly Dictionary<string, object> _registerPayload = new(4);
        private readonly Dictionary<string, string> _headers = new(2)
        {
            ["Content-Type"] = "application/json",
            ["Authorization"] = $"Bearer {ApiToken}"
        };
        private readonly List<PlayerInfo> _playerInfoList = new(100);

        private struct PlayerInfo
        {
            public string steamId;
            public string playerName;
            public int connectionTime;
            public int idleTime;
        }

        private class StoredData { public string ServerId; }
        private class ApiResponse { public bool success; public ApiData data; }
        private class ApiData { public string serverId; public bool updated; }

        private void Init()
        {
            var data = Interface.Oxide.DataFileSystem.ReadObject<StoredData>(Name);
            _serverId = data?.ServerId;
        }

        private void OnServerInitialized()
        {
            float now = UnityEngine.Time.realtimeSinceStartup;
            _nextPlayerPoll = now + PlayerPollInterval;
            _masterTimer = timer.Every(1f, MasterTick);
            timer.Once(2f, RegisterServer);
        }

        private void Unload()
        {
            _masterTimer?.Destroy();
            _registerPayload.Clear();
            _playerInfoList.Clear();
        }

        private void MasterTick()
        {
            float now = UnityEngine.Time.realtimeSinceStartup;

            if (_pendingRetry && now >= _nextRetry)
            {
                _pendingRetry = false;
                RegisterServer();
            }

            if (now >= _nextPlayerPoll)
            {
                _nextPlayerPoll = now + PlayerPollInterval;
                SendPlayerData();
            }
        }

        private void RegisterServer()
        {
            var ip = ConVar.Server.ip;
            if (string.IsNullOrEmpty(ip) || ip == "0.0.0.0")
            {
                var addr = covalence.Server.Address;
                if (addr == null)
                {
                    PrintError("Server IP not yet resolved, retrying...");
                    ScheduleRetry();
                    return;
                }
                ip = addr.ToString();
            }

            _registerPayload["serverName"] = ConVar.Server.hostname;
            _registerPayload["ip"] = ip;
            _registerPayload["port"] = ConVar.Server.port;
            _registerPayload["connectEndpoint"] = ConVar.Server.favoritesEndpoint;

            var payload = JsonConvert.SerializeObject(_registerPayload);

            webrequest.Enqueue(ApiUrl, payload, (code, response) =>
            {
                if (!IsLoaded) return;

                if (code < 200 || code >= 300)
                {
                    PrintError($"Registration failed: HTTP {code} - {response}");
                    ScheduleRetry();
                    return;
                }

                try
                {
                    var result = JsonConvert.DeserializeObject<ApiResponse>(response);
                    if (result?.success != true || result.data == null)
                    {
                        PrintError($"Registration failed: {response}");
                        ScheduleRetry();
                        return;
                    }

                    _serverId = result.data.serverId;
                    _retryCount = 0;
                    _pendingRetry = false;
                    Interface.Oxide.DataFileSystem.WriteObject(Name, new StoredData { ServerId = _serverId });

                    if (result.data.updated)
                        Puts($"Server ID updated: {_serverId}");
                    else
                        Puts($"Server ID: {_serverId}");
                }
                catch (Exception ex)
                {
                    PrintError($"Failed to parse response: {ex.Message}");
                    ScheduleRetry();
                }
            }, this, RequestMethod.POST, _headers);
        }

        private void ScheduleRetry()
        {
            if (_retryCount >= MaxRetries)
            {
                if (!string.IsNullOrEmpty(_serverId))
                    Puts($"Using cached Server ID: {_serverId}");
                else
                    PrintError("Max retries reached, no cached Server ID available");
                return;
            }

            _retryCount++;
            float delay = RetryDelay * _retryCount;
            Puts($"Retrying in {delay}s (attempt {_retryCount}/{MaxRetries})");
            _nextRetry = UnityEngine.Time.realtimeSinceStartup + delay;
            _pendingRetry = true;
        }

        private void SendPlayerData()
        {
            if (string.IsNullOrEmpty(_serverId)) return;

            _playerInfoList.Clear();
            var players = BasePlayer.activePlayerList;
            float now = UnityEngine.Time.realtimeSinceStartup;

            for (int i = 0; i < players.Count; i++)
            {
                var p = players[i];
                if (p == null || !p.IsConnected || p.net?.connection == null) continue;

                _playerInfoList.Add(new PlayerInfo
                {
                    steamId = p.UserIDString,
                    playerName = p.displayName ?? string.Empty,
                    connectionTime = (int)(now - p.net.connection.connectionTime),
                    idleTime = (int)p.IdleTime
                });
            }

            var payload = JsonConvert.SerializeObject(new
            {
                serverId = _serverId,
                serverName = ConVar.Server.hostname,
                playerCount = _playerInfoList.Count,
                players = _playerInfoList
            });

            webrequest.Enqueue(PlayersApiUrl, payload, (code, response) =>
            {
                if (!IsLoaded) return;
                if (code < 200 || code >= 300)
                    PrintError($"Player data failed: HTTP {code}");
            }, this, RequestMethod.POST, _headers);
        }
    }
}
