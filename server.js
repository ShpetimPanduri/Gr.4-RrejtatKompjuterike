import dgram from "dgram";
import fs from "fs";
import os from "os";

const PORT = 5000; 
const HOST = "0.0.0.0"; 
const MAX_CLIENTS = 4;   //maksimumi 4 klient
const TIMEOUT = 120000;   //120 sekonda

const server = dgram.createSocket("udp4");
let clients = {}; 

// funksioni per kthim te statistikave
function logStats() {
  const activeClients = Object.entries(clients)
    .map(([key, data]) => `${key} (${data.role}) - mesazhe: ${data.messages}, bytes: ${data.bytes}`)
    .join(os.EOL);

  const totalTraffic = Object.values(clients).reduce((sum, c) => sum + c.bytes, 0);

  const logData = `
--- SERVER STATS ---
Active clients: ${Object.keys(clients).length}
Clients: 
${activeClients}
Total Traffic: ${totalTraffic} bytes
--------------------
`;

  console.log(logData); 
  fs.writeFileSync("server_stats.txt", logData);

  return logData; 
}

server.on("message", (msg, rinfo) => {
  const clientKey = `${rinfo.address}:${rinfo.port}`;
  const message = msg.toString().trim();

  //kushti per maksimumin e klienteve
  if (!clients[clientKey]) {
    if (Object.keys(clients).length >= MAX_CLIENTS) {
      server.send("Server full. Try again later.", rinfo.port, rinfo.address);
      return;
    }

    clients[clientKey] = {
      port: rinfo.port,
      lastSeen: Date.now(),
      messages: 0,
      bytes: 0,
      role: Object.keys(clients).length === 0 ? "admin" : "reader", // vetem klienti i pare admin
    };
    console.log(`Klient i ri: ${clientKey} (${clients[clientKey].role})`);
  }

  //update i statistikave
  clients[clientKey].lastSeen = Date.now();
  clients[clientKey].messages++;
  clients[clientKey].bytes += Buffer.byteLength(msg);

  //komandat per klientin admin
  if (clients[clientKey].role === "admin" && message.startsWith("/")) {
    if (message === "/list") {
      const files = fs.readdirSync("./files").join(", ");
      server.send(`Files: ${files}`, rinfo.port, rinfo.address);
    } else if (message.startsWith("/read ")) {
      const file = message.split(" ")[1];
      try {
        const content = fs.readFileSync(`./files/${file}`, "utf8");
        server.send(content, rinfo.port, rinfo.address);
      } catch {
        server.send("File not found.", rinfo.port, rinfo.address);
      }
    } else if (message === "/STATS") {
      const statsMsg = logStats();
      server.send(statsMsg, rinfo.port, rinfo.address);
    } else {
      server.send("Unknown command.", rinfo.port, rinfo.address);
    }
  } else {
    //klient i zakonshem (vetem read)
    server.send(`Server mori: "${message}"`, rinfo.port, rinfo.address);
  }
});

server.bind(PORT, HOST, () => {
  console.log(`Server UDP aktiv ne ${HOST}:${PORT}`);
});

//kontrolli per timeout
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of Object.entries(clients)) {
    if (now - data.lastSeen > TIMEOUT) {
      console.log(`Klienti ${key} u shkeput (timeout)`);
      delete clients[key];
    }
  }
}, 5000);