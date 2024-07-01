import ws from "ws";

import { client, mandataire } from "@constl/ipa";
import { MessageDIpa, MessageErreurDIpa, MessagePourIpa } from "@constl/mandataire";

let n = 0;
const prises: { [key: string]: ws.WebSocket } = {};

const obtPrisesRéponseMessage = (
  idMessage?: string,
): { prise: ws.WebSocket; id?: string }[] => {
  let prisesFinales: { prise: ws.WebSocket; id?: string }[] = [];
  let id: string;

  if (idMessage) {
    const [idPrise, id_] = idMessage.split(":");
    id = id_;
    const prise = prises[idPrise.toString()];
    if (prise) prisesFinales.push({ prise, id });
  } else {
    prisesFinales = Object.values(prises).map((prise) => ({ prise }));
  }

  return prisesFinales;
};

const fMessage = (message: MessageDIpa) => {
  const { id } = message;
  const prisesPourMessage = obtPrisesRéponseMessage(id);

  prisesPourMessage.forEach((prise) => {
    prise.prise.send(
      JSON.stringify({
        ...message,
        id: prise.id,
      }),
    );
  });
};

const fErreur = (erreur: string, id?: string) => {
  const messageErreur: MessageErreurDIpa = {
    type: "erreur",
    erreur,
  };

  const prisesPourMessage = obtPrisesRéponseMessage(id);
  prisesPourMessage.forEach((p) =>
    p.prise.send(
      JSON.stringify({
        ...messageErreur,
        id: p.id,
      }),
    ),
  );
};

export default ({
  serveur,
  constellation = {},
  port,
}: {
  serveur: ws.Server;
  constellation?:
    | client.optsConstellation
    | mandataire.gestionnaireClient.GestionnaireClient;
  port: number;
}): (() => Promise<void>) => {
  let client: mandataire.gestionnaireClient.GestionnaireClient;
  let fFermer: () => Promise<void>;

  if (
    constellation instanceof mandataire.gestionnaireClient.GestionnaireClient
  ) {
    client = constellation;
    fFermer = async () => {
      // On ne ferme pas le client s'il a été fourni de l'extérieur
    };
  } else {
    constellation.messageVerrou = `{port: ${port}}`;
    client = new mandataire.gestionnaireClient.GestionnaireClient(
      fMessage,
      fErreur,
      {
        ...constellation,
      },
    );
    fFermer = async () => {
      await client.fermer();
    };
  }

  serveur.on("connection", (prise) => {
    n++;
    const n_prise = n.toString(); // Sauvegarder une référence au numéro de la prise ici

    prises[n.toString()] = prise;

    prise.on("message", (message) => {
      const messageDécodé: MessagePourIpa =
        JSON.parse(message.toString());
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
