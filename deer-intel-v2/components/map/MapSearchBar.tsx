import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import type { AddressSearchPlace } from "@/lib/propertyMap";

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

type MapSearchBarProps = {
  canCreateAsset: boolean;
  isSearching: boolean;
  message: string;
  results: AddressSearchPlace[];
  selectedAssetType: string;
  selectedResultId: string | null;
  onCreateAssetHere: () => void;
  onSearch: (query: string) => void;
  onSelectResult: (result: AddressSearchPlace) => void;
};

export default function MapSearchBar({
  canCreateAsset,
  isSearching,
  message,
  results,
  selectedAssetType,
  selectedResultId,
  onCreateAssetHere,
  onSearch,
  onSelectResult,
}: MapSearchBarProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the field the moment search opens so the user can type immediately.
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Close on Escape while open.
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(query);
  }

  // Picking a result flies the map there — collapse so the map is unobstructed.
  function handleSelectResult(result: AddressSearchPlace) {
    onSelectResult(result);
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <div
        className="di-map-search di-map-search-collapsed"
        style={collapsedWrapStyle}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Search address or place"
          style={iconButtonStyle}
          onClick={() => setIsOpen(true)}
        >
          <SearchIcon />
        </button>
      </div>
    );
  }

  return (
    <div
      className="di-map-search"
      style={searchWrapStyle}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <form onSubmit={handleSubmit} style={searchFormStyle}>
        <span style={leadingIconStyle} aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          type="search"
          placeholder="Search address or place"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={searchInputStyle}
        />
        <button type="submit" style={searchButtonStyle}>
          {isSearching ? "Searching" : "Search"}
        </button>
        <button
          type="button"
          aria-label="Close search"
          style={closeButtonStyle}
          onClick={() => setIsOpen(false)}
        >
          ×
        </button>
      </form>

      {message || results.length > 0 || canCreateAsset ? (
        <div style={searchPanelStyle}>
          {message ? <p style={messageStyle}>{message}</p> : null}

          {results.length > 0 ? (
            <div style={resultListStyle}>
              {results.map((result) => {
                const isSelected = result.id === selectedResultId;

                return (
                  <button
                    key={result.id}
                    type="button"
                    style={{
                      ...resultButtonStyle,
                      ...(isSelected ? selectedResultButtonStyle : null),
                    }}
                    onClick={() => handleSelectResult(result)}
                  >
                    <span style={resultTitleStyle}>{result.label}</span>
                    <span style={resultMetaStyle}>
                      {result.typeLabel} - {result.provider}
                    </span>
                  </button>
                );
              })}
              <p style={providerNoteStyle}>Search powered by OpenStreetMap.</p>
            </div>
          ) : null}

          {canCreateAsset ? (
            <button
              type="button"
              style={createAssetButtonStyle}
              onClick={onCreateAssetHere}
            >
              Create Asset Here
              <span style={createAssetTypeStyle}>{selectedAssetType}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const collapsedWrapStyle: CSSProperties = {
  position: "absolute",
  top: "1rem",
  left: "1rem",
  zIndex: 1060,
};

const iconButtonStyle: CSSProperties = {
  display: "inline-flex",
  width: "48px",
  height: "48px",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.96)",
  color: "#111711",
  cursor: "pointer",
  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
};

const searchWrapStyle: CSSProperties = {
  position: "absolute",
  top: "1rem",
  left: "1rem",
  zIndex: 1080,
  width: "min(430px, calc(100% - 2rem))",
};

const searchFormStyle: CSSProperties = {
  display: "flex",
  minHeight: "48px",
  alignItems: "center",
  overflow: "hidden",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
};

const leadingIconStyle: CSSProperties = {
  display: "inline-flex",
  flex: "0 0 auto",
  alignItems: "center",
  paddingLeft: "0.75rem",
  color: "#56705a",
};

const searchInputStyle: CSSProperties = {
  minWidth: 0,
  flex: "1 1 auto",
  border: 0,
  background: "transparent",
  color: "#111711",
  padding: "0 0.75rem",
  fontSize: "1rem",
  outline: "none",
};

const closeButtonStyle: CSSProperties = {
  flex: "0 0 auto",
  display: "inline-flex",
  width: "44px",
  alignSelf: "stretch",
  alignItems: "center",
  justifyContent: "center",
  border: 0,
  borderLeft: "1px solid rgba(17, 23, 17, 0.12)",
  background: "#f1f5ef",
  color: "#111711",
  fontSize: "1.5rem",
  lineHeight: 1,
  fontWeight: 700,
  cursor: "pointer",
};

const searchButtonStyle: CSSProperties = {
  flex: "0 0 auto",
  border: 0,
  borderLeft: "1px solid rgba(17, 23, 17, 0.12)",
  background: "#f1f5ef",
  color: "#111711",
  padding: "0 0.9rem",
  fontSize: "0.94rem",
  fontWeight: 800,
  cursor: "pointer",
};

const searchPanelStyle: CSSProperties = {
  display: "grid",
  gap: "0.55rem",
  marginTop: "0.5rem",
  padding: "0.55rem",
  border: "1px solid rgba(255, 255, 255, 0.62)",
  borderRadius: "8px",
  background: "rgba(17, 23, 17, 0.92)",
  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
};

const messageStyle: CSSProperties = {
  margin: 0,
  color: "#f1f5ef",
  fontSize: "0.88rem",
  fontWeight: 700,
  lineHeight: 1.35,
};

const resultListStyle: CSSProperties = {
  display: "grid",
  gap: "0.45rem",
};

const resultButtonStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
  width: "100%",
  padding: "0.65rem",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.95)",
  color: "#111711",
  cursor: "pointer",
  textAlign: "left",
};

const selectedResultButtonStyle: CSSProperties = {
  borderColor: "#74a86f",
  background: "#edf7ea",
};

const resultTitleStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "0.92rem",
  fontWeight: 800,
};

const resultMetaStyle: CSSProperties = {
  color: "#485248",
  fontSize: "0.78rem",
  fontWeight: 700,
  textTransform: "capitalize",
};

const providerNoteStyle: CSSProperties = {
  margin: 0,
  color: "#c6d5c5",
  fontSize: "0.76rem",
  lineHeight: 1.35,
};

const createAssetButtonStyle: CSSProperties = {
  display: "flex",
  minHeight: "46px",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.65rem",
  padding: "0.65rem 0.75rem",
  border: "1px solid #74a86f",
  borderRadius: "8px",
  background: "#17331b",
  color: "white",
  fontSize: "0.94rem",
  fontWeight: 900,
  cursor: "pointer",
};

const createAssetTypeStyle: CSSProperties = {
  color: "#d7e7d3",
  fontSize: "0.78rem",
  fontWeight: 800,
};
