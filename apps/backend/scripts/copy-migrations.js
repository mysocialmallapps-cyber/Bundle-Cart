/* eslint-disable no-console */
const fs = require("node:fs/promises");
const path = require("node:path");

async function copyDir(srcDir, dstDir) {
  await fs.mkdir(dstDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(src, dst);
    } else if (entry.isFile()) {
      await fs.copyFile(src, dst);
    }
  }
}

async function main() {
  const src = path.join(process.cwd(), "src", "db", "migrations");
  const dst = path.join(process.cwd(), "dist", "db", "migrations");
  await copyDir(src, dst);
  console.log("Copied migrations to dist/");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

