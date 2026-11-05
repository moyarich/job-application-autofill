#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PORTS = "MOYA_WEB_PORT=5173\nMOYA_REVIEW_PORT=6080\n";
export function makePassword(bytes = randomBytes(12)) {
  // VNC's classic password scheme only considers the first eight bytes.
  return bytes.toString("hex").slice(0, 8);
}
export function parsePassword(text) {
  const entries = [...text.matchAll(/^\s*(?:export\s+)?WEB_VNC_PASSWORD\s*=\s*(.*?)\s*$/gm)];
  if (!entries.length) return null;
  const raw = entries.at(-1)[1].trim();
  const quoted = raw.match(/^(['"])(.*?)\1(?:\s*#.*)?$/);
  return quoted ? quoted[2] : raw.split(/\s+#/)[0].trim();
}
function isPlaceholder(value) {
  return !value || /^(?:change-this-password|changeme|password|example|placeholder)$/i.test(value);
}
export function setupEnv(dir = root, env = process.env, random = makePassword) {
  const filename = resolve(dir, ".env");
  const shellPassword = env.WEB_VNC_PASSWORD?.trim();
  if (shellPassword) {
    if (shellPassword.length < 8) throw new Error("WEB_VNC_PASSWORD must be at least 8 characters.");
    if (isPlaceholder(shellPassword)) throw new Error("Replace the example WEB_VNC_PASSWORD before starting.");
    return { source: "environment", generated: null };
  }
  const existing = existsSync(filename) ? readFileSync(filename, "utf8") : null;
  const password = parsePassword(existing || "");
  if (password && !isPlaceholder(password)) {
    if (password.length < 8) throw new Error("WEB_VNC_PASSWORD in .env must be at least 8 characters.");
    return { source: ".env", generated: null };
  }
  const generated = random();
  if (!/^[0-9a-f]{8}$/.test(generated)) throw new Error("Could not generate a valid VNC password.");
  const entry = "WEB_VNC_PASSWORD=" + generated;
  const updated = existing === null
    ? "# Local-only Playwright viewer credentials. Keep this file private.\n" + entry + "\n" + DEFAULT_PORTS
    : /^\s*(?:export\s+)?WEB_VNC_PASSWORD\s*=.*$/m.test(existing)
      ? existing.replace(/^\s*(?:export\s+)?WEB_VNC_PASSWORD\s*=.*$/m, entry)
      : existing.trimEnd() + "\n" + entry + "\n";
  writeFileSync(filename, updated, { mode: 0o600 });
  chmodSync(filename, 0o600);
  return { source: ".env", generated };
}
function preflight(cmd, args, name) {
  const child = spawnSync(cmd, args, { cwd: root, stdio: "pipe", encoding: "utf8", timeout: 12000 });
  if (child.error || child.status !== 0) {
    const hint = (child.stderr || child.stdout || child.error?.message || "").trim();
    throw new Error(name + " is unavailable. Install and start Docker Desktop/Engine with Compose v2.\n" + hint.slice(0, 500));
  }
}
export function main() {
  try {
    preflight("docker", ["compose", "version"], "Docker Compose");
    preflight("docker", ["info", "--format", "{{.ServerVersion}}"], "Docker Engine");
    const { generated } = setupEnv();
    if (generated) {
      console.log("Created .env with a random viewer password (private file).");
      console.log("First-run noVNC password: " + generated + " (also saved as WEB_VNC_PASSWORD in .env)");
    }
    console.log("Starting MoyaApply: React, API, SQLite, Chromium and noVNC via Docker Compose.");
    console.log("Dashboard: http://localhost:" + (process.env.MOYA_WEB_PORT || "5173"));
    console.log("Browser viewer: http://localhost:" + (process.env.MOYA_REVIEW_PORT || "6080") + "/vnc.html");
    const child = spawn("docker", ["compose", "up", "--build"], { cwd: root, stdio: "inherit", env: process.env });
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
    child.on("error", error => { console.error("Could not launch Docker Compose:", error.message); process.exitCode = 1; });
    child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 130 : 1); });
  } catch (error) {
    console.error("MoyaApply startup failed:", error.message);
    process.exitCode = 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
