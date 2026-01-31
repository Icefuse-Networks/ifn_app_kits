using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Core.Libraries;
using System;
using System.Collections.Generic;

namespace Oxide.Plugins
{
    [Info("ServerID", "IFN.GG", "2.1.0")]
    public class ServerID : RustPlugin
    {
        private const string ApiToken = "ifn_kit_2332cee8bbf922c98d547a901d725460";
        private const string ApiUrl = "https://kits.icefuse.net/api/identifiers/register";
        private const int MaxRetries = 3;
        private const float RetryDelay = 5f;

        private static ServerID _instance;
        private string _serverId;
        private int _retryCount;

        public static string ServerId => _instance?._serverId;

        private class StoredData { public string ServerId; }
        private class ApiResponse { public bool success; public ApiData data; }
        private class ApiData { public string serverId; public bool updated; }

        private void Init()
        {
            _instance = this;
            var data = Interface.Oxide.DataFileSystem.ReadObject<StoredData>(Name);
            _serverId = data?.ServerId;
            RegisterServer();
        }

        private void RegisterServer()
        {
            var payload = JsonConvert.SerializeObject(new Dictionary<string, object>
            {
                ["serverName"] = ConVar.Server.hostname,
                ["ip"] = ConVar.Server.ip,
                ["port"] = ConVar.Server.port
            });

            webrequest.Enqueue(ApiUrl, payload, (code, response) =>
            {
                if (code < 200 || code >= 300)
                {
                    PrintError($"Registration failed: HTTP {code}");
                    ScheduleRetry();
                    return;
                }

                try
                {
                    var result = JsonConvert.DeserializeObject<ApiResponse>(response);
                    if (!result.success)
                    {
                        PrintError("Registration failed: API returned failure");
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
            }, this, RequestMethod.POST, new Dictionary<string, string>
            {
                ["Content-Type"] = "application/json",
                ["Authorization"] = $"Bearer {ApiToken}"
            });
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
            timer.Once(delay, RegisterServer);
        }

        private void Unload() => _instance = null;
    }
}
