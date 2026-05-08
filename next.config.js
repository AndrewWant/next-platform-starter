import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  turbopack: {
    // Pin the workspace root explicitly so Turbopack doesn't auto-detect
    // the wrong directory and refuse to compile files outside app/.
    root: __dirname,
  },
};

export default nextConfig;
