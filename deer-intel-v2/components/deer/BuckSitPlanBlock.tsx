import type { CSSProperties } from "react";
import Badge from "@/components/ui/Badge";
import type { BuckSitConfidence, BuckSitPlan } from "@/lib/buckSitPlan";

// "Best sits for <name>": the buck card's when-and-where call over the next
// three forecast days, from lib/buckSitPlan. Each pick shows its why in one or
// two lines, and what works against it — a best bet, never a promise.

const CONFIDENCE_LABEL: Record<BuckSitConfidence, string> = {
  high: "Strong",
  medium: "Fair",
  low: "Long shot",
};

const CONFIDENCE_VARIANT: Record<BuckSitConfidence, "success" | "default" | "warning"> = {
  high: "success",
  medium: "default",
  low: "warning",
};

export default function BuckSitPlanBlock({
  name,
  plan,
}: {
  name: string;
  plan: BuckSitPlan;
}) {
  return (
    <section style={groupStyle} aria-label={`Best sits for ${name}`}>
      <div style={headingStyle}>
        <p style={labelStyle}>Best sits for {name}</p>
        <p style={hintStyle}>Next 3 days · forecast wind</p>
      </div>

      {plan.status !== "ready" ? (
        <div style={gapStyle}>
          <p style={gapTitleStyle}>{plan.title}</p>
          <p style={gapTextStyle}>{plan.message}</p>
        </div>
      ) : (
        <>
          <ol style={listStyle}>
            {plan.picks.map((pick, index) => (
              <li key={pick.key} style={{ ...pickStyle, ...(index === 0 ? firstPickStyle : null) }}>
                <div style={pickHeadStyle}>
                  <span style={sitStyle}>{pick.sitLabel}</span>
                  <span style={standStyle}>{pick.standName}</span>
                  <span style={badgesStyle}>
                    {index === 0 ? <Badge style={bestBetStyle}>Best bet</Badge> : null}
                    <Badge
                      variant={CONFIDENCE_VARIANT[pick.confidence]}
                      title={`Confidence: ${pick.confidence}`}
                    >
                      {CONFIDENCE_LABEL[pick.confidence]}
                    </Badge>
                  </span>
                </div>
                <p style={reasonStyle}>{pick.reasons.slice(0, 3).join(" · ")}</p>
                {pick.cautions.length > 0 ? (
                  <p style={cautionStyle}>{pick.cautions.slice(0, 2).join(" · ")}</p>
                ) : null}
              </li>
            ))}
          </ol>
          <p style={footnoteStyle}>
            Best bets from his trusted photo times, the cameras he&apos;s been on lately,
            the forecast wind and your stand notes — not a guarantee.
          </p>
        </>
      )}
    </section>
  );
}

const groupStyle: CSSProperties = {
  marginTop: "1.25rem",
  paddingTop: "1.25rem",
  borderTop: "1px solid var(--border)",
};

const headingStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.5rem 1rem",
  flexWrap: "wrap",
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-faint)",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const hintStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.82rem",
  fontWeight: 600,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
  margin: "0.85rem 0 0",
  padding: 0,
  listStyle: "none",
};

const pickStyle: CSSProperties = {
  display: "grid",
  gap: "0.3rem",
  padding: "0.7rem 0.8rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  minWidth: 0,
};

const firstPickStyle: CSSProperties = {
  borderLeft: "3px solid var(--accent-2)",
};

const pickHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.35rem 0.6rem",
  flexWrap: "wrap",
};

const sitStyle: CSSProperties = {
  flex: "none",
  color: "var(--text)",
  fontFamily: "var(--font-display), sans-serif",
  fontSize: "1.3rem",
  letterSpacing: "0.03em",
  lineHeight: 1,
  textTransform: "uppercase",
};

const standStyle: CSSProperties = {
  flex: "1 1 8rem",
  minWidth: 0,
  color: "var(--text)",
  fontSize: "0.95rem",
  fontWeight: 600,
  overflowWrap: "anywhere",
};

const badgesStyle: CSSProperties = {
  display: "flex",
  gap: "0.3rem",
  flexWrap: "wrap",
};

const bestBetStyle: CSSProperties = {
  border: "1px solid var(--accent-2)",
  background: "var(--accent-2-tint)",
  color: "var(--accent-2-text)",
};

// One or two lines each: clamp so a long reason list can't run on.
const clampTwoLines: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
};

const reasonStyle: CSSProperties = {
  ...clampTwoLines,
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.86rem",
  lineHeight: 1.45,
};

const cautionStyle: CSSProperties = {
  ...clampTwoLines,
  margin: 0,
  color: "var(--warning-text)",
  fontSize: "0.82rem",
  lineHeight: 1.45,
};

const footnoteStyle: CSSProperties = {
  margin: "0.6rem 0 0",
  color: "var(--text-faint)",
  fontSize: "0.78rem",
  lineHeight: 1.45,
};

const gapStyle: CSSProperties = {
  marginTop: "0.85rem",
  padding: "0.75rem 0.85rem",
  border: "1px dashed var(--border-strong)",
  borderRadius: "var(--radius-sm)",
};

const gapTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontFamily: "var(--font-display), sans-serif",
  fontSize: "1.1rem",
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const gapTextStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "var(--text-muted)",
  fontSize: "0.88rem",
  lineHeight: 1.5,
};
