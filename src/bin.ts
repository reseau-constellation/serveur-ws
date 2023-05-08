#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import chalk from "chalk";
import fs from "fs";
import path from "path";
import url from "url";

import lancerServeur from "@/serveur.js";
import { client, version as versionIPA } from "@constl/ipa";

const dirBase = url.fileURLToPath(new URL("..", import.meta.url));
const fichierPackageJson = path.join(dirBase, "package.json");
const packageJson = JSON.parse(fs.readFileSync(fichierPackageJson, "utf8"));

yargs(hideBin(process.argv))
  .usage("Utilisation: $0 <commande> [options]")
  .command(
    [
      "lancer [--port <port>] [--compte <id-compte>] [--doss-orbite <dossierOrbite>] [--doss-sfip <dossierSFIP>]",
    ],
    "Lancer le serveur",
    (yargs) => {
      return yargs
        .option("port", {
          alias: "p",
          describe: "Le numéro du port de connexion.",
          type: "string",
        })
        .option("compte", {
          alias: "c",
          describe: "Id du compte Constellation (format id orbite).",
          type: "string",
        })
        .option("sujet", {
          alias: "s",
          describe: "Configurer un canal d'écoute personnalisé pour le réseau.",
          type: "string",
        })
        .option("doss-orbite", {
          alias: "do",
          describe: "Le dossier local à utiliser pour Orbite-BD.",
          type: "string",
        })
        .option("doss-sfip", {
          alias: "ds",
          describe: "Le dossier local à utiliser pour SFIP.",
          type: "string",
        });
    },
    async (argv) => {
      // let spinner: Ora
      if (argv.bavard) {
        // spinner = ora(chalk.yellow(`Initialisation du serveur sur port : ${argv.port}`)).start()
        console.log(chalk.yellow(`Initialisation du serveur`));
      }
      const optsConstellation: client.optsConstellation = {
        compte: argv.compte,
        orbite: {
          dossier: argv.dossOrbite,
          sfip: { dossier: argv.dossSfip },
        },
      };

      const { port, fermerServeur } = await lancerServeur({
        port: argv.port ? Number.parseInt(argv.port) : undefined,
        optsConstellation,
      });
      if (argv.bavard) {
        // spinner!.stop()
      }
      console.log(chalk.yellow(`Nœud local prêt sur port : ${argv.port || port}`));
      console.log(chalk.yellow("Frappez n'importe quelle touche pour arrêter le nœud."));

      process.stdin.on("data", async () => {
        console.log(chalk.yellow("On ferme le serveur..."));
        await fermerServeur();
        console.log(chalk.yellow("Nœud fermé."));
        process.exit(0);
      });
    }
  )
  .option("bavard", {
    alias: "b",
    type: "boolean",
    description: "Émettre plus de détails",
  })
  .command(
    ["v-constl-obli"],
    "Version Constellation obligatoire",
    (yargs) => {
      return yargs;
    },
    async () => {
      console.log(packageJson.peerDependencies["@constl/ipa"]);
    }
  )
  .command(
    ["v-constl"],
    "Version Constellation installée",
    (yargs) => {
      return yargs;
    },
    async () => {
      console.log(versionIPA);
    }
  )
  .command(
    ["version"],
    "La version du serveur",
    (yargs) => {
      return yargs;
    },
    async () => {
      console.log(packageJson.version);
    }
  )
  .demandCommand()
  .help("aide", "Obtenir de l'aide")
  .alias("aide", "a")
  .epilog(
    "Code source et rapportage d'erreurs: https://github.com/reseau-constellation/serveur-ws"
  )
  .parse();
