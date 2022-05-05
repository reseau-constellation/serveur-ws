import { once } from "events"
import ws from "isomorphic-ws";
import { proxy } from "@constl/ipa";

export class ProxyClientWS extends proxy.proxy.ClientProxifiable {
  connexion: ws.WebSocket;

  constructor(connexion: ws.WebSocket, souleverErreurs = false) {
    super(souleverErreurs);
    this.connexion = connexion

    this.connexion.on("message", (é) => {
      const message = JSON.parse(é.toString());
      this.événements.emit("message", message);
    });

    this.connexion.onerror = (e) => {
      this.événements.emit("erreur", e);
    };
  }

  envoyerMessage(message: proxy.messages.MessagePourTravailleur): void {
    this.connexion.send(JSON.stringify(message))
  }

  fermer(): void {
    this.connexion.close();
  }
}

export default async (
  port: number,
  souleverErreurs = false
): Promise<{
  client: proxy.proxy.ProxyClientConstellation;
  fermerClient: () => void;
}> => {
  const connexion = new ws.WebSocket(`ws://localhost:${port}`);
  await once(connexion, "open")
  const client = new ProxyClientWS(connexion, souleverErreurs);
  return {
    client: proxy.proxy.générerProxy(client),
    fermerClient: () => client.fermer(),
  };
};
