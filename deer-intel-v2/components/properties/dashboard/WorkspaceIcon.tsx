import type { CSSProperties } from "react";

export type WorkspaceIconName =
  | "overview"
  | "map"
  | "cameras"
  | "stands"
  | "huntLog"
  | "deerHistory"
  | "aiScout"
  | "analytics";

export default function WorkspaceIcon({ name }: { name: WorkspaceIconName }) {
  if (name === "overview") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M5 6h14M5 12h8M5 18h14" style={iconPathStyle} />
      </svg>
    );
  }

  if (name === "map") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path
          d="M9 18 4 20V6l5-2 6 2 5-2v14l-5 2-6-2Z"
          style={iconPathStyle}
        />
        <path d="M9 4v14M15 6v14" style={iconPathStyle} />
      </svg>
    );
  }

  if (name === "cameras") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M5 8h3l2-2h4l2 2h3v10H5V8Z" style={iconPathStyle} />
        <path
          d="M12 11.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
          style={iconPathStyle}
        />
      </svg>
    );
  }

  if (name === "stands") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M7 20 12 4l5 16M9 13h6M8 17h8" style={iconPathStyle} />
        <path d="M10 8h4" style={iconPathStyle} />
      </svg>
    );
  }

  if (name === "huntLog") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M7 4h10v16H7V4Z" style={iconPathStyle} />
        <path d="M10 8h4M10 12h4M10 16h2" style={iconPathStyle} />
      </svg>
    );
  }

  if (name === "deerHistory") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M5 18c2.5-5 6.5-8 14-10" style={iconPathStyle} />
        <path
          d="M7 15c1.5.5 3 .5 4.5-.2M11 11c1 .7 2.2 1.1 3.8 1.1"
          style={iconPathStyle}
        />
        <path
          d="M6 6c1.8.2 3.2 1 4.2 2.3M8 4c.6 1.6 1.4 2.9 2.4 3.9"
          style={iconPathStyle}
        />
      </svg>
    );
  }

  if (name === "analytics") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
        <path d="M5 19V5M5 19h14" style={iconPathStyle} />
        <path d="M8 16v-4M12 16V8M16 16v-6" style={iconPathStyle} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={iconStyle}>
      <path
        d="M12 3v4M12 17v4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M3 12h4M17 12h4M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"
        style={iconPathStyle}
      />
      <path
        d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
        style={iconPathStyle}
      />
    </svg>
  );
}

const iconStyle: CSSProperties = {
  width: "1.35rem",
  height: "1.35rem",
};

const iconPathStyle: CSSProperties = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
