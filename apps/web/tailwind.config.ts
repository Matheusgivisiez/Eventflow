import type { Config } from "tailwindcss";
import { eventflowPreset } from "@eventflow/config/tailwind";

const config: Config = {
  presets: [eventflowPreset],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  plugins: [require("tailwindcss-animate")]
};

export default config;
