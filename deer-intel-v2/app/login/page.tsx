"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type CSSProperties } from "react";
import AuthForm from "@/components/auth/AuthForm";
import { useAuth } from "@/components/auth/AuthProvider";

export default function LoginPage() {
  const { configured, status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-in") router.replace("/settings");
  }, [status, router]);

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <div style={headerStyle}>
          <p style={eyebrowStyle}>Deer Intel</p>
          <h1 style={titleStyle}>🦌 Account &amp; Cloud Sync</h1>
          <p style={subtitleStyle}>
            Sign in to back up your properties, cameras, stands, hunts, and deer
            profiles and keep them in sync across your devices.
          </p>
        </div>

        {!configured ? (
          <div style={infoCardStyle}>
            <p style={infoTitleStyle}>Cloud sync isn&apos;t set up yet</p>
            <p style={mutedStyle}>
              Deer Intel is running in local-only mode. Accounts and cloud sync
              turn on once Supabase environment variables are configured. Until
              then, your data lives safely in this browser and you can back it up
              from Settings.
            </p>
            <Link href="/settings" style={linkStyle}>
              Go to Settings
            </Link>
          </div>
        ) : status === "loading" ? (
          <div style={infoCardStyle}>
            <p style={mutedStyle}>Checking your session…</p>
          </div>
        ) : status === "signed-in" ? (
          <div style={infoCardStyle}>
            <p style={infoTitleStyle}>Signed in as {user?.email}</p>
            <Link href="/settings" style={linkStyle}>
              Go to Settings
            </Link>
          </div>
        ) : (
          <AuthForm />
        )}

        <Link href="/" style={backLinkStyle}>
          ← Back to Dashboard
        </Link>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "clamp(1rem, 5vw, 3rem)",
  background: "#050806",
  color: "white",
};

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: "440px",
  display: "grid",
  gap: "1.25rem",
};

const headerStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#85a984",
  fontSize: "0.78rem",
  fontWeight: 800,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.7rem",
  lineHeight: 1.15,
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "#b8c2b6",
  lineHeight: 1.55,
};

const infoCardStyle: CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  padding: "1.25rem",
  border: "1px solid #243224",
  borderRadius: "12px",
  background: "#0a0f0a",
};

const infoTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.1rem",
  fontWeight: 850,
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "#b8c2b6",
  lineHeight: 1.55,
};

const linkStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "44px",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.6rem 0.9rem",
  border: "1px solid #3b6843",
  borderRadius: "8px",
  background: "#18351d",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
  justifySelf: "start",
};

const backLinkStyle: CSSProperties = {
  color: "#85a984",
  fontWeight: 700,
  textDecoration: "none",
  justifySelf: "center",
};
