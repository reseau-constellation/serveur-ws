import type { IncomingMessage } from "http";

import express from "express";
import { WebSocketServer } from "ws";
import { parse } from 'url'
import trouverUnPort from "find-free-port";
import {generateMnemonic, wordlists} from "bip39";

import { client, mandataire } from "@constl/ipa";

import ipa from "@/ipa.js";

const authentifier = (requète: IncomingMessage, bonMotDePasse: string): boolean => {
  if (!requète.url) return false;
  const { code } = parse(requète.url, true).query
    return code === bonMotDePasse;
}

export default async ({
  port,
  optsConstellation = {},
}: {
  port?: number;
  optsConstellation:
    | client.optsConstellation
    | mandataire.gestionnaireClient.GestionnaireClient;
}): Promise<{ fermerServeur: () => Promise<void>; port: number; codeSecret: string }> => {
  port = port || (await trouverUnPort(5000))[0];
  
  const codeSecret = generateMnemonic(undefined, undefined, wordlists.french);

  const app = express();
  // https://masteringjs.io/tutorials/express/websockets

  const wsServer = new WebSocketServer({ noServer: true });
  const fermerConstellation = ipa({
    serveur: wsServer, 
    constellation: optsConstellation, 
    port
  });

  // `server` is a vanilla Node.js HTTP server, so use
  // the same ws upgrade process described here:
  // https://www.npmjs.com/package/ws#multiple-servers-sharing-a-single-https-server
  const server = app.listen(port);

  server.on("upgrade", (request, socket, head) => {
    const authentifié = authentifier(request, codeSecret)

    if (authentifié) {
      wsServer.handleUpgrade(request, socket, head, (socket) => {
        wsServer.emit("connection", socket, request);
      });
    } else {
      socket.write('HTTP/1.1 401 Authorisation refusée\r\n\r\n')
      socket.destroy()
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
  return { fermerServeur, port, codeSecret };
};
