#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import ora, { Ora } from "ora";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import url from "url";

import { type client, version as versionIPA } from "@constl/ipa";

import lancerServeur from "@/serveur.js";
import { MessageBinaire, PRÉFIX_MACHINE } from "@/const.js";

const dirBase = url.fileURLToPath(new URL("..", import.meta.url));
const fichierPackageJson = path.join(dirBase, "../package.json");
const packageJson = JSON.parse(fs.readFileSync(fichierPackageJson, "utf8"));

const envoyerMessageMachine = ({ message }: { message: MessageBinaire }) => {
  console.log(PRÉFIX_MACHINE + JSON.stringify(message));
};

yargs(hideBin(process.argv))
  .usage("Utilisation: $0 <commande> [options]")
  .command(
    [
      "lancer [-m] [--port <port>] [--compte <id-compte>] [--doss-orbite <dossierOrbite>] [--doss-sfip <dossierSFIP>]",
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
        })
        .option("machine", {
          alias: "m",
          describe: "",
          type: "boolean",
        });
    },
    async (argv) => {
      let roue: Ora | undefined = undefined;
      if (argv.machine) {
        envoyerMessageMachine({ message: { type: "LANÇAGE NŒUD" } });
      } else {
        roue = ora(chalk.yellow(`Initialisation du nœud).start()`));
      }
      const optsConstellation: client.optsConstellation = {
        compte: argv.compte,
        sujetRéseau: argv.sujet,
        orbite: {
          dossier: argv.dossOrbite,
          sfip: { dossier: argv.dossSfip },
        },
      };

      const { port, fermerServeur } = await lancerServeur({
        port: argv.port ? Number.parseInt(argv.port) : undefined,
        optsConstellation,
      });
      process.stdin.on("data", async () => {
        if (argv.machine) {
          envoyerMessageMachine({ message: { type: "ON FERME" } });
        } else {
          roue?.start(chalk.yellow("On ferme le nœud..."));
        }
        try {
          fermerServeur();
        } finally {
          if (argv.machine) {
            envoyerMessageMachine({ message: { type: "NŒUD FERMÉ" } });
          } else {
            roue?.succeed(chalk.yellow("Nœud fermé."));
          }
          process.exit(0);
        }
      });
      if (argv.machine) {
        envoyerMessageMachine({ message: { type: "NŒUD PRÊT", port } });
      } else {
        roue!.succeed(
          chalk.yellow(
            // eslint-disable-next-line no-irregular-whitespace
            `Nœud local prêt sur port : ${port}\nFrappez « retour » pour arrêter le nœud.`,
          ),
        );
      }
    },
  )
  .command(
    ["v-constl-obli"],
    "Version Constellation obligatoire",
    (yargs) => {
      return yargs;
    },
    async () => {
      console.log(packageJson.peerDependencies["@constl/ipa"]);
    },
  )
  .command(
    ["v-constl"],
    "Version Constellation installée",
    (yargs) => {
      return yargs;
    },
    async () => {
      console.log(versionIPA);
    },
  )
  .command(
    ["version"],
    "La version du serveur",
    (yargs) => {
      return yargs;
    },
    async () => {
      console.log(packageJson.version);
    },
  )
  .demandCommand()
  .help("aide", "Obtenir de l'aide")
  .alias("aide", "a")
  .epilog(
    "Code source et rapportage d'erreurs: https://github.com/reseau-constellation/serveur-ws",
  )
  .parse();
