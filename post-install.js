import { writeFileSync, readFileSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { execArgv, exit } from "process";
console.log(execArgv);
if (!execArgv.includes("-g") || !execArgv.includes("--global")) exit(0);

const pkgJsonPath = join(
  dirname(execSync("pnpm root -g").toString()),
  "package.json",
);
console.log(pkgJsonPath);

const pkgJson = JSON.parse(readFileSync(pkgJsonPath));
console.log(pkgJson);

const résolutions = JSON.parse(readFileSync("package.json"))["pnpm"]?.[
  "overrides"
];

if (!pkgJson.pnpm) pkgJson.pnpm = {};
pkgJson.pnpm.overrides = {
  ...(pkgJson.pnpm.overrides || {}),
  ...(résolutions || {}),
};
console.log(résolutions);
console.log(pkgJson);

writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

execSync("pnpm i");
