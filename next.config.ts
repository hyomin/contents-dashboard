import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 종목 분석 리포트 차트 렌더링용 네이티브 모듈 — 서버 번들에 포함하지 않고 node_modules에서 직접 로드
  serverExternalPackages: ['@napi-rs/canvas', 'echarts'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
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
