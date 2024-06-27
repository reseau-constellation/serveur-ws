const  { writeFileSync, readFileSync, existsSync, mkdirSync } = require("fs");
const  { execSync } = require("child_process");
const  { join, dirname } = require("path");

const dossierPnpmGlobal = dirname(execSync("pnpm root -g").toString());
const adressePkgJson = join(
  dossierPnpmGlobal,
  "package.json",
);


const pkgJson = existsSync(adressePkgJson) ? JSON.parse(readFileSync(adressePkgJson)) : {};

const résolutions = {
  "@libp2p/autonat": "1.0.21",
  "node-datachannel": "^0.8.0",
};

if (!pkgJson.pnpm) pkgJson.pnpm = {};
pkgJson.pnpm.overrides = {
  ...(pkgJson.pnpm.overrides || {}),
  ...(résolutions || {}),
};  

if (!existsSync(dossierPnpmGlobal)) mkdirSync(dossierPnpmGlobal, {recursive: true}); 
writeFileSync(adressePkgJson, JSON.stringify(pkgJson, null, 2));

execSync("pnpm add -g @constl/serveur@latest");
