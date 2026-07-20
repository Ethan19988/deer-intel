import * as L from "leaflet";
import { Marker } from "react-leaflet";

type CameraFacingConeProps = {
  lat: number;
  lng: number;
  /** Bearing the lens looks toward, in degrees clockwise from north. */
  degrees: number;
  color: string;
};

// The wedge spans ±22° — a typical trail-cam field of view, and about the
// resolution of a 16-wind compass point, so it honestly shows "roughly this
// way" rather than a false precise line.
const CONE_HALF_ANGLE = 22;
const CONE_RADIUS = 52;
const ICON_SIZE = 120;

/**
 * A translucent view cone drawn from a camera's pin showing which way the
 * lens points. Fixed pixel size so it stays readable at any zoom, and
 * non-interactive so taps pass through to the map and markers.
 */
export default function CameraFacingCone({
  lat,
  lng,
  degrees,
  color,
}: CameraFacingConeProps) {
  return (
    <Marker
      position={[lat, lng]}
      icon={createConeIcon(degrees, color)}
      interactive={false}
      zIndexOffset={-500}
    />
  );
}

function createConeIcon(degrees: number, color: string) {
  const center = ICON_SIZE / 2;
  const rad = (CONE_HALF_ANGLE * Math.PI) / 180;
  const leftX = center - CONE_RADIUS * Math.sin(rad);
  const rightX = center + CONE_RADIUS * Math.sin(rad);
  const tipY = center - CONE_RADIUS * Math.cos(rad);

  const html = `<svg width="${ICON_SIZE}" height="${ICON_SIZE}"
    viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" xmlns="http://www.w3.org/2000/svg"
    style="display:block;pointer-events:none;">
    <g transform="rotate(${degrees} ${center} ${center})">
      <path d="M${center} ${center} L${leftX.toFixed(1)} ${tipY.toFixed(1)}
        A${CONE_RADIUS} ${CONE_RADIUS} 0 0 1 ${rightX.toFixed(1)} ${tipY.toFixed(1)} Z"
        fill="${color}" fill-opacity="0.2"
        stroke="${color}" stroke-opacity="0.65" stroke-width="1.6"/>
    </g>
  </svg>`;

  return L.divIcon({
    className: "deer-intel-camera-cone",
    html,
    iconSize: [ICON_SIZE, ICON_SIZE],
    // Centered on the camera's exact spot; the wedge fans out from it.
    iconAnchor: [center, center],
  });
}
