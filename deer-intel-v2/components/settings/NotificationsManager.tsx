"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import {
  getNotificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  sendTestNotification,
  setNotificationPref,
  useNotificationPrefs,
  type NotificationPermissionState,
} from "@/lib/notifications";

// Manage local hunting-condition notifications: permission + which alerts to
// get. Delivery happens on the dashboard (HuntConditionAlerts) while the app is
// open, so this is honest about being "when you open Deer Intel" alerts.
export default function NotificationsManager() {
  const prefs = useNotificationPrefs();
  // Resolved after mount so server and first client render agree.
  const [permission, setPermission] =
    useState<NotificationPermissionState>("default");
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    setPermission(getNotificationPermission());

    // The user may flip the OS/browser permission while away; re-read on focus.
    function refresh() {
      setPermission(getNotificationPermission());
    }
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  async function handleEnable() {
    setBusy(true);
    setTestResult(null);
    try {
      setPermission(await requestNotificationPermission());
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setTestResult(null);
    const ok = await sendTestNotification();
    setTestResult(
      ok
        ? "Sent — check your notifications."
        : "Couldn't show a notification. Make sure they're allowed for this site.",
    );
  }

  if (permission === "unsupported" || !notificationsSupported()) {
    return (
      <p style={mutedStyle}>
        This browser doesn&apos;t support notifications. Install Deer Intel as an
        app (Add to Home Screen) on a supported browser to get field alerts.
      </p>
    );
  }

  const granted = permission === "granted";

  return (
    <div style={wrapStyle}>
      <p style={mutedStyle}>
        Get a heads-up when conditions line up on your active property — a
        falling barometer (deer movement) or a stand that matches today&apos;s
        wind. These are checked <strong>when you open Deer Intel</strong>;
        always-on background alerts aren&apos;t available yet. Saved on this
        device only.
      </p>

      <div style={statusRowStyle}>
        <div>
          <p style={statusLabelStyle}>Notifications</p>
          <p style={statusValueStyle}>
            {granted
              ? "Allowed"
              : permission === "denied"
                ? "Blocked in your browser"
                : "Not enabled yet"}
          </p>
        </div>
        {granted ? (
          <Button type="button" variant="secondary" onClick={handleTest}>
            Send Test
          </Button>
        ) : permission === "denied" ? null : (
          <Button
            type="button"
            variant="primary"
            onClick={handleEnable}
            disabled={busy}
          >
            {busy ? "Enabling…" : "Enable Notifications"}
          </Button>
        )}
      </div>

      {permission === "denied" ? (
        <p style={mutedStyle}>
          Notifications are blocked for this site. Turn them back on in your
          browser&apos;s site settings, then reload.
        </p>
      ) : null}

      {testResult ? <p style={testResultStyle}>{testResult}</p> : null}

      <div style={{ ...togglesStyle, opacity: granted ? 1 : 0.55 }}>
        <AlertToggle
          label="Cold front alerts"
          description="When the barometer is falling on your active property."
          value={prefs.coldFront}
          disabled={!granted}
          onChange={(value) => setNotificationPref("coldFront", value)}
        />
        <AlertToggle
          label="Good-wind alerts"
          description="When today's wind favors one of your saved stands."
          value={prefs.goodWind}
          disabled={!granted}
          onChange={(value) => setNotificationPref("goodWind", value)}
        />
      </div>
    </div>
  );
}

function AlertToggle({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div style={toggleRowStyle}>
      <div style={{ minWidth: 0 }}>
        <p style={toggleLabelStyle}>{label}</p>
        <p style={toggleDescStyle}>{description}</p>
      </div>
      <div style={segmentGroupStyle}>
        {[
          { on: true, text: "On" },
          { on: false, text: "Off" },
        ].map((option) => {
          const active = option.on === value;

          return (
            <button
              key={option.text}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(option.on)}
              style={{
                ...segmentStyle,
                ...(active ? segmentActiveStyle : null),
                ...(disabled ? disabledSegmentStyle : null),
              }}
            >
              {option.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.55,
};

const statusRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "0.75rem",
};

const statusLabelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.72rem",
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const statusValueStyle: CSSProperties = {
  margin: "0.15rem 0 0",
  fontSize: "1.05rem",
  fontWeight: 850,
};

const testResultStyle: CSSProperties = {
  margin: 0,
  color: "var(--accent-text)",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const togglesStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
};

const toggleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "0.65rem 0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--surface)",
};

const toggleLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.92rem",
  fontWeight: 800,
};

const toggleDescStyle: CSSProperties = {
  margin: "0.15rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.8rem",
  lineHeight: 1.4,
};

const segmentGroupStyle: CSSProperties = {
  display: "inline-flex",
  flex: "0 0 auto",
  padding: "0.2rem",
  gap: "0.2rem",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--surface-2)",
};

const segmentStyle: CSSProperties = {
  minHeight: "36px",
  minWidth: "48px",
  padding: "0.35rem 0.7rem",
  border: "1px solid transparent",
  borderRadius: "8px",
  background: "transparent",
  color: "var(--text-muted)",
  fontWeight: 800,
  cursor: "pointer",
};

const segmentActiveStyle: CSSProperties = {
  border: "1px solid var(--accent)",
  background: "var(--accent-tint)",
  color: "var(--accent-text)",
};

const disabledSegmentStyle: CSSProperties = {
  cursor: "not-allowed",
};
