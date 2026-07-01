import { useState, type CSSProperties, type FormEvent } from "react";

type MapSearchBarProps = {
  message: string;
  onSearch: (query: string) => void;
};

export default function MapSearchBar({
  message,
  onSearch,
}: MapSearchBarProps) {
  const [query, setQuery] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <div
      style={searchWrapStyle}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <form onSubmit={handleSubmit} style={searchFormStyle}>
        <input
          type="search"
          placeholder="Search address or place"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={searchInputStyle}
        />
        <button type="submit" style={searchButtonStyle}>
          Search
        </button>
      </form>
      {message ? <p style={messageStyle}>{message}</p> : null}
    </div>
  );
}

const searchWrapStyle: CSSProperties = {
  position: "absolute",
  top: "1rem",
  left: "1rem",
  zIndex: 1000,
  width: "min(430px, calc(100% - 6rem))",
};

const searchFormStyle: CSSProperties = {
  display: "flex",
  minHeight: "48px",
  overflow: "hidden",
  border: "1px solid rgba(255, 255, 255, 0.72)",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
};

const searchInputStyle: CSSProperties = {
  minWidth: 0,
  flex: "1 1 auto",
  border: 0,
  background: "transparent",
  color: "#111711",
  padding: "0 0.9rem",
  fontSize: "1rem",
  outline: "none",
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

const messageStyle: CSSProperties = {
  display: "inline-flex",
  margin: "0.5rem 0 0",
  padding: "0.45rem 0.65rem",
  border: "1px solid rgba(255, 255, 255, 0.62)",
  borderRadius: "8px",
  background: "rgba(17, 23, 17, 0.9)",
  color: "#f1f5ef",
  fontSize: "0.88rem",
  fontWeight: 700,
  lineHeight: 1.35,
};
