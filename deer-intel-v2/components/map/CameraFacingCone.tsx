import * as L from "leaflet";
import { Marker } from "react-leaflet";

type CameraFacingConeProps = {
  lat: number;
  lng: number;
  /** Bearing the cone points toward, in degrees clockwise from north. */
  degrees: number;
  color: string;
  /**
   * Half-angle of the wedge in degrees. Defaults to ±22° — a typical trail-cam
   * field of view, and about the resolution of a 16-wind compass point, so it
   * honestly shows "roughly this way" rather than a false precise line. A wider
   * angle suits a scent plume, which fans out more than a lens.
   */
  halfAngle?: number;
  /** Wedge length in pixels (fixed screen size, so it reads at any zoom). */
  radius?: number;
};

const DEFAULT_CONE_HALF_ANGLE = 22;
const DEFAULT_CONE_RADIUS = 52;

/**
 * A translucent cone drawn from a pin. Used for a camera's field of view (which
 * way the lens points) and, wider and downwind, for a stand's scent plume.
 * Fixed pixel size so it stays readable at any zoom, and non-interactive so
 * taps pass through to the map and markers.
 */
export default function CameraFacingCone({
  lat,
  lng,
  degrees,
  color,
  halfAngle = DEFAULT_CONE_HALF_ANGLE,
  radius = DEFAULT_CONE_RADIUS,
}: CameraFacingConeProps) {
  return (
    <Marker
      position={[lat, lng]}
      icon={createConeIcon(degrees, color, halfAngle, radius)}
      interactive={false}
      zIndexOffset={-500}
    />
  );
}

function createConeIcon(
  degrees: number,
  color: string,
  halfAngle: number,
  radius: number,
) {
  // Size the canvas to the wedge so a longer plume isn't clipped.
  const iconSize = radius * 2 + 16;
  const center = iconSize / 2;
  const rad = (halfAngle * Math.PI) / 180;
  const leftX = center - radius * Math.sin(rad);
  const rightX = center + radius * Math.sin(rad);
  const tipY = center - radius * Math.cos(rad);

  const html = `<svg width="${iconSize}" height="${iconSize}"
    viewBox="0 0 ${iconSize} ${iconSize}" xmlns="http://www.w3.org/2000/svg"
    style="display:block;pointer-events:none;">
    <g transform="rotate(${degrees} ${center} ${center})">
      <path d="M${center} ${center} L${leftX.toFixed(1)} ${tipY.toFixed(1)}
        A${radius} ${radius} 0 0 1 ${rightX.toFixed(1)} ${tipY.toFixed(1)} Z"
        fill="${color}" fill-opacity="0.2"
        stroke="${color}" stroke-opacity="0.65" stroke-width="1.6"/>
    </g>
  </svg>`;

  return L.divIcon({
    className: "deer-intel-camera-cone",
    html,
    iconSize: [iconSize, iconSize],
    // Centered on the pin's exact spot; the wedge fans out from it.
    iconAnchor: [center, center],
  });
}
