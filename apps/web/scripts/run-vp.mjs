import { spawn } from "node:child_process";

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined || connectionString.length === 0) {
  process.stderr.write("DATABASE_URL is required in apps/web/.dev.vars.\n");
  process.exit(1);
}

const command = process.argv[2];
if (command !== "build" && command !== "dev") {
  process.stderr.write("Expected a Vite+ command: build or dev.\n");
  process.exit(1);
}

const child = spawn(
  "pnpm",
  ["exec", "vp", command, ...(command === "dev" ? ["--port", "3000"] : [])],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: connectionString,
      WRANGLER_WRITE_LOGS: "false",
      XDG_CONFIG_HOME: ".wrangler/config",
    },
  },
);

child.on("exit", (code) => process.exit(code ?? 1));
