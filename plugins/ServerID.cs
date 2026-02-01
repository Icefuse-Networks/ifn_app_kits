using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Core.Libraries;
using Oxide.Core.Libraries.Covalence;
using System;
using System.Collections.Generic;

namespace Oxide.Plugins
{
    [Info("ServerID", "IFN.GG", "2.4.0")]
    public class ServerID : RustPlugin
    {
        private const string ApiToken = "ifn_kit_2332cee8bbf922c98d547a901d725460";
        private const string ApiUrl = "https://kits.icefuse.net/api/identifiers/register";
        private const string PlayersApiUrl = "https://kits.icefuse.net/api/identifiers/players";
        private const int MaxRetries = 3;
        private const float RetryDelay = 5f;
        private const float PlayerPollInterval = 60f;

        private string _serverId;
        private int _retryCount;
        private Timer _retryTimer;
        private Timer _playerPollTimer;
        private readonly Dictionary<string, object> _registerPayload = new Dictionary<string, object>(4);
        private readonly Dictionary<string, object> _playersPayload = new Dictionary<string, object>(3);
        private readonly List<Dictionary<string, object>> _playerList = new List<Dictionary<string, object>>(100);
        private readonly Dictionary<string, string> _headers = new Dictionary<string, string>(2)
        {
            ["Content-Type"] = "application/json",
            ["Authorization"] = $"Bearer {ApiToken}"
        };

        private class StoredData { public string ServerId; }
        private class ApiResponse { public bool success; public ApiData data; }
        private class ApiData { public string serverId; public bool updated; }

        private void Init()
        {
            var data = Interface.Oxide.DataFileSystem.ReadObject<StoredData>(Name);
            _serverId = data?.ServerId;
            RegisterServer();
        }

        private void OnServerInitialized()
        {
            _playerPollTimer = timer.Every(PlayerPollInterval, SendPlayerData);
        }

        private void Unload()
        {
            _retryTimer?.Destroy();
            _playerPollTimer?.Destroy();
        }

        private void RegisterServer()
        {
            _registerPayload["serverName"] = ConVar.Server.hostname;
            _registerPayload["ip"] = covalence.Server.Address.ToString();
            _registerPayload["port"] = covalence.Server.Port;
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
                    if (!result.success)
                    {
                        PrintError($"Registration failed: {response}");
                        ScheduleRetry();
                        return;
                    }

                    _serverId = result.data.serverId;
                    _retryCount = 0;
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
            var delay = RetryDelay * _retryCount;
            Puts($"Retrying in {delay}s (attempt {_retryCount}/{MaxRetries})");
            _retryTimer?.Destroy();
            _retryTimer = timer.Once(delay, () =>
            {
                if (!IsLoaded) return;
                RegisterServer();
            });
        }

        private void SendPlayerData()
        {
            if (string.IsNullOrEmpty(_serverId)) return;

            var players = BasePlayer.activePlayerList;
            if (players.Count == 0) return;

            _playerList.Clear();
            float now = UnityEngine.Time.realtimeSinceStartup;

            for (int i = 0; i < players.Count; i++)
            {
                var p = players[i];
                if (p == null || !p.IsConnected) continue;

                _playerList.Add(new Dictionary<string, object>(4)
                {
                    ["steamId"] = p.UserIDString,
                    ["playerName"] = p.displayName,
                    ["connectionTime"] = (int)(now - p.net.connection.connectionTime),
                    ["idleTime"] = (int)p.IdleTime
                });
            }

            if (_playerList.Count == 0) return;

            _playersPayload["serverId"] = _serverId;
            _playersPayload["playerCount"] = _playerList.Count;
            _playersPayload["players"] = _playerList;

            var payload = JsonConvert.SerializeObject(_playersPayload);

            webrequest.Enqueue(PlayersApiUrl, payload, (code, response) =>
            {
                if (!IsLoaded) return;
                if (code < 200 || code >= 300)
                    PrintError($"Player data failed: HTTP {code}");
            }, this, RequestMethod.POST, _headers);
        }
    }
}
