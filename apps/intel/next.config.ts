import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@pulse/shared-types'],
};

export default nextConfig;
