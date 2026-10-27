"use client";

import { useState, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import { AlertIcon } from "@/components/ui/FieldIcons";
import {
  useAuth,
  type AccountSwitchChoice,
} from "@/components/auth/AuthProvider";

// Shown when a DIFFERENT account signs in on a device that still holds the
// previous account's data. Cloud sync stays paused — nothing is uploaded or
// replaced — until the hunter picks which data this device should keep.
// Mounted once in the layout so it appears right after sign-in on any page.
export default function AccountSwitchPrompt() {
  const { user, accountSwitch, resolveAccountSwitch } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user || !accountSwitch) return null;

  const accountName = user.email ?? "this account";

  async function choose(choice: AccountSwitchChoice) {
    setBusy(true);
    try {
      await resolveAccountSwitch(choice);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="alertdialog" aria-labelledby="account-switch-title" style={bannerStyle}>
      <div style={headerStyle}>
        <span style={iconStyle} aria-hidden="true">
          <AlertIcon size={20} />
        </span>
        <p id="account-switch-title" style={titleStyle}>
          This device has another account&apos;s data
        </p>
      </div>
      <p style={textStyle}>
        You signed in as <strong>{accountName}</strong>, but the data on this
        device belongs to a different account. Nothing will sync until you
        choose.
        {accountSwitch.unsyncedEdits
          ? " The other account has changes that never reached its cloud — loading this account's data will lose them."
          : ""}
      </p>
      <div style={actionsStyle}>
        <Button
          type="button"
          variant="primary"
          disabled={busy}
          onClick={() => void choose("load-account")}
        >
          Load {accountName}&apos;s data
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => void choose("move-device-data")}
        >
          Move this device&apos;s data into this account
        </Button>
      </div>
      <p style={hintStyle}>
        Load:{" "}
        {accountSwitch.remoteHasData
          ? "replaces what's on this device with this account's cloud data."
          : "this account has no cloud data yet, so this device starts empty."}{" "}
        This device&apos;s current data stays in the other account&apos;s cloud.
        Move: uploads this device&apos;s data to {accountName}
        {accountSwitch.remoteHasData
          ? ", replacing what's in its cloud."
          : "."}
      </p>
    </div>
  );
}

const bannerStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: "1rem",
  transform: "translateX(-50%)",
  zIndex: 2001,
  width: "min(680px, calc(100% - 1.5rem))",
  display: "grid",
  gap: "0.6rem",
  padding: "0.9rem 1rem",
  border: "1px solid var(--warning-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text)",
  boxShadow: "0 18px 40px -20px rgba(0, 0, 0, 0.5)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
};

const iconStyle: CSSProperties = {
  display: "inline-flex",
  flex: "none",
  color: "var(--warning-text)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontSize: "1.15rem",
  letterSpacing: "0.02em",
  color: "var(--warning-text)",
};

const textStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.9rem",
  lineHeight: 1.45,
  color: "var(--text)",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.6rem",
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.8rem",
  lineHeight: 1.4,
  color: "var(--text-muted)",
};
