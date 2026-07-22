import type { PropsWithChildren, SVGProps } from "react";

// Hand-drawn line-icon set for Deer Intel — a small, on-brand alternative to
// emoji, which render differently on every device. Every icon draws with
// `currentColor` and a consistent 1.8 stroke, so it inherits text color and
// sits naturally beside type. Size defaults to 24 and is overridable.

export type IconProps = { size?: number } & Omit<
  SVGProps<SVGSVGElement>,
  "width" | "height"
>;

function Svg({
  size = 24,
  children,
  ...rest
}: PropsWithChildren<IconProps>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function DeerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4c0 2.4 1 3.9 1 5.8M16 4c0 2.4-1 3.9-1 5.8M5.2 6c1.2.6 2 .9 3 2.6M18.8 6c-1.2.6-2 .9-3 2.6" />
      <path d="M9.2 10.4c-1 1-1.6 2.4-1.6 3.9 0 2.6 2 4.3 4.4 4.3s4.4-1.7 4.4-4.3c0-1.5-.6-2.9-1.6-3.9" />
      <path d="M10.3 13.7h.01M13.7 13.7h.01" />
      <path d="M12 15.6v1.2" />
    </Svg>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 11.4v.01" strokeWidth={2.6} />
    </Svg>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.6 8.4 13.3 13.7 8 16l2.3-5.3z" />
    </Svg>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18 3c-6.5 0-12 4.3-12.7 11.4-.2 1.7-.1 3.3.4 4.9.5-3 1.9-5.5 4.3-7.6 2-1.7 4.1-2.6 4.1-2.6S13.4 12 11.2 14.3C13.6 14.5 15.8 13.7 17.5 12 20 9.7 21 6.3 18 3Z" />
      <path d="M6 20c1.7-3.3 3.4-5.5 6.7-7.7" />
    </Svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14.4A8 8 0 1 1 9.6 4 6.5 6.5 0 0 0 20 14.4Z" />
    </Svg>
  );
}

export function SunriseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 19h18" />
      <path d="M7.5 19a4.5 4.5 0 0 1 9 0" />
      <path d="M12 3v3.5M5 8l1.6 1.6M19 8l-1.6 1.6M2.5 14H4M20 14h1.5" />
    </Svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4.4" />
      <path d="M12 2.3v2.4M12 19.3v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.3 12h2.4M19.3 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" />
    </Svg>
  );
}

export function SunsetIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 19h18" />
      <path d="M7.5 19a4.5 4.5 0 0 1 9 0" />
      <path d="M12 8V4.5M5 9.5l1.6-1.6M19 9.5l-1.6-1.6M2.5 14H4M20 14h1.5" />
    </Svg>
  );
}

export function MapIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4 3.5 6.1v13.8L9 17.8l6 2.1 5.5-2.1V4L15 6.1 9 4Z" />
      <path d="M9 4v13.8M15 6.1v13.8" />
    </Svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s-6.5-5-6.5-10a6.5 6.5 0 0 1 13 0c0 5-6.5 10-6.5 10Z" />
      <circle cx="12" cy="11" r="2.3" />
    </Svg>
  );
}

export function StandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3v18" />
      <path d="M6 6.5c2 .4 3.4 1 5 3M6 10.5c1.4.3 2.4.6 3.4 1.7" />
      <path d="M6 13.2h9" />
      <path d="M11 13.2V21M15 13.2V21M11 16.6h4M11 20h4" />
    </Svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="7" width="16" height="12" rx="2.2" />
      <circle cx="12" cy="13" r="3.2" />
      <path d="M8.4 7 9.6 5h4.8L15.6 7" />
    </Svg>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2.2" />
      <path d="M9 4.5a3 3 0 0 1 6 0v1.2H9z" />
      <path d="M8.6 11h6.8M8.6 15h4.6" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 11.5 12 4.5l8 7" />
      <path d="M5.5 10.2V19a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1v-8.8" />
    </Svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.6v2.3M12 19.1v2.3M4.2 6.6l1.6 1.6M18.2 15.8l1.6 1.6M2.6 12h2.3M19.1 12h2.3M4.2 17.4l1.6-1.6M18.2 8.2l1.6-1.6" />
    </Svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.4" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4 17l4.5-4.5a2 2 0 0 1 2.8 0L16 17M14 15l1.8-1.8a2 2 0 0 1 2.8 0L20.5 15" />
    </Svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.4" />
      <path d="M4 9.5h16M8 3.5v3M16 3.5v3" />
    </Svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
      <path d="M7 5H4.5a2.5 2.5 0 0 0 3 2.4M17 5h2.5a2.5 2.5 0 0 1-3 2.4" />
      <path d="M12 13v3M9 20h6M9.5 20a2.5 2.5 0 0 1 5 0" />
    </Svg>
  );
}
