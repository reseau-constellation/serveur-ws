import { once } from "events";
import { v4 as uuidv4 } from "uuid";
import ws from "isomorphic-ws";
import axios from "axios";

import {
  ClientMandatairifiable,
  générerMandataire,
  MandataireClientConstellation,
} from "@constl/mandataire";
import type { mandataire, client } from "@constl/ipa";

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

export const lancerClient = async ({
  port,
  codeSecret,
}: {
  port: number;
  codeSecret: string;
}): Promise<{
  client: MandataireClientConstellation<client.ClientConstellation>;
  fermerClient: () => void;
}> => {
  const connexion = new ws.WebSocket(
    `ws://localhost:${port}?code=${codeSecret}`,
  );
  await once(connexion, "open");
  const client = new MandataireClientWS(connexion);
  return {
    client: générerMandataire(client),
    fermerClient: async () => {
      await client.fermer();
    },
  };
};

export const demanderAccès = async ({
  port,
  monId,
}: {
  port: number;
  monId?: string;
}): Promise<{
  codeSecret: string;
}> => {
  monId = monId || uuidv4();
  const réponse = await axios(
    `http://localhost:${port}/demande/?id=${monId}`,
  );

  return {
    codeSecret: réponse.data,
  };
};
