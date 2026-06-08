/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    // Prisma generates a native engine binary that isn't reachable through
    // static analysis, so we have to add it to the standalone output
    // explicitly. Without this, `next build`'s standalone output drops
    // .prisma/client/ and the runtime crashes with
    // "Prisma client did not initialize" / "Cannot find module .prisma/client".
    '**': ['./node_modules/.prisma/**/*', './node_modules/@prisma/**/*'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

export default nextConfig;