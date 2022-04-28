import ws from "isomorphic-ws";
import { proxy } from "@constl/ipa";

export class Client extends proxy.proxy.téléClient {
  connexion: ws.WebSocket;

  _messagesEnAttente: proxy.messages.MessagePourTravailleur[];

  constructor(port: number) {
    super();
    this._messagesEnAttente = [];

    this.connexion = new ws.WebSocket(`ws://localhost:${port}`);
    this.connexion.on("open", () => {
      this.connexionOuverte();
    });

    this.connexion.on("message", (é) => {
      const message = JSON.parse(é.toString());
      this.emit("message", message);
    });

    this.connexion.onerror = (e) => {
      this.emit("erreur", e);
    };
  }

  connexionOuverte() {
    for (const m of this._messagesEnAttente) {
      this.connexion.send(JSON.stringify(m));
    }
  }

  recevoirMessage(message: proxy.messages.MessagePourTravailleur): void {
    if (this.connexion.readyState === 0) {
      this._messagesEnAttente.unshift(message);
    } else {
      this.connexion.send(JSON.stringify(message));
    }
  }

  fermer(): void {
    this.connexion.close();
  }
}

export default (
  port: number,
  souleverErreurs = false,
): {
  client: proxy.proxy.ProxyClientConstellation;
  fermerClient: () => void;
} => {
  const ipaWS = new Client(port);
  return {
    client: proxy.proxy.default(
      ipaWS,
      souleverErreurs,
    ),
    fermerClient: () => ipaWS.fermer(),
  };
};
