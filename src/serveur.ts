import type { IncomingMessage } from "http";
import type TypedEmitter from "typed-emitter";

import express, {type Response} from "express";
import { WebSocketServer } from "ws";
import { parse } from "url";
import trouverUnPort from "find-free-port";
import { generateMnemonic, wordlists } from "bip39";

import { client, mandataire } from "@constl/ipa";

import ipa from "@/ipa.js";
import EventEmitter from "events"

type MessageÉvénementRequète = {
  changement: (requètes: string[]) => void,
}


const authentifier = (
  requète: IncomingMessage,
  bonMotDePasse: string,
): boolean => {
  if (!requète.url) return false;
  const { code } = parse(requète.url, true).query;
  return code === bonMotDePasse;
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
  suivreRequètes: (f: (x: string[]) => void) => () => void;
  approuverRequète: (id: string) => void;
  refuserRequète: (id: string) => void;
}> => {
  port = port || (await trouverUnPort(5000))[0];
  let requètes: {id: string, rép: Response}[] = [];
  const événementsRequètes = new EventEmitter() as TypedEmitter<MessageÉvénementRequète>;
  const requètesChangées = () => événementsRequètes.emit("changement", requètes.map(r=>r.id));

  const codeSecret = generateMnemonic(undefined, undefined, wordlists.french);

  const app = express();
  // https://masteringjs.io/tutorials/express/websockets

  const wsServer = new WebSocketServer({ noServer: true });
  const fermerConstellation = ipa({
    serveur: wsServer,
    constellation: optsConstellation,
    port,
  });

  app.get("/demande", (req, rép)  => {
    const id = req.query["id"]
    if (typeof id === "string") {
      requètes.push({ id, rép });
      requètesChangées();
    }
  })

  const suivreRequètes = (f: (r: string[]) => void): (() => void) => {
    événementsRequètes.on("changement", f);
    f(requètes.map(r=>r.id));
    return () => événementsRequètes.off("changement", f)
  }

  const approuverRequète = (id: string) => {
    const requète = requètes.find(r=>r.id === id);
    requète?.rép.status(200).send(codeSecret);
    requètes = requètes.filter(r=>r.id !== id);
    requètesChangées();
  }

  const refuserRequète = (id: string) => {
    const requète = requètes.find(r=>r.id === id)
    requète?.rép.status(401).send("Accès refusé");
    requètes = requètes.filter(r=>r.id !== id);
    requètesChangées();
  }

  // `server` is a vanilla Node.js HTTP server, so use
  // the same ws upgrade process described here:
  // https://www.npmjs.com/package/ws#multiple-servers-sharing-a-single-https-server
  const server = app.listen(port);

  server.on("upgrade", (request, socket, head) => {
    const authentifié = authentifier(request, codeSecret);

    if (authentifié) {
      wsServer.handleUpgrade(request, socket, head, (socket) => {
        wsServer.emit("connection", socket, request);
      });
    } else {
      socket.write("HTTP/1.1 401 Authorisation refusée\r\n\r\n");
      socket.destroy();
      return;
    }
  });
  const fermerServeur = () => {
    return new Promise<void>((résoudre) => {
      wsServer.close(() => {
        fermerConstellation().finally(() => {
          server.close();
          résoudre();
        });
      });
    });
  };
  return { fermerServeur, port, codeSecret, suivreRequètes, approuverRequète, refuserRequète };
};
