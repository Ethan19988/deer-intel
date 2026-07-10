"use client";

import { useState, type CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import AuthForm from "@/components/auth/AuthForm";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  formatLastSynced,
  syncStatusLabel,
  syncStatusTone,
} from "@/lib/syncStatus";

export default function AccountPanel() {
  const {
    configured,
    status,
    user,
    syncStatus,
    syncMessage,
    lastSyncedAt,
    signOut,
  } = useAuth();

  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <Card as="div" variant="subtle">
        <p style={eyebrowStyle}>Cloud Sync</p>
        <h2 style={titleStyle}>Local-only mode</h2>
        <p style={mutedStyle}>
          Deer Intel is saving everything in this browser. Accounts and cloud
          sync turn on automatically once the Supabase environment variables
          (<code style={codeStyle}>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code style={codeStyle}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>) are set
          for the app. Until then, use the backup export above to move data
          between devices.
        </p>
      </Card>
    );
  }

  if (status === "loading") {
    return (
      <Card as="div" variant="subtle">
        <p style={mutedStyle}>Checking your session…</p>
      </Card>
    );
  }

  if (status !== "signed-in") {
    return (
      <Card as="div" variant="subtle">
        <p style={eyebrowStyle}>Cloud Sync</p>
        <h2 style={titleStyle}>Sign in to sync</h2>
        <p style={mutedStyle}>
          Create an account or sign in to back up your data and keep it in sync
          across devices. You can keep using Deer Intel locally without an
          account — signing in simply adds a cloud backup.
        </p>
        <div style={{ marginTop: "1rem" }}>
          <AuthForm />
        </div>
      </Card>
    );
  }

  const tone = syncStatusTone(syncStatus);
  const lastSynced = formatLastSynced(lastSyncedAt);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="div" variant="subtle">
      <div style={headerRowStyle}>
        <div>
          <p style={eyebrowStyle}>Signed in</p>
          <h2 style={titleStyle}>{user?.email ?? "Your account"}</h2>
        </div>
        <Badge variant={tone}>{syncStatusLabel(syncStatus)}</Badge>
      </div>

      <p style={mutedStyle}>
        {syncMessage ??
          "Your data is backed up to the cloud and syncs across your devices automatically."}
      </p>

      {lastSynced ? (
        <p style={metaStyle}>Last synced: {lastSynced}</p>
      ) : null}

      <div style={actionsStyle}>
        <Button
          type="button"
          variant="danger"
          onClick={handleSignOut}
          disabled={busy}
        >
          Sign Out
        </Button>
      </div>
    </Card>
  );
}

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "1rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "0.4rem 0 0",
  fontSize: "1.3rem",
  lineHeight: 1.2,
  wordBreak: "break-word",
};

const mutedStyle: CSSProperties = {
  margin: "0.65rem 0 0",
  color: "var(--text-muted)",
  lineHeight: 1.55,
};

const metaStyle: CSSProperties = {
  margin: "0.5rem 0 0",
  color: "var(--accent-text)",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const codeStyle: CSSProperties = {
  padding: "0.1rem 0.3rem",
  borderRadius: "4px",
  background: "var(--surface)",
  fontSize: "0.85em",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
  marginTop: "1rem",
};
