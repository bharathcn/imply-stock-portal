import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        imply: {
          green: "#17261f",
          leaf: "#244234",
          gold: "#c8a96b",
          amber: "#d99a32",
          paper: "#f4f2ea",
          ink: "#17211c"
        }
      },
      boxShadow: {
        soft: "0 16px 42px rgba(23, 38, 31, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
