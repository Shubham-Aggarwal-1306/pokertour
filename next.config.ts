import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LangChain packages are Node-only; keep them out of the client bundle.
  serverExternalPackages: ["@langchain/core", "@langchain/anthropic", "langchain", "@langchain/langgraph"],
};

export default nextConfig;
