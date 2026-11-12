import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const nextConfig = (phase) => ({
  // Development needs access to shared assets; OpenNext builds retain the app root.
  ...(phase === PHASE_DEVELOPMENT_SERVER && {
    turbopack: { root: fileURLToPath(new URL("../../", import.meta.url)) },
  }),
});

export default nextConfig;
