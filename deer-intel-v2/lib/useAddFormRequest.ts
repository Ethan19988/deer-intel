"use client";

import { useEffect, useState } from "react";

// The "Add camera / Add stand" form stays out of the way until it's asked for:
// the header button, a link to #<anchor> (Today's checklist, the More menu's
// Add row), or an empty list. Returns whether it's open, plus `request` for the
// header button, which also scrolls the form into view once it renders.
export function useAddFormRequest(anchor: string) {
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    const check = () => {
      if (window.location.hash === `#${anchor}`) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRequested(true);
        scrollToAnchor(anchor);
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [anchor]);

  function request() {
    setRequested(true);
    scrollToAnchor(anchor);
  }

  return { requested, request, close: () => setRequested(false) };
}

function scrollToAnchor(anchor: string) {
  window.requestAnimationFrame(() =>
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }),
  );
}
