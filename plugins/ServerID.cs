using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Core.Libraries;
using System;
using System.Collections.Generic;

namespace Oxide.Plugins
{
    [Info("ServerID", "IFN.GG", "2.0.0")]
    public class ServerID : RustPlugin
    {
        private const string ApiToken = "ifn_kit_2332cee8bbf922c98d547a901d725460";
        private const string ApiUrl = "https://kits.icefuse.net/api/identifiers/register";

        private static ServerID _instance;
        private string _serverId;

        public static string ServerId => _instance?._serverId;

        private class StoredData { public string ServerId; }
        private class ApiResponse { public bool success; public ApiData data; }
        private class ApiData { public string serverId; }

        private void Init()
        {
            _instance = this;
            var data = Interface.Oxide.DataFileSystem.ReadObject<StoredData>(Name);
            if (!string.IsNullOrEmpty(data?.ServerId))
            {
                _serverId = data.ServerId;
                Puts($"Server ID: {_serverId}");
                return;
            }

            var payload = JsonConvert.SerializeObject(new Dictionary<string, object>
            {
                ["serverName"] = ConVar.Server.hostname,
                ["ip"] = ConVar.Server.ip,
                ["port"] = ConVar.Server.port
            });

            webrequest.Enqueue(ApiUrl, payload, (code, response) =>
            {
                if (code < 200 || code >= 300) { PrintError($"Registration failed: {code}"); return; }
                var result = JsonConvert.DeserializeObject<ApiResponse>(response);
                if (!result.success) { PrintError("Registration failed"); return; }
                _serverId = result.data.serverId;
                Interface.Oxide.DataFileSystem.WriteObject(Name, new StoredData { ServerId = _serverId });
                Puts($"Registered: {_serverId}");
            }, this, RequestMethod.POST, new Dictionary<string, string>
            {
                ["Content-Type"] = "application/json",
                ["Authorization"] = $"Bearer {ApiToken}"
            });
        }

        private void Unload() => _instance = null;
    }
}
