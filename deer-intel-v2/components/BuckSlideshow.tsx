"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import PhotoImage from "@/components/photos/PhotoImage";
import { DeerIcon } from "@/components/ui/FieldIcons";
import type { HitListSlide } from "@/lib/hitListSlides";

const ADVANCE_MS = 5000;

// "Evening" -> "in the evening", "Midday" -> "at midday".
function movesPhrase(label: string): string {
  const lower = label.toLowerCase();
  return lower === "midday" || lower === "night" ? `at ${lower}` : `in the ${lower}`;
}

// After a swipe or tap, give the hunter time to look before moving on.
const PAUSE_AFTER_TOUCH_MS = 12000;

// The hit list as a rotating slideshow: one buck per slide, his newest photo
// full-width with what matters for hunting him. Swipe to browse; it advances
// on its own unless the device asks for reduced motion.
export default function BuckSlideshow({
  slides,
  allHref = "/hit-list",
}: {
  slides: HitListSlide[];
  allHref?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0);
  const [index, setIndex] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count < 2) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const timer = setInterval(() => {
      const track = trackRef.current;
      if (!track || document.hidden || Date.now() < pausedUntil.current) return;
      const current = Math.round(track.scrollLeft / track.clientWidth);
      const next = (current + 1) % count;
      track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    }, ADVANCE_MS);

    return () => clearInterval(timer);
  }, [count]);

  if (count === 0) return null;

  function pause() {
    pausedUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS;
  }

  function goTo(target: number) {
    pause();
    const track = trackRef.current;
    if (track) track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
  }

  return (
    <section style={sectionStyle} aria-roledescription="carousel" aria-label="Hit list">
      <div style={headerStyle}>
        <h2 style={titleStyle}>Hit list</h2>
        <Link href={allHref} style={allLinkStyle}>
          {count} {count === 1 ? "buck" : "bucks"}
        </Link>
      </div>

      <div
        ref={trackRef}
        style={trackStyle}
        onPointerDown={pause}
        onTouchStart={pause}
        onScroll={(event) => {
          const track = event.currentTarget;
          setIndex(Math.round(track.scrollLeft / Math.max(track.clientWidth, 1)));
        }}
      >
        {slides.map((slide, slideIndex) => (
          <Link
            key={slide.key}
            href={slide.href}
            style={slideStyle}
            aria-roledescription="slide"
            aria-label={`${slideIndex + 1} of ${count}: ${slide.name}`}
          >
            {slide.imageId ? (
              <PhotoImage imageId={slide.imageId} alt={slide.name} style={photoStyle} />
            ) : (
              <span style={noPhotoStyle} aria-hidden="true">
                <DeerIcon size={56} />
              </span>
            )}
            <span style={scrimStyle} aria-hidden="true" />

            <span style={captionStyle}>
              {slide.age ? <span style={ageStyle}>{slide.age} yrs</span> : null}
              <span style={nameStyle}>{slide.name}</span>
              <span style={factsStyle}>
                {slide.lastSeen ? <span>Last seen {slide.lastSeen}</span> : <span>No photos yet</span>}
                {slide.usualTime ? <span>Usually moves {movesPhrase(slide.usualTime)}</span> : null}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {count > 1 ? (
        <div style={dotsStyle} role="tablist" aria-label="Choose a buck">
          {slides.map((slide, dotIndex) => (
            <button
              key={slide.key}
              type="button"
              role="tab"
              aria-selected={dotIndex === index}
              aria-label={`Show ${slide.name}`}
              onClick={() => goTo(dotIndex)}
              style={dotButtonStyle}
            >
              <span
                style={{
                  ...dotStyle,
                  ...(dotIndex === index ? dotActiveStyle : null),
                }}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "1rem",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "1.35rem",
  fontWeight: 800,
};

const allLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "44px",
  color: "var(--accent-text)",
  fontWeight: 700,
  textDecoration: "none",
};

const trackStyle: CSSProperties = {
  display: "flex",
  overflowX: "auto",
  scrollSnapType: "x mandatory",
  borderRadius: "var(--radius)",
  scrollbarWidth: "none",
  WebkitOverflowScrolling: "touch",
  boxShadow: "0 16px 36px -22px rgba(10, 16, 10, 0.7)",
};

const slideStyle: CSSProperties = {
  position: "relative",
  flex: "0 0 100%",
  aspectRatio: "4 / 3",
  scrollSnapAlign: "start",
  overflow: "hidden",
  background: "#141b16",
  color: "#f6f0dc",
  textDecoration: "none",
};

const photoStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  height: "100%",
  border: "none",
  borderRadius: 0,
  background: "#141b16",
};

const noPhotoStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  color: "rgba(246, 240, 220, 0.25)",
  background: "linear-gradient(160deg, #233025 0%, #141b16 100%)",
};

const scrimStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(180deg, rgba(10, 14, 10, 0) 35%, rgba(10, 14, 10, 0.55) 62%, rgba(10, 14, 10, 0.92) 100%)",
};

const captionStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  display: "grid",
  gap: "0.2rem",
  padding: "1rem 1.1rem 1.05rem",
};

const ageStyle: CSSProperties = {
  justifySelf: "start",
  padding: "0.15rem 0.5rem",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-2)",
  color: "#fff",
  fontSize: "0.75rem",
  fontWeight: 800,
};

const nameStyle: CSSProperties = {
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "clamp(1.8rem, 8vw, 2.4rem)",
  fontWeight: 800,
  lineHeight: 1.02,
  letterSpacing: "-0.01em",
  textShadow: "0 2px 18px rgba(0, 0, 0, 0.5)",
};

const factsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.15rem 0.9rem",
  color: "rgba(246, 240, 220, 0.86)",
  fontSize: "0.88rem",
  fontWeight: 600,
};

const dotsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: "-0.4rem",
};

const dotButtonStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: "28px",
  minHeight: "44px",
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
};

const dotStyle: CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  background: "var(--border-strong)",
  transition: "width 200ms ease, background 200ms ease",
};

const dotActiveStyle: CSSProperties = {
  width: "22px",
  background: "var(--accent-2)",
};
