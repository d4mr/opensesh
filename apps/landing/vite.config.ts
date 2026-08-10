import { defineConfig } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";

const config = defineConfig({
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  plugins: [viteReact(), tailwindcss()],
});

export default config;
