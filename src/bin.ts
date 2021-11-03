import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

import lancerServeur from "./serveur"

yargs(hideBin(process.argv))
  .command('lancer [port]', 'lancer le serveur', (yargs) => {
     return yargs
       .positional('port', {
         describe: 'le numéro du port de connexion',
         default: 5000
       })
   }, (argv) => {
     if (argv.bavard) console.info(`Initialisation du serveur sur port : ${argv.port}`);
     lancerServeur(argv.port);
     if (argv.bavard) console.info(`Serveur prêt sur port : ${argv.port}`)
   }
 )
 .option('bavard', {
   alias: 'b',
   type: 'boolean',
   description: 'Émettre plus de détails'
 })
 .parse()
