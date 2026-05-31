import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const webDir = join(rootDir, "www");
const webFiles = [
  "index.html",
  "style.css",
  "script.js",
  "fields.json",
  "options.json",
  "manifest.webmanifest",
  "sw.js",
  "icon.svg",
  "icon-192.png",
  "icon-512.png"
];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });

for (const file of webFiles) {
  await cp(join(rootDir, file), join(webDir, file));
}

console.log(`Copied ${webFiles.length} web files to www.`);
