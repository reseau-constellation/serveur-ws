import { v4 as uuidv4 } from "uuid";
import ws from "ws";

import { Constellation, client, mandataire } from "@constl/ipa";
import {
  ErreurMandataire,
  Mandatairifiable,
  MessageDIpa,
  MessageErreurDIpa,
  MessagePourIpa,
  générerMandataire,
} from "@constl/mandataire";

let n = 0;
const prises: { [key: string]: ws.WebSocket } = {};

class Mandataire extends Mandatairifiable {
  ipa: mandataire.EnveloppeIpa;
  constructor({ ipa }: { ipa: mandataire.EnveloppeIpa }) {
    super();
    this.ipa = ipa;
    this.ipa.connecterÉcouteurs({
      fMessage: (m) => this.recevoirMessageDIpa(m),
      fErreur: (e) =>
        this.recevoirMessageDIpa({
          type: "erreur",
          erreur: e.erreur,
          codeErreur: e.code,
          idRequête: e.idRequête,
        }),
    });
  }

  envoyerMessageÀIpa(message: MessagePourIpa): void {
    this.ipa.gérerMessage(message);
  }
}

const connecterÀWs = ({
  ipa,
}: {
  ipa: mandataire.EnveloppeIpa;
}): (() => void) => {
  return ipa.connecterÉcouteurs({
    fMessage,
    fErreur,
  });
};

const obtPrisesRéponseMessage = (
  idMessage?: string,
): { prise: ws.WebSocket; idMessage?: string }[] => {
  let prisesFinales: { prise: ws.WebSocket; idMessage?: string }[] = [];
  let idRequête: string;

  if (idMessage) {
    const [idPrise, id_] = idMessage.split(":");
    idRequête = id_;
    const prise = prises[idPrise.toString()];
    if (prise) prisesFinales.push({ prise, idMessage: idRequête });
  } else {
    prisesFinales = Object.values(prises).map((prise) => ({ prise }));
  }

  return prisesFinales;
};

const fMessage = (message: MessageDIpa) => {
  const { idRequête } = message;
  const prisesPourMessage = obtPrisesRéponseMessage(idRequête);

  prisesPourMessage.forEach((prise) => {
    prise.prise.send(
      JSON.stringify({
        ...message,
        idRequête: prise.idMessage, // Mettre l'identifiant original de la requète (sans le numéro de prise)
      }),
    );
  });
};

const fErreur = (e: ErreurMandataire) => {
  const messageErreur: MessageErreurDIpa = {
    type: "erreur",
    erreur: e.erreur,
    idRequête: e.idRequête,
    codeErreur: e.code,
  };

  const prisesPourMessage = obtPrisesRéponseMessage(e.idRequête);
  prisesPourMessage.forEach((p) =>
    p.prise.send(
      JSON.stringify({
        ...messageErreur,
        idRequête: p.idMessage,
      }),
    ),
  );
};

export const attacherIpa = ({
  serveur,
  constellation = {},
  port,
}: {
  serveur: ws.Server;
  constellation?: client.optsConstellation | mandataire.EnveloppeIpa;
  port: number;
}): { fFermer: () => Promise<void>; ipa: Constellation } => {
  let ipa: mandataire.EnveloppeIpa;
  let fFermer: () => Promise<void>;

  if (constellation instanceof mandataire.EnveloppeIpa) {
    ipa = constellation;
    const déconnecterDeWs = connecterÀWs({ ipa });

    ipa.gérerMessage({
      type: "action",
      idRequête: uuidv4(),
      fonction: ["spécifierMessageVerrou"],
      args: { port },
    });

    // On ne ferme pas l'instance Constellation si elle a été fournie de l'extérieur
    fFermer = async () => déconnecterDeWs();
  } else {
    constellation.messageVerrou = JSON.stringify({ port });
    ipa = new mandataire.EnveloppeIpa(fMessage, fErreur, {
      ...constellation,
    });
    fFermer = async () => {
      await ipa.fermer();
    };
  }

  serveur.on("connection", (prise) => {
    n++;
    const n_prise = n.toString(); // Sauvegarder une référence au numéro de la prise ici

    prises[n.toString()] = prise;

    prise.on("message", (message) => {
      const messageDécodé: MessagePourIpa = JSON.parse(message.toString());
      if (messageDécodé.idRequête)
        messageDécodé.idRequête = `${n_prise}:${messageDécodé.idRequête}`;
      ipa.gérerMessage(messageDécodé);
    });
    prise.on("close", () => {
      const idPrise = Object.entries(prises).find((p) => p[1] === prise)?.[0];
      if (idPrise) delete prises[idPrise];
    });
  });

  return {
    fFermer,
    ipa: générerMandataire<Constellation>(new Mandataire({ ipa })),
  };
};
