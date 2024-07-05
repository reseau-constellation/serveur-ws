import { once } from "events";
import { v4 as uuidv4 } from "uuid";
import ws from "isomorphic-ws";
import axios from "axios";

import {
  générerMandataire,
  Mandatairifiable,
  MandataireConstellation,
  MessageErreurDIpa,
  MessagePourIpa,
} from "@constl/mandataire";

import type { Constellation, client } from "@constl/ipa";

export class MandataireClientWS extends Mandatairifiable {
  connexion: ws.WebSocket;

  constructor(connexion: ws.WebSocket) {
    super();
    this.connexion = connexion;

    this.connexion.on("message", (m) => {
      const message = JSON.parse(m.toString());
      this.recevoirMessageDIpa(message);
    });

    this.connexion.onerror = (erreur) => {
      const messageErreur: MessageErreurDIpa = {
        type: "erreur",
        erreur: erreur.message,
      };
      this.recevoirMessageDIpa(messageErreur);
    };
  }

  envoyerMessageÀIpa(message: MessagePourIpa): void {
    this.connexion.send(JSON.stringify(message));
  }

  async fermerConnexion(): Promise<void> {
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
  client: MandataireConstellation<client.Constellation>;
  fermerClient: () => void;
}> => {
  const connexion = new ws.WebSocket(
    `ws://localhost:${port}?code=${encodeURI(codeSecret)}`,
  );
  await once(connexion, "open");
  const mandataire = new MandataireClientWS(connexion);
  const client = générerMandataire<Constellation>(mandataire);

  return {
    client,
    fermerClient: async () => {
      // Fermer uniquement la connexion WS, pas l'instance de Constellation (d'autres clients peuvent être connectés).
      await mandataire.fermerConnexion();
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
    `http://localhost:${port}/demande/?id=${encodeURIComponent(monId)}`,
  );
  if (réponse.status === 200) {
    return {
      codeSecret: réponse.data,
    };
  } else {
    return Promise.reject();
  }
};
