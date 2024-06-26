const  { writeFileSync, readFileSync } = require("fs");
const  { execSync } = require("child_process");
const  { join, dirname } = require("path");

const pkgJsonPath = join(
  dirname(execSync("pnpm root -g").toString()),
  "package.json",
);

const pkgJson = JSON.parse(readFileSync(pkgJsonPath));

const résolutions = {
  "@libp2p/autonat": "1.0.21",
  "node-datachannel": "^0.8.0",
};

if (!pkgJson.pnpm) pkgJson.pnpm = {};
pkgJson.pnpm.overrides = {
  ...(pkgJson.pnpm.overrides || {}),
  ...(résolutions || {}),
};

writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

execSync("pnpm add -g @constl/serveur@latest");
