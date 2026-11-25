import type { NextConfig } from "next";

const config: NextConfig = {
  // its Node worker shim uses a dynamic import that Turbopack can't bundle; load it from node_modules instead
  serverExternalPackages: ["mpg123-decoder"],
};

export default config;
