// server-tcp-ws.js - TCP + WebSocket in ONE file (replaces server.js + bridge.js + client.js)
import { WebSocketServer } from "ws";
import fs from "fs";
import os from "os";

const WS_PORT = 8080;
const MAX_CLIENTS = 4;
const TIMEOUT = 120000; // 2 min

const wss = new WebSocketServer({ port: WS_PORT });
let clients = new Map(); // ws → data
let adminCount = 0;

console.log(`TCP-STYLE WebSocket server running on ws://localhost:${WS_PORT}`);
console.log(`Open browser-client.html → first user = ADMIN\n`);

// Stats logger
function logStats() {
  const active = Array.from(clients.entries())
    .map(([ws, data]) => `${data.role} - msgs: ${data.messages} - ${data.bytes} bytes`)
    .join("\n");

  const totalTraffic = Array.from(clients.values()).reduce((s, c) => s + c.bytes, 0);

  const stats = `
--- SERVER STATS ---
Active: ${clients.size}/${MAX_CLIENTS}
${active}
Total Traffic: ${totalTraffic} bytes
Uptime: ${(process.uptime() / 60).toFixed(1)} min
---`;
  console.log(stats);
  fs.writeFileSync("server_stats.txt", stats);
  return stats;
}

wss.on("connection", (ws) => {
  if (clients.size >= MAX_CLIENTS) {
    ws.close(1013, "Server full");
    return;
  }

  const isFirst = clients.size === 0;
  const role = isFirst ? "admin" : "reader";
  if (isFirst) adminCount++;

  const clientData = {
    role,
    messages: 0,
    bytes: 0,
    lastSeen: Date.now(),
    ip: ws._socket.remoteAddress || "unknown"
  };

  clients.set(ws, clientData);
  console.log(`New ${role.toUpperCase()} connected (${clients.size}/${MAX_CLIENTS})`);

  ws.send(isFirst
    ? "You are ADMIN! Use /list, /read <file>, /STATS"
    : "You are READER. Chat only. Admin is already connected.");

  // Admin commands
  ws.on("message", (data) => {
    const msg = data.toString().trim();
    if (!msg) return;

    clientData.lastSeen = Date.now();
    clientData.messages++;
    clientData.bytes += data.length;

    if (clientData.role === "admin" && msg.startsWith("/")) {
      if (msg === "/list") {
        const files = fs.readdirSync("./files").join(", ") || "empty";
        ws.send(`Files: ${files}`);
      }
      else if (msg.startsWith("/read ")) {
        const file = msg.split(" ")[1];
        try {
          const content = fs.readFileSync(`./files/${file}`, "utf8");
          ws.send(content.length > 1000 ? content.slice(0, 1000) + "\n... (truncated)" : content);
        } catch {
          ws.send("File not found or too big.");
        }
      }
      else if (msg === "/STATS") {
        ws.send(logStats());
      }
      else {
        ws.send("Unknown command. Use /list, /read file.txt, /STATS");
      }
    } else {
      // Broadcast to ALL clients (chat)
      const prefix = clientData.role === "admin" ? "[ADMIN]" : "[USER]";
      const broadcastMsg = `${prefix} ${msg}`;

      wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
          client.send(broadcastMsg);
        }
      });
    }
  });

  ws.on("close", () => {
    console.log(`${clientData.role} disconnected`);
    if (clientData.role === "admin") adminCount--;
    clients.delete(ws);
  });
});

// Timeout cleanup
setInterval(() => {
  const now = Date.now();
  for (const [ws, data] of clients) {
    if (now - data.lastSeen > TIMEOUT) {
      console.log(`Timeout: ${data.role} removed`);
      ws.close(1000, "Timeout");
    }
  }
}, 5000);

// Auto-stats every 30s
setInterval(logStats, 30000);