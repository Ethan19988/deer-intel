import type { CSSProperties, ReactNode } from "react";
import {
  BreakdownTable,
  Td,
  Th,
  insightHeadingStyle,
  insightLabelStyle,
  tableStyle,
} from "@/components/insights/StatPrimitives";
import type { ReportAdviceTone, SeasonReport } from "@/lib/seasonReport";
import { formatHours, formatRate, MIN_SITS_TO_CALL } from "@/lib/standStats";

// One property's season on one printed page (and a readable scroll on a
// phone). Pure presentation of a SeasonReport from lib/seasonReport.

function formatDay(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateKey);
  if (!match) return dateKey;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

export default function SeasonReportView({
  report,
  propertyName,
}: {
  report: SeasonReport;
  propertyName: string;
}) {
  const { summary } = report;

  return (
    <article className="di-report-page" style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <p style={insightLabelStyle}>Season report · {report.season.label}</p>
          <h2 style={titleStyle}>{propertyName}</h2>
        </div>
        <p style={rangeStyle}>
          {formatDay(report.season.from)} – {formatDay(report.season.to)}
        </p>
      </header>

      {report.isEmpty ? (
        <p style={emptyStyle}>
          Nothing logged on this property for the {report.season.label} season — no sits, camera
          checks or deer photos.
        </p>
      ) : (
        <>
          <dl style={summaryGridStyle}>
            <Stat label="Sits" value={summary.sits} />
            <Stat label="Hours" value={summary.timedSits ? formatHours(summary.hours) : "—"} />
            <Stat label="Deer seen" value={summary.deer} />
            <Stat label="Bucks" value={summary.bucks} />
            <Stat label="Shots" value={summary.shots} />
            <Stat label="Harvests" value={summary.harvests} accent={summary.harvests > 0} />
            <Stat label="Cam checks" value={summary.cameraChecks} />
            <Stat label="Buck photos" value={summary.buckPhotos} />
          </dl>

          <div style={twoColStyle}>
            <Block title="Best stands">
              {report.bestStands.length ? (
                <ol style={rankListStyle}>
                  {report.bestStands.map((row) => (
                    <li key={row.standId} style={rankItemStyle}>
                      <span style={strongStyle}>{row.standName}</span>
                      <span style={mutedStyle}>
                        {formatRate(row.overall.deerPerSit)} deer/sit · {formatRate(row.overall.bucksPerSit)}{" "}
                        bucks/sit · {row.overall.sits} sits
                        {row.bestWind ? ` · best on ${row.bestWind.label}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p style={mutedStyle}>
                  No stand has {MIN_SITS_TO_CALL}+ sits yet — too few to rank.
                </p>
              )}
            </Block>

            <Block title="Best wind & time">
              <p style={pickStyle}>
                <span style={insightLabelStyle}>Wind</span>{" "}
                {report.bestWind ? (
                  <>
                    <span style={strongStyle}>{report.bestWind.label}</span>{" "}
                    <span style={mutedStyle}>
                      {report.bestWind.lift.toFixed(1)}× average · {report.bestWind.detail}
                    </span>
                  </>
                ) : (
                  <span style={mutedStyle}>Too few sits to call</span>
                )}
              </p>
              <p style={pickStyle}>
                <span style={insightLabelStyle}>Time</span>{" "}
                {report.bestTime ? (
                  <>
                    <span style={strongStyle}>{report.bestTime.label}</span>{" "}
                    <span style={mutedStyle}>
                      {report.bestTime.lift.toFixed(1)}× average · {report.bestTime.detail}
                    </span>
                  </>
                ) : (
                  <span style={mutedStyle}>Too few sits to call</span>
                )}
              </p>
            </Block>
          </div>

          <div style={threeColStyle}>
            <BreakdownTable title="Sits by wind" buckets={report.windRows} bestKey={report.bestWind?.key} />
            <BreakdownTable title="Sits by time" buckets={report.timeRows} bestKey={report.bestTime?.key} />
            <Block title="Rut-phase activity" bare>
              {report.phases.length ? (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <Th align="left">Phase</Th>
                      <Th>Sits</Th>
                      <Th>Deer/sit</Th>
                      <Th>Buck pics</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.phases.map((row) => (
                      <tr key={row.phase}>
                        <Td align="left">{row.label}</Td>
                        <Td>{row.sits}</Td>
                        <Td>{row.sits ? formatRate(row.deerPerSit) : "—"}</Td>
                        <Td>{row.buckPhotos}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={mutedStyle}>No dated sits or photos.</p>
              )}
            </Block>
          </div>

          <Block title="Tracked bucks — where and when">
            {report.bucks.length ? (
              <div style={scrollStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <Th align="left">Buck</Th>
                      <Th>Pics</Th>
                      <Th align="left">Seen</Th>
                      <Th align="left">Where</Th>
                      <Th align="left">When</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.bucks.slice(0, 8).map((buck) => (
                      <tr key={buck.key}>
                        <Td align="left" style={strongStyle}>
                          {buck.name}
                        </Td>
                        <Td>{buck.photos}</Td>
                        <Td align="left">
                          {buck.firstSeen === buck.lastSeen
                            ? formatDay(buck.firstSeen)
                            : `${formatDay(buck.firstSeen)} – ${formatDay(buck.lastSeen)}`}
                        </Td>
                        <Td align="left" style={wrapCellStyle}>
                          {buck.sites
                            .slice(0, 2)
                            .map((site) => `${site.name} (${site.photos})`)
                            .join(", ")}
                        </Td>
                        <Td align="left" style={wrapCellStyle}>
                          {whenLine(buck)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={mutedStyle}>
                No photos linked to a buck profile or named buck this season.
              </p>
            )}
          </Block>

          <Block title="What to change next year">
            {report.advice.length ? (
              <ul style={adviceListStyle}>
                {report.advice.map((item) => (
                  <li key={item.title} style={{ ...adviceItemStyle, ...ADVICE_TONE[item.tone] }}>
                    <span style={adviceMarkStyle}>{ADVICE_MARK[item.tone]}</span>
                    <span>
                      <span style={strongStyle}>{item.title}.</span>{" "}
                      <span style={mutedStyle}>{item.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={mutedStyle}>Nothing stands out to change — keep logging every sit.</p>
            )}
          </Block>
        </>
      )}
    </article>
  );
}

function whenLine(buck: SeasonReport["bucks"][number]): string {
  const { morning, evening, night } = buck.byPeriod;
  const total = morning + evening + night;
  const parts: string[] = [];
  if (total > 0) {
    const daylight = morning + evening;
    parts.push(
      daylight === 0
        ? "Night only"
        : `${Math.round((daylight / total) * 100)}% daylight${
            morning >= evening ? " (AM)" : " (PM)"
          }`,
    );
  }
  if (buck.peakHourLabel) parts.push(`peak ${buck.peakHourLabel}`);
  if (buck.topPhase) parts.push(buck.topPhase.toLowerCase());
  if (buck.sitMentions) parts.push(`${buck.sitMentions} sit note${buck.sitMentions === 1 ? "" : "s"}`);
  return parts.join(" · ") || "—";
}

function Stat({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div style={statStyle}>
      <dt style={insightLabelStyle}>{label}</dt>
      <dd style={{ ...statValueStyle, color: accent ? "var(--accent-2)" : "var(--text)" }}>{value}</dd>
    </div>
  );
}

function Block({ title, children, bare = false }: { title: string; children: ReactNode; bare?: boolean }) {
  return (
    <section className="di-report-block" style={bare ? bareBlockStyle : blockStyle}>
      <h3 style={blockTitleStyle}>{title}</h3>
      {children}
    </section>
  );
}

const ADVICE_MARK: Record<ReportAdviceTone, string> = {
  change: "Change",
  keep: "Do more",
  data: "Log",
};

const ADVICE_TONE: Record<ReportAdviceTone, CSSProperties> = {
  change: { borderLeftColor: "var(--accent-2)" },
  keep: { borderLeftColor: "var(--accent)" },
  data: { borderLeftColor: "var(--border-strong)" },
};

const pageStyle: CSSProperties = {
  display: "grid",
  gap: "0.9rem",
  padding: "clamp(0.9rem, 3vw, 1.4rem)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--text)",
  minWidth: 0,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
  paddingBottom: "0.6rem",
  borderBottom: "2px solid var(--accent-2)",
};

const titleStyle: CSSProperties = {
  ...insightHeadingStyle,
  margin: "0.2rem 0 0",
  fontSize: "clamp(1.8rem, 6vw, 2.4rem)",
};

const rangeStyle: CSSProperties = {
  ...insightLabelStyle,
  color: "var(--text-muted)",
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "0.4rem",
  margin: 0,
};

const statStyle: CSSProperties = {
  padding: "0.45rem 0.55rem",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-2)",
  minWidth: 0,
};

const statValueStyle: CSSProperties = {
  margin: "0.15rem 0 0",
  fontFamily: "var(--font-display), system-ui, sans-serif",
  fontSize: "clamp(1.4rem, 5vw, 1.9rem)",
  lineHeight: 1,
  letterSpacing: "0.02em",
  fontVariantNumeric: "tabular-nums",
};

const twoColStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
  gap: "0.75rem",
};

const threeColStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))",
  gap: "0.75rem",
  overflowX: "auto",
};

const blockStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  alignContent: "start",
  minWidth: 0,
};

const bareBlockStyle: CSSProperties = { ...blockStyle, gap: "0.35rem" };

const blockTitleStyle: CSSProperties = {
  ...insightLabelStyle,
  color: "var(--accent-text)",
};

const rankListStyle: CSSProperties = {
  display: "grid",
  gap: "0.35rem",
  margin: 0,
  paddingLeft: "1.2rem",
};

const rankItemStyle: CSSProperties = {
  display: "grid",
  lineHeight: 1.35,
};

const strongStyle: CSSProperties = {
  color: "var(--text)",
  fontWeight: 700,
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  fontSize: "0.86rem",
  lineHeight: 1.45,
};

const pickStyle: CSSProperties = {
  margin: 0,
  lineHeight: 1.45,
};

const scrollStyle: CSSProperties = {
  overflowX: "auto",
};

const wrapCellStyle: CSSProperties = {
  whiteSpace: "normal",
  minWidth: "8rem",
};

const adviceListStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  margin: 0,
  padding: 0,
  listStyle: "none",
};

const adviceItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "4.6rem 1fr",
  gap: "0.5rem",
  alignItems: "baseline",
  padding: "0.4rem 0.55rem",
  borderLeft: "3px solid",
  background: "var(--surface-2)",
  borderRadius: "var(--radius-sm)",
};

const adviceMarkStyle: CSSProperties = {
  ...insightLabelStyle,
  color: "var(--text-muted)",
};
