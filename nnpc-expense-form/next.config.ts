import type { NextConfig } from "next";

const r2PublicBucketUrl = process.env.R2_PUBLIC_BUCKET_URL;
const r2ImageRemotePattern = (() => {
  if (!r2PublicBucketUrl) {
    return null;
  }

  try {
    const url = new URL(r2PublicBucketUrl);

    return {
      hostname: url.hostname,
      pathname: `${url.pathname.replace(/\/+$/, "")}/**`,
      protocol: url.protocol.replace(":", "") as "http" | "https",
    };
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: r2ImageRemotePattern ? [r2ImageRemotePattern] : [],
  },
  async redirects() {
    return [
      {
        destination: "/dashboard",
        permanent: false,
        source: "/",
      },
    ];
  },
};

export default nextConfig;
