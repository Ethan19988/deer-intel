"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

// Routes that must stay reachable without a session, or the login redirect
// would loop on itself.
const PUBLIC_PATHS = new Set(["/login"]);

// Requires a signed-in account before showing the app — but only when cloud
// sync is actually configured. With no Supabase env vars the app stays fully
// local-only and open, exactly as before.
export default function AuthGate({ children }: { children: ReactNode }) {
  const { configured, authRequired, status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (!configured) return;
    if (status === "signed-out" && !isPublicPath) {
      router.replace("/login");
    }
  }, [configured, status, isPublicPath, router]);

  // Fail closed: a deployment that requires accounts must never fall back to the
  // open local-only mode. If Supabase isn't configured we can't offer sign-in,
  // so we block the app with a clear notice instead of silently exposing
  // everything — this is what stops a shared link from dropping someone in.
  if (authRequired && !configured) {
    return (
      <div style={splashStyle}>
        <p style={splashTextStyle}>🦌 Deer Intel</p>
        <p style={splashMutedStyle}>
          Sign-in is required, but accounts aren&apos;t finished setting up on
          this deployment. Please try again later.
        </p>
      </div>
    );
  }

  // Local-only mode (no cloud configured and auth not required): no gate at all.
  if (!configured) return <>{children}</>;

  // The login page itself is always allowed to render.
  if (isPublicPath) return <>{children}</>;

  // Still resolving the session, or signed out and about to be redirected:
  // show a lightweight splash instead of flashing the app.
  if (status !== "signed-in") {
    return (
      <div style={splashStyle}>
        <p style={splashTextStyle}>🦌 Deer Intel</p>
        <p style={splashMutedStyle}>
          {status === "loading" ? "Loading…" : "Redirecting to sign in…"}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

const splashStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  padding: "2rem",
  background: "var(--bg)",
  color: "var(--text)",
};

const splashTextStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.4rem",
  fontWeight: 850,
};

const splashMutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
};
