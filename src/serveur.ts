
import express from "express";
import ws from "ws";

import ipa from "./ipa";

export default (port?: number) => {
  port = port || 5000;

  const app = express();
  // https://masteringjs.io/tutorials/express/websockets

  const wsServer = new ws.Server({ noServer: true });
  ipa(wsServer)

  // `server` is a vanilla Node.js HTTP server, so use
  // the same ws upgrade process described here:
  // https://www.npmjs.com/package/ws#multiple-servers-sharing-a-single-https-server
  const server = app.listen(port);
  server.on('upgrade', (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, socket => {
      wsServer.emit('connection', socket, request);
    });
  });
}
