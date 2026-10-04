import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const dist = join(root, "dist");

const EXCLUDE = new Set([
  ".git", ".github", ".wrangler", "node_modules", "dist",
  "functions", "server", "scripts", "tests", "test",
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
  "wrangler.toml", "wrangler.json", "wrangler.jsonc"
]);

async function copyEntry(name) {
  if (EXCLUDE.has(name)) return;
  const src = join(root, name);
  const dst = join(dist, name);
  const info = await stat(src);
  if (info.isDirectory()) {
    await cp(src, dst, { recursive: true, force: true });
  } else {
    await cp(src, dst, { force: true });
  }
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const name of await readdir(root)) {
  await copyEntry(name);
}

console.log("Anlagenbuch: dist created successfully.");
