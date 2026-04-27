/** @type {import('next').NextConfig} */
  const nextConfig = {
    reactStrictMode: true,
    transpilePackages: [
      "@mezo-org/passport",
      "@mezo-org/orangekit",
      "@mezo-org/orangekit-contracts",
      "@mezo-org/orangekit-smart-account",
      "@mezo-org/mezo-clay",
      "@mezo-org/mezod-contracts",
      "@mezo-org/musd-contracts",
      "@mezo-org/sign-in-with-wallet",
      "@mezo-org/sign-in-with-wallet-parser"
    ],
    typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
   
    webpack: (config) => {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@react-native-async-storage/async-storage": false,
      };
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
      };
      config.externals.push("pino-pretty", "lokijs", "encoding");
      return config;
    },
};

module.exports = nextConfig;
