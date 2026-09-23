/** @type {import('next').NextConfig} */
import componentTagger from "@acebuilder/component-tagger";

const withTagger = componentTagger();

const nextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    qualities: [50, 75],
  },
};

export default withTagger(nextConfig);
