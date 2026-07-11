"use client";

import { useEffect } from "react";
import { applyTheme, useThemePreference } from "@/lib/theme";

// Keeps the <html data-theme> attribute in sync with the stored preference
// after hydration. The initial value is set by the inline script in the root
// layout so there is no flash of the wrong theme on first paint.
export default function ThemeManager() {
  const preference = useThemePreference();

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  return null;
}
