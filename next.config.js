/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  turbopack: {
    // Turbopack's root = the workspace root (one level up from the project),
    // not the project directory itself. Setting it to the project dir caused
    // Turbopack to treat app/ as the project, breaking module resolution.
    root: '../',
  },
};

export default nextConfig;
