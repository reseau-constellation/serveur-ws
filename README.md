# Le serveur Constellation (local)
Un serveur websocket local pour Constellation.

Ceci n'est pas apte à être utilisé en tant que serveur publique ! Entre autres
limitations, il n'y a aucun contrôle d'authentification. Il est donc configuré
afin d'être uniquement disponible sur `localhost`. Ce serveur est dédié
uniquement à la communication entre processus sur le même ordinateur, lorsque
des codes en autres langues informatiques (Python, R) veulent accéder un nœud
Constellation local.

## Utilisation
Si vous voulez out simplement utiliser Constellation avec Python ou R, veuillez
installer les librairies respectives [constellation-py](https://github.com/reseau-constellation/client-python)
et [constellation-R](https://github.com/reseau-constellation/client-r) (en progrès).
Celles-ci se chargeront automatiquement d'installer le serveur Constellation
sur votre machine, si nécessaire.

## Installation globale
L'installation globale vous permet de lancer un serveur websocket Constellation
de la ligne de commande.
Si vous comptez simplement utiliser le serveur Constellation (y compris pour une
analyse en Python ou en R), c'est ceci ce que vous voulez.

`yarn global add @constl/serveur`

Ou bien :

`npm install -g @constl/serveur`

### Ligne de commande
Pour lancer le serveur :
`constl lancer [-p <port>] [-b]`

Pour obtenir le numéro de la version :
`constl version`

Pour obtenir de l'aide :
`constl -a`

## Utilisation dans un autre projet
Si vous voulez incorporer le serveur Constellation dans une autre librairie
JavaScript, vous pouvez l'installer ainsi :

`yarn add @constl/serveur`

Ou bien :
`npm install @constl/serveur`

Constellation elle-même (`@constl/ipa`) est spécifiée en tant que dépendance
paire du serveur Constellation. Vous pouvez donc installer la version de Constellation
qui vous convient.

### Utilisation programmatique

#### Serveur
```JavaScript
import { lancerServeur } from "@constl/serveur";

const { fermerServeur, port } = await lancerServeur();

// `port` contient maintenant le numéro de port à utiliser dans le client

// Lorsqu'on a fini :
fermerServeur();

```

Invoqué sans configuration, `lancerServeur` trouvera un port disponible sur
`localhost` et redonnera cette valeur dans la variable `port`. Vous pouvez
également spécifier une configuration Constellation plus précise :

```JavaScript
import { lancerServeur } from "@constl/serveur";

const { fermerServeur, port } = await lancerServeur({
  port: 5003,
  optsConstellation: {
    orbite: {
      dossier: "mon-dossier-orbite",  // Dossier pour bd-orbite
      sfip: {
        dossier: "mon-dossier-sfip"  // Dossier du Système de fichiers interplanétaire
      }
    },
  }
});

```

#### Client
Vous voudrez aussi probablement utiliser le client websocket qui est aussi disponible
dans cette librairie.

```JavaScript
import { lancerClient } from "@constl/serveur";

const port = 5001  // Ou une autre valeur, selon `lancerServeur`
const { client, fermerClient } = lancerClient(port);

// On peut maintenant appeler des fonctions sur le client comme s'il
// s'agissait d'un client Constellation ordinaire :
const noms = {}
const oublierNoms = await client.profil.suivreNoms(x => noms = x);

// Pour arrêter le suivi :
oublierNoms();

// Lorsqu'on a fini :
fermerClient();

```

## Spécification client
Cette librairie vient avec son propre client websocket conforme. Une
version pour Python est également disponible. Cependant, si vous voulez
développer des clients pour d'autres langues informatiques, vous devrez
développer un client dans la langue de votre choix. Ce client devra
répondre à la spécification suivante :

Envoyer un message init

Attendre la réponse prêt
