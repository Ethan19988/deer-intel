import type { ReactNode } from "react";
import {
  CalendarIcon,
  CameraIcon,
  ClipboardIcon,
  DeerIcon,
  GearIcon,
  HomeIcon,
  MapIcon,
  MapPinIcon,
  PlusIcon,
  StandIcon,
  TargetIcon,
  UsersIcon,
} from "@/components/ui/FieldIcons";

// The one list of places in the app. The desktop sidebar and the phone's
// More menu both render from it, so they can't drift apart.

export type NavLink = { href: string; label: string; icon: (size: number) => ReactNode };
export type NavGroup = { heading?: string; links: NavLink[] };

export const NAV_GROUPS: NavGroup[] = [
  { links: [{ href: "/", label: "Today", icon: (s) => <HomeIcon size={s} /> }] },
  {
    heading: "Scout the land",
    links: [
      { href: "/map", label: "Map", icon: (s) => <MapIcon size={s} /> },
      { href: "/cameras", label: "Cameras", icon: (s) => <CameraIcon size={s} /> },
      { href: "/stands", label: "Stands", icon: (s) => <StandIcon size={s} /> },
      { href: "/hit-list", label: "Bucks", icon: (s) => <DeerIcon size={s} /> },
      { href: "/properties", label: "Properties", icon: (s) => <MapPinIcon size={s} /> },
      { href: "/import", label: "Import", icon: (s) => <PlusIcon size={s} /> },
    ],
  },
  {
    heading: "Plan the hunt",
    links: [
      { href: "/ai", label: "Hunt Plan", icon: (s) => <TargetIcon size={s} /> },
      { href: "/hunt-log", label: "Hunt Log", icon: (s) => <ClipboardIcon size={s} /> },
      { href: "/calendar", label: "Calendar", icon: (s) => <CalendarIcon size={s} /> },
      { href: "/party", label: "Party", icon: (s) => <UsersIcon size={s} /> },
    ],
  },
];

export const SETTINGS_LINK: NavLink = {
  href: "/settings",
  label: "Settings",
  icon: (s) => <GearIcon size={s} />,
};

// Phone bottom bar: the four things done most in the field, plus More.
export const MOBILE_TABS: NavLink[] = [
  { href: "/", label: "Today", icon: (s) => <HomeIcon size={s} /> },
  { href: "/map", label: "Map", icon: (s) => <MapIcon size={s} /> },
  { href: "/cameras", label: "Cameras", icon: (s) => <CameraIcon size={s} /> },
  { href: "/hunt-log", label: "Log sit", icon: (s) => <ClipboardIcon size={s} /> },
];

export function isActivePath(pathname: string, href: string) {
  const [path] = href.split("?");
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}
