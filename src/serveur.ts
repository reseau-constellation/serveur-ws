import type { IncomingMessage } from "http";
import type TypedEmitter from "typed-emitter";

import express, { type Response } from "express";
import { WebSocketServer } from "ws";
import trouverUnPort from "find-free-port";
import {
  generateMnemonic,
  mnemonicToEntropy,
  validateMnemonic,
  wordlists,
} from "bip39";

import { Constellation, client, mandataire } from "@constl/ipa";

import { attacherIpa } from "@/ipa.js";
import EventEmitter from "events";

type MessageÉvénementRequête = {
  changement: (requêtes: string[]) => void;
};

type RequêteAuthentification = RequêteUnique | RequêtePublique;
type RequêtePublique = {
  type: "publique";
  codeSecret: string;
};

type RequêteUnique = {
  type: "unique";
  idRequête: string;
  codeSecret: string;
};

const validerCode = ({
  code,
  entropieBonCode,
}: {
  code: string;
  entropieBonCode: string;
}): boolean => {
  return mnemonicToEntropy(code, wordlists.french) === entropieBonCode;
};

const décoderRequêteAuthentification = ({
  requête,
}: {
  requête: IncomingMessage;
}): RequêteAuthentification | false => {
  if (!requête.url) return false;
  const code = new URL(requête.url, "http://localhost").searchParams.get(
    "code",
  );

  if (typeof code !== "string") return false;

  const texteCode = decodeURI(code);

  if (texteCode.includes(":")) {
    const [codeSecret, idRequête] = texteCode.split(":");
    if (!validateMnemonic(codeSecret, wordlists.french)) return false;
    return { type: "unique", codeSecret, idRequête };
  } else {
    if (!validateMnemonic(texteCode, wordlists.french)) return false;
    return {
      type: "publique",
      codeSecret: texteCode,
    };
  }
};

const authentifier = ({
  requête,
  entropieCodeCommun,
  entropiesCodesUniques,
}: {
  requête: IncomingMessage;
  entropieCodeCommun: string;
  entropiesCodesUniques: { [id: string]: string };
}): { authentifié: boolean; id?: string } => {
  const infoRequête = décoderRequêteAuthentification({ requête });
  if (!infoRequête) return { authentifié: false };

  if (infoRequête.type === "publique") {
    const authentifié = validerCode({
      code: infoRequête.codeSecret,
      entropieBonCode: entropieCodeCommun,
    });
    return { authentifié };
  } else {
    if (!entropiesCodesUniques[infoRequête.idRequête])
      return { authentifié: false }; // Code déjà utilisé
    const authentifié = validerCode({
      code: infoRequête.codeSecret,
      entropieBonCode: entropiesCodesUniques[infoRequête.idRequête],
    });
    if (authentifié) delete entropiesCodesUniques[infoRequête.idRequête];
    return {
      authentifié,
      id: infoRequête.idRequête,
    };
  }
};

export const lancerServeur = async ({
  port,
  optsConstellation = {},
}: {
  port?: number;
  optsConstellation: client.optsConstellation | mandataire.EnveloppeIpa;
}): Promise<{
  fermerServeur: () => Promise<void>;
  port: number;
  codeSecret: string;
  suivreRequêtes: (f: (x: string[]) => void) => () => void;
  suivreConnexions: (f: (x: string[]) => void) => () => void;
  approuverRequête: (id: string) => void;
  refuserRequête: (id: string) => void;
  révoquerAccès: (id: string) => void;
  ipa: Constellation;
}> => {
  port = port || (await trouverUnPort(5000))[0];
  let requêtes: { id: string; rép: Response }[] = [];
  const événementsRequêtes =
    new EventEmitter() as TypedEmitter<MessageÉvénementRequête>;
  const requêtesChangées = () =>
    événementsRequêtes.emit(
      "changement",
      requêtes.map((r) => r.id),
    );

  const codeSecret = generateMnemonic(undefined, undefined, wordlists.french);
  const entropieCodeCommun = mnemonicToEntropy(codeSecret, wordlists.french);

  const codesUniques: { [id: string]: string } = {};

  const app = express();
  // https://masteringjs.io/tutorials/express/websockets

  const serveurWs = new WebSocketServer({ noServer: true });
  const { fFermer: fermerConstellation, ipa } = attacherIpa({
    serveur: serveurWs,
    constellation: optsConstellation,
    port,
  });

  app.get("/demande", (req, rép) => {
    const id = req.query["id"];
    if (typeof id === "string") {
      requêtes.push({ id, rép });
      requêtesChangées();
    }
  });

  const suivreRequêtes = (f: (r: string[]) => void): (() => void) => {
    événementsRequêtes.on("changement", f);
    f(requêtes.map((r) => r.id));
    return () => événementsRequêtes.off("changement", f);
  };

  const approuverRequête = (id: string) => {
    const requête = requêtes.find((r) => r.id === id);
    const codeSecretUnique = generateMnemonic(
      undefined,
      undefined,
      wordlists.french,
    );
    codesUniques[id] = mnemonicToEntropy(codeSecretUnique, wordlists.french);

    requête?.rép.status(200).send(codeSecretUnique + ":" + id);

    requêtes = requêtes.filter((r) => r.id !== id);
    requêtesChangées();
  };

  const refuserRequête = (id: string) => {
    const requête = requêtes.find((r) => r.id === id);
    requête?.rép.status(401).send("Accès refusé");
    requêtes = requêtes.filter((r) => r.id !== id);
    requêtesChangées();
  };

  const révoquerAccès = (id: string) => {
    const connexion = [...serveurWs.clients].find(
      (c) => objIdMap.get(c) === id,
    );
    if (!connexion) throw "Aucune connexion correspondant à la requête : " + id;
    connexion.close();
  };

  const suivreConnexions = (f: (r: string[]) => void): (() => void) => {
    const fFinale = () => {
      const connexions: string[] = [];
      serveurWs.clients.forEach((c) => {
        connexions.push(objIdMap.get(c));
      });
      f(connexions);
    };
    serveurWs.on("connection", fFinale);
    serveurWs.on("close", fFinale);
    fFinale();

    return () => {
      serveurWs.off("connection", fFinale);
      serveurWs.off("close", fFinale);
    };
  };

  // `server` is a vanilla Node.js HTTP server, so use
  // the same ws upgrade process described here:
  // https://www.npmjs.com/package/ws#multiple-servers-sharing-a-single-https-server
  const serveur = app.listen(port);

  const objIdMap = new WeakMap();

  serveur.on("upgrade", (request, socket, head) => {
    const { authentifié, id } = authentifier({
      requête: request,
      entropieCodeCommun,
      entropiesCodesUniques: codesUniques,
    });

    if (authentifié) {
      serveurWs.handleUpgrade(request, socket, head, (socket) => {
        if (id) objIdMap.set(socket, id);
        serveurWs.emit("connection", socket, request);
      });
    } else {
      socket.write("HTTP/1.1 401 Authorisation refusée\r\n\r\n");
      socket.destroy();
      return;
    }
  });

  const fermerServeur = () => {
    return new Promise<void>((résoudre) => {
      serveurWs.close(() => {
        console.log("serveur ws fermé");
        fermerConstellation()
          .catch(console.log)
          .finally(() => {
            console.log("constellation fermée");
            serveur.close(() => {
              console.log("serveur fermé");
              résoudre();
            });
          });
      });
    });
  };

  return {
    fermerServeur,
    port,
    codeSecret,
    suivreRequêtes,
    suivreConnexions,
    approuverRequête,
    refuserRequête,
    révoquerAccès,
    ipa,
  };
};
