#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import ora, { Ora } from "ora";
import chalk from "chalk";
import logUpdate from "log-update";
import fs from "fs";
import path from "path";
import url from "url";
import {
  type client,
  type types,
  type Constellation,
  type réseau,
  version as versionIPA,
} from "@constl/ipa";

import { lancerServeur } from "@/serveur.js";
import { MessageBinaire, PRÉFIX_MACHINE } from "@/const.js";

const dirBase = url.fileURLToPath(new URL("..", import.meta.url));
const fichierPackageJson = path.join(dirBase, "../package.json");
const packageJson = JSON.parse(fs.readFileSync(fichierPackageJson, "utf8"));

const envoyerMessageMachine = ({ message }: { message: MessageBinaire }) => {
  console.log(PRÉFIX_MACHINE + JSON.stringify(message));
};

const suivreConnexions = async ({ ipa }: { ipa: Constellation }) => {
  const connexions: {
    sfip: { pair: string; adresses: string[] }[];
    constellation: réseau.statutMembre[];
    monId?: string;
  } = {
    sfip: [],
    constellation: [],
  };

  const fFinale = () => {
    const nConnexionsSfip = connexions.sfip.length;
    const nConnexionsMembres = connexions.constellation.filter((c) => c.infoMembre.idCompte !== connexions.monId && !c.vuÀ).length;

    logUpdate(
      chalk.yellow(
        // eslint-disable-next-line no-irregular-whitespace
        `Connexions réseau : ${nConnexionsSfip}\nComptes Constellation en ligne : ${nConnexionsMembres}`,
      ),
    );
  };

  const oublierMonId = await ipa.suivreIdCompte({
    f: id => connexions.monId = id,
  });
  const oublierConnexionsSFIP = await ipa.réseau.suivreConnexionsPostesSFIP({
    f: (x) => {
      connexions.sfip = x;
      fFinale();
    },
  });
  const oublierConnexionsConstellation =
    await ipa.réseau.suivreConnexionsMembres({
      f: (x) => {
        connexions.constellation = x;
        fFinale();
      },
    });
  return async () => {
    await Promise.all([
      oublierMonId(),
      oublierConnexionsSFIP(),
      oublierConnexionsConstellation(),
    ]);
  };
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
      let oublierConnexions: types.schémaFonctionOublier | undefined =
        undefined;

      if (argv.machine) {
        envoyerMessageMachine({ message: { type: "LANÇAGE NŒUD" } });
      } else {
        roue = ora(chalk.yellow(`Initialisation du nœud)`)).start();
      }

      const optsConstellation: client.optsConstellation = {
        dossier: argv.dossier,
        sujetRéseau: argv.sujet,
      };

      const { port, codeSecret, fermerServeur, ipa } = await lancerServeur({
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
          await oublierConnexions?.();
          await fermerServeur();
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
        envoyerMessageMachine({
          message: { type: "NŒUD PRÊT", port, codeSecret },
        });
      } else {
        roue!.succeed(
          chalk.yellow(
            // eslint-disable-next-line no-irregular-whitespace
            `Nœud local prêt sur port : ${port}\nCode secret : ${codeSecret}\nFrappez « retour » pour arrêter le nœud.`,
          ),
        );
        oublierConnexions = await suivreConnexions({ ipa });
      }
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
