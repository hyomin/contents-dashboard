import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // n8n UI 전체를 /n8n/* 경로로 프록시 (X-Frame-Options SAMEORIGIN 우회)
      {
        source: '/n8n',
        destination: 'http://localhost:5678/',
      },
      {
        source: '/n8n/:path*',
        destination: 'http://localhost:5678/:path*',
      },
    ]
  },
};

export default nextConfig;
