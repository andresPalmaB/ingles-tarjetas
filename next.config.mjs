// next.config.mjs (ESM)
import nextPWA from 'next-pwa';

const withPWA = nextPWA({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development', // SW solo en prod
    register: true,
    skipWaiting: true,
    // opcional: si quieres afinar caching, aquí puedes pasar runtimeCaching
});

export default withPWA({
    reactStrictMode: true,
    output: 'export',
    images: {
        unoptimized: true,
    },
});