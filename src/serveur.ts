import express from "express";
import { WebSocketServer } from "ws"
import trouverUnPort from "find-free-port";

import { client, proxy } from "@constl/ipa";

import ipa from "@/ipa";


export default async ({
  port,
  optsConstellation = {},
}: {
  port?: number;
  optsConstellation:
    | client.optsConstellation
    | proxy.gestionnaireClient.default;
}): Promise<{ fermerServeur: () => void; port: number }> => {
  port = port || (await trouverUnPort(5000))[0];

  const app = express();
  // https://masteringjs.io/tutorials/express/websockets

  const wsServer = new WebSocketServer({ noServer: true });
  const fermerConstellation = ipa(wsServer, optsConstellation);

  // `server` is a vanilla Node.js HTTP server, so use
  // the same ws upgrade process described here:
  // https://www.npmjs.com/package/ws#multiple-servers-sharing-a-single-https-server
  const server = app.listen(port);

  server.on("upgrade", (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, (socket) => {
      wsServer.emit("connection", socket, request);
    });
  });
  const fermerServeur = () => {
    wsServer.close();
    server.close();
    if (fermerConstellation) fermerConstellation();
  };
  return { fermerServeur, port };
};
