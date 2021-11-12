import ws from "ws";

import { proxy } from "@constl/ipa";

let n = 0
const prises: {[key: string]: ws.WebSocket} = {}

const obtPrisesRéponseMessage = (idMessage?: string): {prise: ws.WebSocket, id?: string}[] => {
  let prisesFinales: {prise: ws.WebSocket, id?: string}[] = [];
  let id: string;

  if (idMessage) {
    const [idPrise, id_] = idMessage.split(":");
    id = id_
    const prise = prises[idPrise.toString()];
    prisesFinales.push({prise, id});

  } else {
    prisesFinales = Object.values(prises).map(prise=>{return {prise}})
  }

  return prisesFinales
}

const fMessage = (message: proxy.proxy.MessageDeTravailleur) => {
  const { id } = message;
  const prisesPourMessage = obtPrisesRéponseMessage(id)

  prisesPourMessage.forEach(prise => {
    prise.prise.send(JSON.stringify({
      ...message,
      id: prise.id
    }))
  })

}

const fErreur = (erreur: Error, id?: string) => {
  console.log({erreur})

  const messageErreur: proxy.proxy.MessageErreurDeTravailleur = {
    type: "erreur",
    erreur,
  };

  const prisesPourMessage = obtPrisesRéponseMessage(id)
  prisesPourMessage.forEach(
    p=>p.prise.send(JSON.stringify({
      ...messageErreur, id: p.id
    }))
  )
};


const client = new proxy.gestionnaireClient.default(fMessage, fErreur);


export default (serveur: ws.Server): void => {
  serveur.on('connection', prise => {
    n++
    const n_prise = n.toString()
    prises[n.toString()] = prise;
    prise.on(
      'message', message => {
        const messageDécodé: proxy.proxy.MessagePourTravailleur = JSON.parse(message.toString())
        if (messageDécodé.id) messageDécodé.id = `${n_prise}:${messageDécodé.id}`
        client.gérerMessage(messageDécodé)
      }
    );
    prise.on("close", () => {
      const idPrise = Object.entries(prises).find(p=>p[1] === prise)?.[0];
      if (idPrise) delete prises[idPrise];
    })
  })
}
