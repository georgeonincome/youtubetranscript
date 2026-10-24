/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow i18n for lang param
  async rewrites() {
    return [
      {
        source: '/tools/run/youtube_transcript',
        destination: '/tools/run/youtube_transcript',
      },
    ];
  },
};

module.exports = nextConfig;
