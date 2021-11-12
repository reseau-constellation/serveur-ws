import ws from "isomorphic-ws";
import { proxy } from "@constl/ipa";

export class IPAWS extends proxy.proxy.téléClient {
  connexion: ws.WebSocket;
  _messagesEnAttente: proxy.proxy.MessagePourTravailleur[];

  constructor(port: number) {
    super();
    this._messagesEnAttente = []

    this.connexion = new ws.WebSocket(`ws://localhost:${port}`)
    this.connexion.on("open", ()=>{
        this.connexionOuverte()
      }
    )

    this.connexion.on("message", (é) => {
      const message = JSON.parse(é.toString())
      this.emit("message", message)
    })

    this.connexion.onerror = (e) => {
      console.log("Erreur du serveur : ", { e })
      this.emit("erreur", e);
    };
  }

  connexionOuverte() {
    for (const m of this._messagesEnAttente) {
      this.connexion.send(JSON.stringify(m));
    }
  }

  recevoirMessage(message: proxy.proxy.MessagePourTravailleur): void {
    if (this.connexion.readyState === 0) {
      this._messagesEnAttente.unshift(message)
    } else {
      this.connexion.send(JSON.stringify(message));
    }
  }

  fermer(): void {
    this.connexion.close()
  }

}


export default (port: number, idBdRacine?: string, souleverErreurs = false, sujetRéseau?: string): {client: proxy.proxy.ProxyClientConstellation, fermerClient: () => void} => {
  const ipaWS = new IPAWS(port)
  return {client: proxy.proxy.default(ipaWS, souleverErreurs, idBdRacine, undefined, sujetRéseau), fermerClient: () => ipaWS.fermer()}
}
