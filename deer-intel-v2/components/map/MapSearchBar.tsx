import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  suggestAddresses,
  type AddressSearchPlace,
  type MapCenter,
} from "@/lib/propertyMap";

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

function PinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
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
  biasCenter?: MapCenter;
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
  biasCenter,
  onCreateAssetHere,
  onSearch,
  onSelectResult,
}: MapSearchBarProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep the latest map center without re-running the debounce on every pan.
  const biasRef = useRef<MapCenter | undefined>(biasCenter);
  biasRef.current = biasCenter;

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

  // Debounced typeahead: fetch address suggestions ~220ms after the user pauses.
  useEffect(() => {
    if (!showSuggestions || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    let active = true;
    const handle = window.setTimeout(() => {
      suggestAddresses(query, biasRef.current).then((list) => {
        if (active) setSuggestions(list);
      });
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [query, showSuggestions]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowSuggestions(false);
    setSuggestions([]);
    onSearch(query);
  }

  // Picking a suggestion runs the full search on it, which geocodes to the
  // rooftop location and flies the map there (parent auto-selects the top hit).
  function handleSelectSuggestion(text: string) {
    setQuery(text);
    setShowSuggestions(false);
    setSuggestions([]);
    onSearch(text);
  }

  // Picking a result flies the map there — collapse so the map is unobstructed.
  function handleSelectResult(result: AddressSearchPlace) {
    setShowSuggestions(false);
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

  const suggestionsVisible = showSuggestions && suggestions.length > 0;

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
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setShowSuggestions(true);
          }}
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

      {suggestionsVisible ? (
        <div
          style={suggestionsPanelStyle}
          role="listbox"
          aria-label="Address suggestions"
        >
          {suggestions.map((text) => (
            <button
              key={text}
              type="button"
              role="option"
              aria-selected={false}
              style={suggestionRowStyle}
              onClick={() => handleSelectSuggestion(text)}
            >
              <span style={suggestionIconStyle} aria-hidden="true">
                <PinIcon />
              </span>
              <span style={suggestionTextStyle}>{text}</span>
            </button>
          ))}
        </div>
      ) : !showSuggestions &&
        (message || results.length > 0 || canCreateAsset) ? (
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
              <p style={providerNoteStyle}>
                Search by Esri, US Census &amp; OpenStreetMap.
              </p>
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
  // Grouped with the Layers gear on the top-right so the top-left stays clear
  // for the base-map/overlay bar and more of the map shows through.
  right: "10.5rem",
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
  // Expands from the top-right (by the gear) and grows leftward; the results
  // panel drops beneath it.
  right: "1rem",
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

const suggestionsPanelStyle: CSSProperties = {
  overflow: "hidden",
  marginTop: "0.4rem",
  border: "1px solid rgba(255, 255, 255, 0.62)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.97)",
  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
};

const suggestionRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.55rem",
  alignItems: "center",
  width: "100%",
  padding: "0.6rem 0.7rem",
  border: 0,
  borderBottom: "1px solid rgba(17, 23, 17, 0.08)",
  background: "transparent",
  color: "#111711",
  cursor: "pointer",
  textAlign: "left",
  fontSize: "0.9rem",
};

const suggestionIconStyle: CSSProperties = {
  flex: "0 0 auto",
  display: "inline-flex",
  color: "#56705a",
};

const suggestionTextStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontWeight: 600,
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
