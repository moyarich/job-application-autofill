import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { build } from "vite";

// Start only after a complete Vite build; failed rebuilds leave the last server running.
let server: ChildProcess | undefined;
let stopping = false;
const watcher = await build({
  configFile: resolve(import.meta.dirname, "vite.config.ts"),
  build: { watch: { chokidar: { usePolling: true, interval: 300 } } },
});
if (!("on" in watcher)) throw new Error("Expected a Vite build watcher.");
watcher.on("event", async (event) => {
  if (event.code !== "END" || stopping) return;
  if (server && server.exitCode === null && server.signalCode === null) {
    const previous = server;
    await new Promise<void>((done) => {
      previous.once("exit", () => done());
      previous.kill("SIGTERM");
    });
  }
  if (!stopping)
    server = spawn(
      process.execPath,
      [resolve(import.meta.dirname, "dist/index.js")],
      {
        stdio: "inherit",
        env: process.env,
      },
    );
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    stopping = true;
    server?.kill(signal);
    void watcher.close().then(() => process.exit(0));
  });
