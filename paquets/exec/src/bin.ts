#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type {Ora} from "ora";
// import type {MessageBinaire} from "@constl/serveur"
import type { client} from "@constl/ipa";

const ora = import("ora");
const chalk = import("chalk");
const serveur = import("@constl/serveur");

import fs from "fs";
import path from "path";
import url from "url";



const dirBase = url.fileURLToPath(new URL("..", import.meta.url));
// const fichierPackageJson = path.join(dirBase, "./package.json");
// const packageJson = JSON.parse(fs.readFileSync(fichierPackageJson, "utf8"));

const envoyerMessageMachine = async ({ message }: { message: any }) => {
  // const {PRÉFIX_MACHINE} = await serveur;
  console.log("PRÉFIX_MACHINE" + JSON.stringify(message));
};

yargs(hideBin(process.argv))
  .usage("Utilisation: $0 <commande> [options]")
  .command(
    ["lancer [-m] [--port <port>] [--dossier <dossier>]"],
    "Lancer le serveur",
    (yargs) => {
      return yargs
        .option("port", {
          alias: "p",
          describe: "Le numéro du port de connexion.",
          type: "string",
        })
        .option("sujet", {
          alias: "s",
          describe: "Configurer un canal d'écoute personnalisé pour le réseau.",
          type: "string",
        })
        .option("dossier", {
          alias: "d",
          describe: "Le dossier du compte Constellation.",
          type: "string",
        })
        .option("machine", {
          alias: "m",
          describe: "Mode communication machine.",
          type: "boolean",
        });
    },
    async (argv) => {
      let roue: Ora | undefined = undefined;
      if (argv.machine) {
        await envoyerMessageMachine({ message: { type: "LANÇAGE NŒUD" } });
      } else {
        roue = (await ora).default((await chalk).default.yellow(`Initialisation du nœud).start()`));
      }
      const optsConstellation: client.optsConstellation = {
        dossier: argv.dossier,
        sujetRéseau: argv.sujet,
      };
      const {lancerServeur} = (await serveur);
      const { port, codeSecret, fermerServeur } = await lancerServeur({
        port: argv.port ? Number.parseInt(argv.port) : undefined,
        optsConstellation,
      });
      process.stdin.on("data", async () => {
        if (argv.machine) {
          await envoyerMessageMachine({ message: { type: "ON FERME" } });
        } else {
          roue?.start((await chalk).default.yellow("On ferme le nœud..."));
        }
        try {
          fermerServeur();
        } finally {
          if (argv.machine) {
            await envoyerMessageMachine({ message: { type: "NŒUD FERMÉ" } });
          } else {
            roue?.succeed((await chalk).default.yellow("Nœud fermé."));
          }
          process.exit(0);
        }
      });
      if (argv.machine) {
        await envoyerMessageMachine({
          message: { type: "NŒUD PRÊT", port, codeSecret },
        });
      } else {
        roue!.succeed(
          (await chalk).default.yellow(
            // eslint-disable-next-line no-irregular-whitespace
            `Nœud local prêt sur port : ${port}\nCode secret : ${codeSecret}\nFrappez « retour » pour arrêter le nœud.`,
          ),
        );
      }
    },
  )
  .command(
    ["version"],
    "La version du serveur",
    (yargs) => {
      return yargs;
    },
    async () => {
      console.log("packageJson.version");
    },
  )
  .demandCommand()
  .help("aide", "Obtenir de l'aide")
  .alias("aide", "a")
  .epilog(
    "Code source et rapportage d'erreurs: https://github.com/reseau-constellation/serveur-ws",
  )
  .parse();
