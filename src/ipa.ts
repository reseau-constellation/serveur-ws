import ws from "ws";

import { proxy, client } from "@constl/ipa";

let n = 0;
const prises: { [key: string]: ws.WebSocket } = {};

const obtPrisesRéponseMessage = (
  idMessage?: string
): { prise: ws.WebSocket; id?: string }[] => {
  let prisesFinales: { prise: ws.WebSocket; id?: string }[] = [];
  let id: string;

  if (idMessage) {
    const [idPrise, id_] = idMessage.split(":");
    id = id_;
    const prise = prises[idPrise.toString()];
    prisesFinales.push({ prise, id });
  } else {
    prisesFinales = Object.values(prises).map((prise) => ({ prise }));
  }

  return prisesFinales;
};

const fMessage = (message: proxy.messages.MessageDeTravailleur) => {
  const { id } = message;
  const prisesPourMessage = obtPrisesRéponseMessage(id);

  prisesPourMessage.forEach((prise) => {
    prise.prise.send(
      JSON.stringify({
        ...message,
        id: prise.id,
      })
    );
  });
};

const fErreur = (erreur: Error, id?: string) => {
  const messageErreur: proxy.messages.MessageErreurDeTravailleur = {
    type: "erreur",
    erreur,
  };

  const prisesPourMessage = obtPrisesRéponseMessage(id);
  prisesPourMessage.forEach((p) =>
    p.prise.send(
      JSON.stringify({
        ...messageErreur,
        id: p.id,
      })
    )
  );
};


export default (
  serveur: ws.Server,
  constellation: client.optsConstellation | proxy.gestionnaireClient.default = {}
): () => void => {
  let client: proxy.gestionnaireClient.default;
  let fFermer: () => void;

  if (constellation instanceof proxy.gestionnaireClient.default) {
    client = constellation
    fFermer = () => {
      // On ne ferme pas le client s'il a été fourni de l'extérieur
    }
  } else {
    client = new proxy.gestionnaireClient.default(
      fMessage, fErreur, constellation
    );
    fFermer = () => {
      client.fermer();
    }
  }

  serveur.on("connection", (prise) => {
    n++;
    const n_prise = n.toString();  // Sauvegarder une référence au numéro de la prise ici

    prises[n.toString()] = prise;
    prise.on("message", (message) => {
      const messageDécodé: proxy.messages.MessagePourTravailleur = JSON.parse(
        message.toString()
      );
      if (messageDécodé.id) messageDécodé.id = `${n_prise}:${messageDécodé.id}`;
      client.gérerMessage(messageDécodé);
    });
    prise.on("close", () => {
      const idPrise = Object.entries(prises).find((p) => p[1] === prise)?.[0];
      if (idPrise) delete prises[idPrise];
    });
  });

  return fFermer;
};
