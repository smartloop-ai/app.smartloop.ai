/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    trailingSlash: true,
    images: {
        unoptimized: true
    },
    env: {
        allow_hash_login: process.env.ALLOW_HASH_LOGIN === 'true'? "1": "0",
        base_url: process.env.SLP_BASE_URL,
        gpushed_url: process.env.GPUSHED_URL
    }
};

export default nextConfig;
