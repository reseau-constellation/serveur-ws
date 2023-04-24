import { once } from "events";
import ws from "isomorphic-ws";
import {
  ClientMandatairifiable,
  générerMandataire,
  MandataireClientConstellation,
} from "@constl/mandataire";
import type {
  mandataire
} from "@constl/ipa";

export class MandataireClientWS extends ClientMandatairifiable {
  connexion: ws.WebSocket;

  constructor(connexion: ws.WebSocket) {
    super();
    this.connexion = connexion;

    this.connexion.on("message", (é) => {
      const message = JSON.parse(é.toString());
      this.événements.emit("message", message);
    });

    this.connexion.onerror = (erreur) => {
      const messageErreur: mandataire.messages.MessageErreurDeTravailleur = {
        type: "erreur",
        erreur: erreur.message,
      };
      this.événements.emit("message", messageErreur);
    };
  }

  envoyerMessage(message: mandataire.messages.MessagePourTravailleur): void {
    this.connexion.send(JSON.stringify(message));
  }

  fermer(): void {
    this.connexion.close();
  }
}

export default async ({
  port,
}: {
  port: number;
}): Promise<{
  client: MandataireClientConstellation;
  fermerClient: () => void;
}> => {
  const connexion = new ws.WebSocket(`ws://localhost:${port}`);
  await once(connexion, "open");
  const client = new MandataireClientWS(connexion);
  return {
    client: générerMandataire(client),
    fermerClient: async () => {
      await client.fermer();
    },
  };
};
