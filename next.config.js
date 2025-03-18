/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack(config) {
    // Enable WebGL support
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      use: ["raw-loader", "glslify-loader"],
    });
    return config;
  },
  // Add environment variables to disable dev features
  env: {
    NEXT_DISABLE_DEV_INDICATORS: 'true',
    NEXT_DISABLE_DEV_OVERLAY: 'true',
  },
};

module.exports = nextConfig; 