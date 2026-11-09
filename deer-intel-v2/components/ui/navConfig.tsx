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
  TrophyIcon,
  UsersIcon,
} from "@/components/ui/FieldIcons";

// The one list of places in the app. The desktop sidebar and the phone's
// More menu both render from it, so they can't drift apart. Each place has
// one name, used in the nav and as its page eyebrow.

export type NavLink = { href: string; label: string; icon: (size: number) => ReactNode };
export type NavGroup = {
  heading?: string;
  /** Quick-add actions rather than places: compact tiles, never "current". */
  quickAdd?: boolean;
  links: NavLink[];
};

// The map's ?pin=<type> deep link arms tap-to-place for that pin type (see
// HuntingMap). Scrape is the sign most often marked on the walk.
const DROP_PIN_HREF = "/map?pin=Scrape";

export const NAV_GROUPS: NavGroup[] = [
  // The field tabs. On a phone these are the bottom bar, so the More menu
  // filters this group out entirely.
  {
    links: [
      { href: "/", label: "Today", icon: (s) => <HomeIcon size={s} /> },
      { href: "/map", label: "Map", icon: (s) => <MapIcon size={s} /> },
      { href: "/cameras", label: "Cameras", icon: (s) => <CameraIcon size={s} /> },
      { href: "/hunt-log", label: "Log Sit", icon: (s) => <ClipboardIcon size={s} /> },
    ],
  },
  {
    heading: "Quick add",
    quickAdd: true,
    links: [
      { href: "/cameras#add-camera", label: "Camera", icon: (s) => <CameraIcon size={s} /> },
      { href: "/stands#add-stand", label: "Stand", icon: (s) => <StandIcon size={s} /> },
      { href: DROP_PIN_HREF, label: "Scrape", icon: (s) => <MapPinIcon size={s} /> },
    ],
  },
  {
    heading: "In the woods",
    links: [
      { href: "/stands", label: "Stands", icon: (s) => <StandIcon size={s} /> },
      { href: "/hit-list", label: "Hit List", icon: (s) => <DeerIcon size={s} /> },
      { href: "/ai", label: "AI Scout", icon: (s) => <TargetIcon size={s} /> },
    ],
  },
  {
    heading: "Season",
    links: [
      { href: "/calendar", label: "Calendar", icon: (s) => <CalendarIcon size={s} /> },
      { href: "/report", label: "Season Report", icon: (s) => <TrophyIcon size={s} /> },
    ],
  },
  {
    heading: "Ground and crew",
    links: [
      { href: "/properties", label: "Properties", icon: (s) => <MapPinIcon size={s} /> },
      { href: "/party", label: "Party", icon: (s) => <UsersIcon size={s} /> },
    ],
  },
];

export const SETTINGS_LINK: NavLink = {
  href: "/settings",
  label: "Settings",
  icon: (s) => <GearIcon size={s} />,
};

export const IMPORT_LINK: NavLink = {
  href: "/import",
  label: "Import",
  icon: (s) => <PlusIcon size={s} />,
};

// Utility places pinned to the foot of the sidebar and the More menu.
export const FOOTER_LINKS: NavLink[] = [SETTINGS_LINK, IMPORT_LINK];

// Phone bottom bar: the four things done most in the field, plus More.
export const MOBILE_TABS: NavLink[] = NAV_GROUPS[0].links;

export function isActivePath(pathname: string, href: string) {
  // Match on the path alone, ignoring any ?query or #anchor on the link.
  const [path] = href.split(/[?#]/);
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}
