import type { Config } from "tailwindcss";
import { eventhubPreset } from "@eventhub/config/tailwind";

const config: Config = {
  presets: [eventhubPreset],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  plugins: [require("tailwindcss-animate")]
};

export default config;
