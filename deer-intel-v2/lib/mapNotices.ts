// Map status lines come from several layers, and each used to say its own
// "zoom in" sentence — three in a row saying the same thing. This folds the
// zoom hints into one short line and passes any other status through.
export function summarizeMapNotices(messages: Array<string | null | undefined>): string[] {
  const present = messages.filter((message): message is string => Boolean(message?.trim()));
  const isZoomHint = (message: string) => /^zoom in/i.test(message.trim());
  const zoomHints = present.filter(isZoomHint);
  const others = present.filter((message) => !isZoomHint(message));
  if (zoomHints.length === 0) return others;

  const lines = zoomHints.some((message) => /property lines/i.test(message));
  const trails = zoomHints.some((message) => /trail/i.test(message));
  const ownerTip = zoomHints.find((message) => /further for owner names/i.test(message));

  let summary: string;
  if (lines) summary = trails ? "Zoom in to see property lines and trails." : "Zoom in to see property lines.";
  else if (ownerTip) summary = trails ? "Zoom in for owner names and trails." : ownerTip;
  else summary = trails ? "Zoom in to see trails." : zoomHints[0];

  return [summary, ...others];
}
