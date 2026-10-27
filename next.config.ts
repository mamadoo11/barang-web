import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "export",
  basePath: "/barang-web",
  images: { unoptimized: true },
};

export default nextConfig;
