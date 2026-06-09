import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101828",
        cloud: "#f8fafc",
        accent: "#5b5bd6"
      }
    }
  },
  plugins: []
};

export default config;
