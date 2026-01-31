"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSteam, faDiscord, faGoogle, faTwitch } from "@fortawesome/free-brands-svg-icons";
import { Link2 } from "lucide-react";

export const PROVIDER_NAMES: Record<string, string> = {
  steam: "Steam",
  discord: "Discord",
  google: "Google",
  twitch: "Twitch",
  cfxre: "Cfx.re",
  mojang: "Minecraft",
  github: "GitHub",
};

export function getProviderName(provider: string): string {
  return PROVIDER_NAMES[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function getProviderBgClass(provider: string): string {
  const map: Record<string, string> = {
    steam: "bg-[#66c0f4]",
    discord: "bg-[#5865f2]",
    google: "bg-[#4285f4]",
    twitch: "bg-[#9146ff]",
    cfxre: "bg-[#f97316]",
  };
  return map[provider] || "bg-[#a855f7]";
}

export function getProviderGradient(provider: string): string {
  const map: Record<string, string> = {
    steam: "from-[#1b2838] to-[#2a475e]",
    discord: "from-[#5865f2] to-[#404eed]",
    google: "from-[#4285f4] to-[#34a853]",
    twitch: "from-[#9146ff] to-[#772ce8]",
    cfxre: "from-[#f97316] to-[#ea580c]",
  };
  return map[provider] || "from-[#a855f7] to-[#ec4899]";
}

export function getProviderIcon(provider: string, className: string = "w-4 h-4") {
  switch (provider) {
    case "steam":
      return <FontAwesomeIcon icon={faSteam} className={className} />;
    case "discord":
      return <FontAwesomeIcon icon={faDiscord} className={className} />;
    case "google":
      return <FontAwesomeIcon icon={faGoogle} className={className} />;
    case "twitch":
      return <FontAwesomeIcon icon={faTwitch} className={className} />;
    default:
      return <Link2 className={className} />;
  }
}
