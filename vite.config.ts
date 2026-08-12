import { defineConfig } from "vite-plus";

const generated = [
  "apps/web/src/routeTree.gen.ts",
  "apps/web/worker-configuration.d.ts",
  "packages/domain/migrations/**",
];

export default defineConfig({
  test: {
    include: ["apps/**/src/**/*.{test,spec}.{ts,tsx}", "packages/**/*.{test,spec}.ts"],
  },
  lint: {
    ignorePatterns: generated,
    options: {
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        files: ["apps/web/src/components/ui/chart.tsx"],
        rules: {
          "typescript/restrict-template-expressions": "off",
        },
      },
    ],
  },
  fmt: {
    ignorePatterns: generated,
  },
});
