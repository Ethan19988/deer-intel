"use client";

import {
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";

export type TabItem = {
  id: string;
  label: string;
  badge?: string | number;
  content: ReactNode;
};

type TabsProps = {
  items: TabItem[];
  initialId?: string;
  /** Controlled active tab. When set, the parent owns the state. */
  activeId?: string;
  onChange?: (id: string) => void;
  /**
   * Opt-in deep linking: the name of a URL search param (e.g. "tab") that
   * selects the active tab, so /settings?tab=data opens straight on Data.
   * Picking a tab writes it back to the URL (replace, no new history entry).
   */
  urlParam?: string;
};

// A lightweight segmented tab control so a page can lead with its primary view
// and tuck secondary content (summaries, intelligence) behind a click. Works
// uncontrolled, controlled via activeId/onChange, or driven by a URL param.
export default function Tabs({
  items,
  initialId,
  activeId,
  onChange,
  urlParam,
}: TabsProps) {
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [internalId, setInternalId] = useState(initialId ?? items[0]?.id);
  const currentId = activeId ?? internalId;
  const activeItem = items.find((item) => item.id === currentId) ?? items[0];

  function applyId(id: string) {
    if (activeId === undefined) setInternalId(id);
    onChange?.(id);
  }

  function selectTab(id: string) {
    applyId(id);
    if (urlParam) writeTabParam(urlParam, id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key) || !activeItem) return;
    event.preventDefault();
    const index = items.findIndex((item) => item.id === activeItem.id);
    const last = items.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? last
          : event.key === "ArrowRight"
            ? (index + 1) % items.length
            : (index - 1 + items.length) % items.length;
    const next = items[nextIndex];
    if (!next) return;
    selectTab(next.id);
    tabRefs.current.get(next.id)?.focus();
  }

  if (!activeItem) return null;

  const tabDomId = (id: string) => `${baseId}-tab-${id}`;
  const panelDomId = (id: string) => `${baseId}-panel-${id}`;

  return (
    <div style={wrapStyle}>
      {urlParam ? (
        // useSearchParams needs a Suspense boundary to keep static pages
        // prerenderable; the sync renders nothing, so null is a fine fallback.
        <Suspense fallback={null}>
          <TabParamSync
            param={urlParam}
            ids={items.map((item) => item.id)}
            onValue={applyId}
          />
        </Suspense>
      ) : null}
      <div
        role="tablist"
        aria-label="View"
        style={tablistStyle}
        onKeyDown={handleKeyDown}
      >
        {items.map((item) => {
          const isActive = item.id === activeItem.id;

          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) tabRefs.current.set(item.id, node);
                else tabRefs.current.delete(item.id);
              }}
              id={tabDomId(item.id)}
              type="button"
              role="tab"
              aria-selected={isActive}
              // Only the active panel is rendered, so only its tab can point
              // at a real element.
              aria-controls={isActive ? panelDomId(item.id) : undefined}
              // Roving tabindex: Tab enters the active tab, arrows move.
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(item.id)}
              style={{ ...tabStyle, ...(isActive ? activeTabStyle : null) }}
            >
              {item.label}
              {item.badge !== undefined && item.badge !== "" ? (
                <span
                  style={{
                    ...countStyle,
                    ...(isActive ? activeCountStyle : null),
                  }}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={panelDomId(activeItem.id)}
        aria-labelledby={tabDomId(activeItem.id)}
      >
        {activeItem.content}
      </div>
    </div>
  );
}

// Follows the URL param, including client-side navigations to the same page
// with a different ?tab= (e.g. a banner link tapped while already there).
function TabParamSync({
  param,
  ids,
  onValue,
}: {
  param: string;
  ids: string[];
  onValue: (id: string) => void;
}) {
  const value = useSearchParams().get(param);
  const valid = value !== null && ids.includes(value) ? value : null;

  useEffect(() => {
    if (valid) onValue(valid);
    // onValue is recreated every render; only a URL change should re-apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid]);

  return null;
}

function writeTabParam(param: string, id: string) {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(param) === id) return;
    url.searchParams.set(param, id);
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // URL sync is a convenience; the tab still switches without it.
  }
}

const wrapStyle: CSSProperties = {
  display: "grid",
  // Constrain the column so the tablist (which scrolls) and a wide tabpanel
  // child can't stretch the page wider than the viewport on mobile.
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "1.15rem",
};

const tablistStyle: CSSProperties = {
  display: "inline-flex",
  gap: "0.25rem",
  padding: "0.28rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--surface-2)",
  width: "fit-content",
  maxWidth: "100%",
  overflowX: "auto",
};

const tabStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  minHeight: "44px",
  padding: "0.4rem 0.9rem",
  border: "1px solid transparent",
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  color: "var(--text-muted)",
  fontFamily: "var(--font-display), \"Arial Narrow\", sans-serif",
  fontSize: "1.15rem",
  fontWeight: 400,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const activeTabStyle: CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  boxShadow: "inset 0 -2px 0 var(--accent-2)",
};

const countStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "1.3rem",
  padding: "0 0.35rem",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-3)",
  color: "var(--text-muted)",
  fontSize: "0.78rem",
  fontWeight: 800,
};

const activeCountStyle: CSSProperties = {
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};
