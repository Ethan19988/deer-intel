import type { NextConfig } from "next";

// The app moved to the shorter deer-intel.vercel.app. Anyone who opens the
// old auto-generated address (bookmarks, home-screen icons) is sent to the
// same page on the new one. Preview deployments use other hostnames and are
// unaffected.
const OLD_HOST = "deer-intel-fghk.vercel.app";
const NEW_ORIGIN = "https://deer-intel.vercel.app";

const nextConfig: NextConfig = {
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
