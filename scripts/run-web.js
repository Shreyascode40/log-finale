const path = require("node:path");
const { spawn } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
try {
  process.loadEnvFile(path.join(repoRoot, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const [command, ...options] = process.argv.slice(2);
if (!command || !["dev", "build", "start"].includes(command)) {
  console.error("Usage: run-web.js <dev|build|start> [options]");
  process.exit(2);
}

const nextBin = require.resolve("next/dist/bin/next", { paths: [repoRoot] });
const next = spawn(process.execPath, [nextBin, command, "apps/web", ...options], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
});

next.on("error", (error) => {
  console.error("Could not start the frontend:", error);
  process.exitCode = 1;
});
next.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
