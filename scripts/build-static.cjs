const { cpSync, existsSync, mkdirSync, rmSync } = require("node:fs");
const { join } = require("node:path");

const projectRoot = join(__dirname, "..");
const outputDir = join(projectRoot, "dist");
const files = [
  "index.html",
  "styles.css",
  "welcome.css",
  "app.js",
  "welcome.js",
];
const directories = ["assets", "downloads"];

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const file of files) {
  cpSync(join(projectRoot, file), join(outputDir, file));
}

for (const directory of directories) {
  const source = join(projectRoot, directory);
  if (existsSync(source)) {
    cpSync(source, join(outputDir, directory), { recursive: true });
  }
}
