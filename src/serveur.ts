import type { IncomingMessage } from "http";
import type TypedEmitter from "typed-emitter";

import express, { type Response } from "express";
import { WebSocketServer } from "ws";
import { parse } from "url";
import trouverUnPort from "find-free-port";
import { generateMnemonic, wordlists } from "bip39";

import { client, mandataire } from "@constl/ipa";

import ipa from "@/ipa.js";
import EventEmitter from "events";

type MessageÉvénementRequête = {
  changement: (requêtes: string[]) => void;
};

const authentifier = (
  requête: IncomingMessage,
  bonMotDePasse: string,
): boolean => {
  if (!requête.url) return false;
  const { code } = parse(requête.url, true).query;
  return typeof code === "string" && decodeURI(code) === bonMotDePasse;
};

export const lancerServeur = async ({
  port,
  optsConstellation = {},
}: {
  port?: number;
  optsConstellation:
    | client.optsConstellation
    | mandataire.gestionnaireClient.GestionnaireClient;
}): Promise<{
  fermerServeur: () => Promise<void>;
  port: number;
  codeSecret: string;
  suivreRequêtes: (f: (x: string[]) => void) => () => void;
  approuverRequête: (id: string) => void;
  refuserRequête: (id: string) => void;
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

  const app = express();
  // https://masteringjs.io/tutorials/express/websockets

  const serveurWs = new WebSocketServer({ noServer: true });
  const fermerConstellation = ipa({
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
    requête?.rép.status(200).send(codeSecret);
    requêtes = requêtes.filter((r) => r.id !== id);
    requêtesChangées();
  };

  const refuserRequête = (id: string) => {
    const requête = requêtes.find((r) => r.id === id);
    requête?.rép.status(401).send("Accès refusé");
    requêtes = requêtes.filter((r) => r.id !== id);
    requêtesChangées();
  };

  // `server` is a vanilla Node.js HTTP server, so use
  // the same ws upgrade process described here:
  // https://www.npmjs.com/package/ws#multiple-servers-sharing-a-single-https-server
  const serveur = app.listen(port);

  serveur.on("upgrade", (request, socket, head) => {
    const authentifié = authentifier(request, codeSecret);

    if (authentifié) {
      serveurWs.handleUpgrade(request, socket, head, (socket) => {
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
        fermerConstellation().finally(() => {
          serveur.close();
          résoudre();
        });
      });
    });
  };
  return {
    fermerServeur,
    port,
    codeSecret,
    suivreRequêtes,
    approuverRequête,
    refuserRequête,
  };
};
