#!/usr/bin/env node

import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
// import ora, { Ora } from "ora";
import chalk from "chalk";

import lancerServeur from "./serveur"

yargs(hideBin(process.argv))
  .usage('Utilisation: $0 <commande> [options]')
  .command(['lancer [--port <port>]'], 'Lancer le serveur', (yargs) => {
     return yargs
       .option('port', {
         describe: 'Le numéro du port de connexion.',
         type: 'string'
       })

   }, async (argv) => {
     // let spinner: Ora
     if (argv.bavard) {
       // spinner = ora(chalk.yellow(`Initialisation du serveur sur port : ${argv.port}`)).start()
       chalk.yellow(`Initialisation du serveur sur port : ${argv.port}`)
     }

     const { port } = await lancerServeur(
       argv.port ? Number.parseInt(argv.port): undefined
     );
     if (argv.bavard) {
       // spinner!.stop()
     }
     if (argv.bavard || !argv.port) console.log(
       chalk.yellow(`Serveur prêt sur port : ${argv.port || port}`)
     )
   }
 )
 .option('bavard', {
   alias: 'b',
   type: 'boolean',
   description: 'Émettre plus de détails',
 })
 .demandCommand()
 .help('aide', "Obtenir de l'aide")
 .alias('aide', 'a')
 .alias('version', 'v')
 .epilog("Code source et rapportage d'erreurs: https://github.com/reseau-constellation/serveur-ws")
 .parse()
