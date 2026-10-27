import type { NextConfig } from "next";

// The app moved to the shorter deer-intel.vercel.app. Anyone who opens the
// old auto-generated address (bookmarks, home-screen icons) is sent to the
// same page on the new one. Preview deployments use other hostnames and are
// unaffected.
const OLD_HOST = "deer-intel-fghk.vercel.app";
const NEW_ORIGIN = "https://deer-intel.vercel.app";

// Baseline security headers for every page. Deliberately no script/connect
// allowlist: the map talks to dozens of county and imagery servers, and a
// strict policy would silently break layers. These only stop other sites from
// framing the app (clickjacking), MIME sniffing, and leaking full URLs.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: OLD_HOST }],
        destination: `${NEW_ORIGIN}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
