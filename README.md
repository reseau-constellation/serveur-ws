# Le serveur Constellation (local)
Un serveur websocket local pour Constellation.

Ceci n'est pas apte à être utilisé en tant que serveur publique ! Entre autres
limitations, il n'y a aucun contrôle d'authentification. Il est donc configuré
afin d'être uniquement disponible sur `localhost`. Ce serveur est dédié
uniquement à la communication inter-procès sur le même ordinateur, lorsque
des codes en autres langues informatiques (Python, R) veulent accéder un nœud
Constellation local.

## Utilisation
Si vous voulez out simplement utiliser Constellation avec Python ou R, veuillez
installer les librairies respectives [constellation-py et constellation-R].
Celles-ci se chargeront automatiquement d'installer le serveur Constellation
sur votre machine, si nécessaire.

## Installation globale
L'installation globale vous permet de lancer un serveur websocket Constellation
de la ligne de commande.
Si vous comptez simplement utiliser le serveur Constellation (y compris pour une
analyse en Python ou en R), c'est ceci ce que vous voulez.

`npm install -g @constl/serveur`

### Ligne de commande
`constl lancer [-p <port>] [-b]`

`constl version`

`constl -a`

## Utilisation dans un autre projet
Si vous voulez incorporer le serveur Constellation dans une autre librairie
JavaScript, vous pouvez l'installer ainsi :

`yarn add @constl/serveur`

Ou bien :
`npm install @constl/serveur`

Constellation elle-même (`@constl/ipa`) est spécifiée en tant que dépendance
paire de Constellation. Vous pouvez donc installer la version de Constellation
qui vous convient.

### Utilisation programmatique

Serveur

Client
Vous voudrez aussi probablement utiliser le client websocket qui est aussi disponible
dans cette librairie.

## Spécification client
Cette librairie vient avec son propre client websocket conforme. Une version
pour Python est également disponible. Cependant, si vous voulez développer
des clients pour d'autres langues informatiques, vous devrez développer
un client dans la langue de votre choix. Ce client devra répondre à la
spécification suivante :

Envoyer un message init
Attendre la réponse prêt
