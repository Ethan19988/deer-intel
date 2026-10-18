"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";
import type { DeerProfile } from "@/types/deerProfile";

type DeerProfileMultiSelectProps = {
  deerProfiles: DeerProfile[];
  // Ids of the linked deer profiles.
  selectedProfileIds: string[];
  // Free-typed buck names that don't have a saved profile.
  buckNames: string[];
  onChange: (selectedProfileIds: string[], buckNames: string[]) => void;
  // Unique per instance so the add-name input's label stays associated.
  idPrefix?: string;
};

// Lets a hunter tag one photo with several bucks: toggle any saved deer
// profiles that appear in the frame, and add loose names for bucks without a
// profile yet. Controlled — the parent owns both lists.
export default function DeerProfileMultiSelect({
  deerProfiles,
  selectedProfileIds,
  buckNames,
  onChange,
  idPrefix = "buck",
}: DeerProfileMultiSelectProps) {
  const [pendingName, setPendingName] = useState("");

  function toggleProfile(profileId: string) {
    const next = selectedProfileIds.includes(profileId)
      ? selectedProfileIds.filter((id) => id !== profileId)
      : [...selectedProfileIds, profileId];

    onChange(next, buckNames);
  }

  function addPendingName() {
    const name = pendingName.trim();

    if (!name) return;

    // Ignore a duplicate (case-insensitive) or a name that already matches a
    // selected profile — the profile chip covers it.
    const alreadyListed = buckNames.some(
      (existing) => existing.toLowerCase() === name.toLowerCase(),
    );
    const matchesProfile = deerProfiles.some(
      (profile) =>
        selectedProfileIds.includes(profile.id) &&
        profile.nickname.trim().toLowerCase() === name.toLowerCase(),
    );

    if (!alreadyListed && !matchesProfile) {
      onChange(selectedProfileIds, [...buckNames, name]);
    }

    setPendingName("");
  }

  function removeName(name: string) {
    onChange(
      selectedProfileIds,
      buckNames.filter((existing) => existing !== name),
    );
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addPendingName();
    }
  }

  return (
    <div style={wrapStyle}>
      <div style={groupStyle}>
        <span style={labelStyle}>Deer Profiles (tap all that appear)</span>
        {deerProfiles.length === 0 ? (
          <p style={hintStyle}>
            No deer profiles for this property yet. Add buck names below or
            create profiles first.
          </p>
        ) : (
          <div style={chipRowStyle}>
            {deerProfiles.map((profile) => {
              const selected = selectedProfileIds.includes(profile.id);

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => toggleProfile(profile.id)}
                  aria-pressed={selected}
                  style={selected ? selectedChipStyle : chipStyle}
                >
                  <span aria-hidden="true" style={chipMarkStyle}>
                    {selected ? "✓" : "+"}
                  </span>
                  {profile.nickname}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={groupStyle}>
        <span style={labelStyle}>Other buck names (no profile)</span>
        <div style={addRowStyle}>
          <input
            id={`${idPrefix}-add-name`}
            aria-label="Add a buck name"
            placeholder="Add a name and press Enter"
            value={pendingName}
            onChange={(event) => setPendingName(event.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={addPendingName}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={addPendingName}
            disabled={!pendingName.trim()}
            style={addButtonStyle}
          >
            Add
          </button>
        </div>
        {buckNames.length > 0 ? (
          <div style={chipRowStyle}>
            {buckNames.map((name) => (
              <span key={name} style={nameChipStyle}>
                {name}
                <button
                  type="button"
                  onClick={() => removeName(name)}
                  aria-label={`Remove ${name}`}
                  style={removeButtonStyle}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const groupStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
};

const labelStyle: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.9rem",
  lineHeight: 1.5,
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
};

const chipBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  minHeight: "40px",
  padding: "0.45rem 0.8rem",
  borderRadius: "999px",
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "0.9rem",
  fontWeight: 700,
  cursor: "pointer",
};

const chipStyle: CSSProperties = chipBaseStyle;

const selectedChipStyle: CSSProperties = {
  ...chipBaseStyle,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "white",
};

const chipMarkStyle: CSSProperties = {
  fontWeight: 800,
};

const addRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const inputStyle: CSSProperties = {
  flex: "1 1 180px",
  minHeight: "46px",
  padding: "0.8rem",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "1rem",
  lineHeight: 1.4,
};

const addButtonStyle: CSSProperties = {
  minHeight: "46px",
  padding: "0.45rem 1rem",
  borderRadius: "8px",
  border: "1px solid var(--accent)",
  background: "transparent",
  color: "var(--accent)",
  fontSize: "0.9rem",
  fontWeight: 800,
  cursor: "pointer",
};

const nameChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  minHeight: "40px",
  padding: "0.4rem 0.4rem 0.4rem 0.8rem",
  borderRadius: "999px",
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: "0.9rem",
  fontWeight: 700,
};

const removeButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.6rem",
  height: "1.6rem",
  borderRadius: "999px",
  border: "none",
  background: "transparent",
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  cursor: "pointer",
};
