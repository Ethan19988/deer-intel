import { BUCK_PATHS, BUCK_VIEWBOX } from "@/components/ui/buckPaths";

// The Deer Intel buck: the same head-and-rack as the app icon (public/icons/
// deer-intel-mark.svg), as a single-colour glyph that takes the text colour.
export default function BuckMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={BUCK_VIEWBOX}
      fill="currentColor"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: BUCK_PATHS }}
    />
  );
}
