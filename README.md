<h1 align="center">Serveur local Constellation</h1>
<h3 align="center">Un serveur websocket local pour Constellation</h3>

<p align="center">
  <a href="https://github.com/reseau-constellation/serveur-ws/actions/workflows/tests.yml"><img src="https://github.com/reseau-constellation/serveur-ws/actions/workflows/tests.yml/badge.svg"></a>
  <a href="https://codecov.io/gh/reseau-constellation/serveur-ws" >
 <img src="https://codecov.io/gh/reseau-constellation/serveur-ws/branch/master/graph/badge.svg?token=m5OkXIcKo6"/>
 </a>
  <br>
</p>


# Info général
Ce serveur n'est pas apte à être utilisé en tant que serveur publique ! Entre autres
limitations, il n'y a aucun contrôle d'authentification. Il est donc configuré
afin d'être uniquement disponible sur `localhost`. Ce serveur est dédié
uniquement à la communication entre processus sur le même ordinateur, lorsque
des codes en autres langues informatiques (Python, Julia, R) veulent accéder un nœud
Constellation local.

## Utilisation
Si vous voulez tout simplement utiliser Constellation avec Python ou R, veuillez
installer les librairies respectives [constellation-py](https://github.com/reseau-constellation/client-python), [Constellation.jl](https://github.com/reseau-constellation/Consellation.jl)
et [constellation-R](https://github.com/reseau-constellation/client-r) (en progrès).
Celles-ci se chargeront automatiquement d'installer le serveur Constellation
sur votre machine, si nécessaire.

## Installation globale
L'installation globale vous permet de lancer un serveur websocket Constellation
de la ligne de commande.
Si vous comptez simplement utiliser le serveur Constellation (y compris pour une
analyse en Python, en R ou en Julia), c'est ceci ce que vous voulez.

`pnpm add -g @constl/serveur @constl/ipa`

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

`pnpm add @constl/serveur`

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

```TypeScript
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

```TypeScript
import { lancerClient } from "@constl/serveur";

const port = 5001  // Ou une autre valeur, selon `lancerServeur`
const { client, fermerClient } = lancerClient(port);

// On peut maintenant appeler des fonctions sur le client comme s'il
// s'agissait d'un client Constellation ordinaire :
let noms = {};
const oublierNoms = await client.profil.suivreNoms(x => noms = x);

// Pour arrêter le suivi :
oublierNoms();

// Lorsqu'on a fini :
fermerClient();

```

## Avancé : pécification client
Cette librairie vient avec son propre client websocket conforme. Une
version pour Python et pour Julia sont également disponibles. Cependant, si vous voulez
développer des clients pour d'autres langues informatiques, vous devrez
développer un client dans la langue de votre choix. Ce client devra
répondre à la spécification suivante :

### Actions
Pour invoquer une action Constellation, le client devra envoyer un message de la forme suivante :
```TypeScript
interface MessageActionPourTravailleur extends MessagePourTravailleur {
  type: "action";
  id: string;  // Un identifiant unique (qui sera inclut dans le message de retour avec le résultat de la requète)
  fonction: string[];  // Le nom de la fonction Constellation, en forme de liste
  args: { [key: string]: unknown };  // Les arguments de la fonction Constellation
}
```

Il recevra ensuite, du serveur, un message de la forme suivante :
```TypeScript
interface MessageActionDeTravailleur extends MessageDeTravailleur {
  type: "action";
  id: string;  // Le même identifiant qu'inclus dans le message `MessageActionPourTravailleur` originalement envoyé au serveur
  résultat: unknown;  // Le résultat de la fonction
}
```

À titre d'exemple, la fonction suivante de l'[IPA Constellation](https://github.com/reseau-constellation/ipa) crée une nouvelle base de données.
```TypeScript
const idBd = await client.bds.créerBd({ licence: "ODbl-1_0" })
```

Afin d'invoquer la même fonction par le serveur Constellation, nous enverrons un message comme suit (utilisant le module [uuid](https://www.npmjs.com/package/uuid) pour générer un identifiant unique pour la requète). L'exemple de code est donné en TypeScript, mais pourrait être en n'importe quel
langage informatique.

```TypeScript
import { v4 as uuidv4 } from 'uuid';

const id = uuidv4();

const message: MessageActionPourTravailleur = {
  type: "action",
  id,
  fonction: ["bds", "créerBd"],
  args: { "licence": "ODbl-1_0" },
}

// Envoyer le message par WS au serveur sur le port connecté.
```

Et nous recevrons une réponse comme tel :

```Json
{
  "type": "action",
  "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  "résultat": "/orbitdb/..."
}
```

### Suivis
Les fonctions qui suivent les résultats d'une requète à travers le temps, plutôt que je redonner un résultat ponctuel dans le temps, sont un peu plus compliquées. La fonction suivante suis les noms d'une variable :


```TypeScript
const idDeMaVariable = "/orbitdb/..."  // Selon la variable qui vous intéresse ; générée par `client.variables.créerVariable`
const fOublier = await client.variables.suivreNomsVariable({ id: idDeMaVariable, f: console.log });

// Annuler le suivi
await fOublier();
```

Pour invoquer la même fonction par le serveur, nous enverrons le message suivant :
```TypeScript
import { v4 as uuidv4 } from 'uuid';

const id = uuidv4();

const message: MessageSuivrePourTravailleur = {
  type: "suivre",
  id,
  fonction: ["variables", "suivreNomsVariable"],
  args: { id: idDeMaVariable },
  nomArgFonction: "f",  // Nom de l'argument correspondant à la fonction de suivi
}

// Envoyer le message par WS au serveur sur le port connecté.
```

Et nous recevrons une réponse comme tel lorsque le suivi est amorcé :

```Json
{
  "type": "suivrePrêt",
  "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
}
```

Et des messages suiveront avec les résultats en temps réel de la recherche :
```Json
{
  "type": "suivre",
  "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  "résultat": { "fr": "Précipitation", "த": "பொழிவு" }
}
```

Pour annuler le suivi, envoyer le message suivant :
```TypeScript
const message: MessageRetourPourTravailleur = {
  type: "retour",
  id,
  nomArgFonction: "fOublier"
}

// Envoyer le message par WS au serveur sur le port connecté.
```


### Recherches

```TypeScript
```

### Erreurs




## Développement
Pour installer le client en mode développement, utiliser

`yarn global add file:$PWD`
