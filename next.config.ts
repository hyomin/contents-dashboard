import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/n8n/', destination: '/n8n', permanent: false },
    ]
  },
  async rewrites() {
    return [
      // n8n 편집기: http://localhost:3000/n8n (슬래시 없음). Webhook은 n8n 직접 :5678/webhook/...
      { source: '/n8n', destination: 'http://localhost:5678/' },
      { source: '/n8n/:path*', destination: 'http://localhost:5678/:path*' },
    ]
  },
};

export default nextConfig;
