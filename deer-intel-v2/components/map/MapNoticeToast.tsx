"use client";

import { useEffect, useState, type CSSProperties } from "react";

// Map status lines ("Zoom in to see property lines…", "Finding trails…") show
// briefly when they change, then get out of the way. A new message brings the
// toast back; the same message staying put doesn't.
const VISIBLE_MS = 4000;

export default function MapNoticeToast({
  message,
  style,
}: {
  message: string;
  style?: CSSProperties;
}) {
  const [shown, setShown] = useState<string>("");

  useEffect(() => {
    if (!message) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown("");
      return;
    }
    setShown(message);
    const timer = window.setTimeout(() => setShown(""), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!shown) return null;

  return (
    <div
      className="di-map-notice"
      role="status"
      style={{ ...style, ...toastStyle }}
      onClick={() => setShown("")}
    >
      {shown}
    </div>
  );
}

const toastStyle: CSSProperties = {
  cursor: "pointer",
  animation: "di-map-toast-in 180ms ease-out",
};
