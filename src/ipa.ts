import ws from "ws";

import {
  MessageDeTravailleur,
  MessageErreurDeTravailleur,
  MessagePourTravailleur,
} from "@constl/ipa/lib/proxy/proxy";
import GestionnaireClient from "@constl/ipa/lib/proxy/gestionnaireClient";

let n = 0
const prises: {[key: string]: ws.WebSocket} = {}

const fMessage = (message: MessageDeTravailleur) => {
  const [idPrise, idMessage] = message.id.split(":");
  const prise = prises[idPrise.toString()];
  if (prise) {
    message.id = idMessage;
    prise.send(message);
  }
}

const fErreur = (erreur: Error, id?: string) => {
  let prisesPourMessage: ws.WebSocket[] = [];

  const messageErreur: MessageErreurDeTravailleur = {
    type: "erreur",
    erreur,
  };

  if (id) {
    const [idPrise, idMessage] = id.split(":");
    const prise = prises[idPrise.toString()];
    prisesPourMessage.push(prise);

    messageErreur.id = idMessage;
  } else {
    prisesPourMessage = Object.values(prises)
  }

  prisesPourMessage.forEach(p=>p.send(messageErreur))
};

const client = new GestionnaireClient(fMessage, fErreur);


export default (serveur: ws.Server): void => {
  serveur.on('connection', socket => {
    n++
    socket.on(
      'message', message => {
        const messageDécodé: MessagePourTravailleur = JSON.parse(message.toString())
        messageDécodé.id = `${n}:${messageDécodé.id}`
        client.gérerMessage(messageDécodé)
      }
    );
    socket.on("close", () => {
      const idPrise = Object.entries(prises).find(p=>p[1] === socket)?.[0];
      if (idPrise) delete prises[idPrise];
    })
  })
}
