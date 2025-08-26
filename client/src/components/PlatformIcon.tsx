import React from "react";

// استورد كل الأيقونات
import TwitterIcon from "@/assets/icons/twitter.svg";
import InstagramIcon from "@/assets/icons/instagram.svg";
import TelegramIcon from "@/assets/icons/telegram.svg";
import TikTokIcon from "@/assets/icons/tiktok.svg";
import SnapchatIcon from "@/assets/icons/snapchat.svg";
import DiscordIcon from "@/assets/icons/discord.svg";

type Platform =
  | "twitter"
  | "instagram"
  | "telegram"
  | "tiktok"
  | "snapchat"
  | "discord";

interface Props {
  platform: Platform;
  size?: number; // حجم مخصص (px)
  className?: string; // ستايل إضافي Tailwind
}

const ICONS: Record<Platform, React.FunctionComponent<React.SVGProps<SVGSVGElement>>> = {
  twitter: TwitterIcon,
  instagram: InstagramIcon,
  telegram: TelegramIcon,
  tiktok: TikTokIcon,
  snapchat: SnapchatIcon,
  discord: DiscordIcon,
};

export function PlatformIcon({ platform, size = 32, className = "" }: Props) {
  const Icon = ICONS[platform];
  if (!Icon) return null;
  return (
    <Icon
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}