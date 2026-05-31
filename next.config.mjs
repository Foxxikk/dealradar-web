/** @type {import('next').NextConfig} */
const nextConfig = {
  // mupdf (WASM), pglite a postgres nechceme bundlovat – ať běží jako nativní moduly na serveru.
  experimental: {
    serverComponentsExternalPackages: ["mupdf", "@electric-sql/pglite", "postgres", "@vercel/blob"],
  },
  webpack: (config) => {
    // umožní importovat lokální moduly s příponou .js (zdroj je .ts)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};
export default nextConfig;
