import { once } from "events"
import ws from "isomorphic-ws";
import { proxy } from "@constl/ipa";

export class ProxyClientWS extends proxy.proxy.ClientProxifiable {
  connexion: ws.WebSocket;

  constructor(connexion: ws.WebSocket) {
    super();
    this.connexion = connexion

    this.connexion.on("message", (é) => {
      const message = JSON.parse(é.toString());
      this.événements.emit("message", message);
    });

    this.connexion.onerror = (erreur) => {
      const messageErreur: proxy.messages.MessageErreurDeTravailleur = {
        type: "erreur",
        erreur: erreur.message,
      };
      this.événements.emit("message", messageErreur);
    };
  }

  envoyerMessage(message: proxy.messages.MessagePourTravailleur): void {
    this.connexion.send(JSON.stringify(message))
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
  client: proxy.proxy.ProxyClientConstellation;
  fermerClient: () => void;
}> => {
  const connexion = new ws.WebSocket(`ws://localhost:${port}`);
  await once(connexion, "open")
  const client = new ProxyClientWS(connexion);
  return {
    client: proxy.proxy.générerProxy(client),
    fermerClient: () => client.fermer(),
  };
};
