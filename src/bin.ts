#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
// import ora, { Ora } from "ora";
import chalk from "chalk";

import lancerServeur from "./serveur";

// Versions : considérer https://www.npmjs.com/package/pkginfo
require('pkginfo')(module);

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
      const optsConstellation = {
        compte: argv.compte,
        dossierOrbite: argv.dossierOrbite,
        dossierSFIP: argv.dossierSFIP,
      };

      const { port } = await lancerServeur({
        port: argv.port ? Number.parseInt(argv.port) : undefined,
        optsConstellation,
      });
      if (argv.bavard) {
        // spinner!.stop()
      }
      console.log(chalk.yellow(`Serveur prêt sur port : ${argv.port || port}`));
    }
  )
  .option("bavard", {
    alias: "b",
    type: "boolean",
    description: "Émettre plus de détails",
  })
  .command(
    [
      "v-constl-obli",
    ],
    "Version Constellation obligatoire",
    (yargs) => {
      return yargs
    },
    async () => {
      console.log(module.exports.peerDependencies["@constl/ipa"]);
    }
  )
  .demandCommand()
  .help("aide", "Obtenir de l'aide")
  .alias("aide", "a")
  .alias("version", "v")
  .epilog(
    "Code source et rapportage d'erreurs: https://github.com/reseau-constellation/serveur-ws"
  )
  .parse();
