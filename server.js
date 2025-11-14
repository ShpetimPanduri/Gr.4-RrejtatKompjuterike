// server.js - LEXUES: VETËM /read | ADMIN: TË GJITHA | Bytes + KB
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import os from "os";

const PORT = 8080;
const HOST = "0.0.0.0";
const FILES_DIR = "./files";
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR);

const wss = new WebSocketServer({ port: PORT, host: HOST });
let adminAssigned = false;
const clients = new Map();

console.log(`Serveri aktiv në ws://${getLocalIP()}:${PORT}`);
console.log("Hap index.html → Tab-i i parë = ADMIN\n");

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

// === FORMATIMI I MADHËSISË ===
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// === LISTA E SKEDARËVE (vetëm për Admin) ===
const sendList = (ws) => {
  const txtFiles = fs.readdirSync(FILES_DIR).filter(f => f.endsWith(".txt"));
  const files = txtFiles.map(f => {
    const stats = fs.statSync(path.join(FILES_DIR, f));
    return `${f} (${formatSize(stats.size)})`;
  });
  const lista = files.length > 0 ? files.join(" | ") : "bosh";
  ws.send(`Skedarët (.txt): ${lista}`);
};

wss.on("connection", (ws, req) => {
  if (clients.size >= 4) {
    ws.close(1013, "Serveri plot.");
    return;
  }

  const isAdmin = !adminAssigned;
  if (isAdmin) adminAssigned = true;

  clients.set(ws, {
    role: isAdmin ? "admin" : "lexues",
    lastSeen: Date.now()
  });

  ws.send(isAdmin
    ? "ADMIN:1"  // Përdorim kod për UI
    : "LEXUES:0" // Përdorim kod për UI
  );

  if (isAdmin) sendList(ws);

  ws.on("message", (data) => {
    const client = clients.get(ws);
    client.lastSeen = Date.now();
    const msg = data.toString().trim();

    // === LEXUESIT: VETËM /read ===
    if (client.role === "lexues") {
      if (msg.startsWith("/read ")) {
        const filename = msg.slice(6).trim();
        if (!filename.endsWith(".txt")) {
          ws.send("Gabim: Vetëm skedarë .txt lejohen.");
          return;
        }
        const filePath = path.join(FILES_DIR, filename);
        if (fs.existsSync(filePath) && fs.statSync(filePath).size < 100 * 1024) {
          const content = fs.readFileSync(filePath, "utf8");
          ws.send(`Përmbajtja e ${filename}:\n${content}`);
        } else if (fs.existsSync(filePath)) {
          ws.send(`Skedari ${filename} është shumë i madh (>100KB).`);
        } else {
          ws.send("Skedari nuk u gjet.");
        }
      } else {
        ws.send("LEXUES: Vetëm /read <emri.txt> lejohet.");
      }
      return;
    }

    // === ADMINI: TË GJITHA ===
    if (msg === "/list") {
      sendList(ws);
    } else if (msg.startsWith("/read ")) {
      const filename = msg.slice(6).trim();
      if (!filename.endsWith(".txt")) return ws.send("Vetëm .txt lejohen.");
      const filePath = path.join(FILES_DIR, filename);
      if (fs.existsSync(filePath) && fs.statSync(filePath).size < 100 * 1024) {
        const content = fs.readFileSync(filePath, "utf8");
        ws.send(`Përmbajtja e ${filename}:\n${content}`);
      } else {
        ws.send("Skedari është shumë i madh ose nuk u gjet.");
      }
    } else if (msg.startsWith("/upload ")) {
      const filename = msg.slice(8).trim();
      if (!filename.endsWith(".txt")) return ws.send("Vetëm .txt lejohen!");
      ws.send(`Gati për ngarkim: "${filename}"`);
      ws.waitingForFile = { name: filename };
    } else if (msg.startsWith("/download ")) {
      const filename = msg.slice(10).trim();
      if (!filename.endsWith(".txt")) return ws.send("Vetëm .txt mund të shkarkohen.");
      const filePath = path.join(FILES_DIR, filename);
      if (!fs.existsSync(filePath)) return ws.send("Skedari nuk u gjet!");
      const fileData = fs.readFileSync(filePath);
      const base64 = fileData.toString("base64");
      ws.send(JSON.stringify({ type: "download", filename, data: base64, mime: "text/plain" }));
      ws.send(`Shkarkimi filloi: ${filename}`);
    } else if (msg.startsWith("/delete ")) {
      const filename = msg.slice(8).trim();
      if (!filename.endsWith(".txt")) return ws.send("Vetëm .txt mund të fshihen.");
      const filePath = path.join(FILES_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        ws.send(`U fshi: ${filename}`);
      } else {
        ws.send("Skedari nuk u gjet.");
      }
    } else if (msg.startsWith("/search ")) {
      const keyword = msg.slice(8).trim().toLowerCase();
      const matches = fs.readdirSync(FILES_DIR)
        .filter(f => f.endsWith(".txt") && f.toLowerCase().includes(keyword));
      ws.send(matches.length > 0
        ? `Rezultatet: ${matches.join(", ")}`
        : `Asnjë .txt nuk përmban "${keyword}"`);
    } else if (msg.startsWith("/info ")) {
      const filename = msg.slice(6).trim();
      if (!filename.endsWith(".txt")) return ws.send("Vetëm .txt kanë info.");
      const filePath = path.join(FILES_DIR, filename);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        ws.send(`Info për ${filename}:\nMadhësia: ${formatSize(stats.size)}\nKrijuar: ${stats.birthtime.toLocaleString("sq-AL")}\nModifikuar: ${stats.mtime.toLocaleString("sq-AL")}`);
      } else {
        ws.send("Skedari nuk u gjet.");
      }
    } else if (ws.waitingForFile && data instanceof Buffer) {
      const { name } = ws.waitingForFile;
      if (!name.endsWith(".txt")) {
        ws.send("Gabim: Vetëm .txt lejohen!");
        delete ws.waitingForFile;
        return;
      }
      const safeName = path.basename(name);
      fs.writeFileSync(path.join(FILES_DIR, safeName), data);
      ws.send(`U ngarkua: ${safeName}`);
      delete ws.waitingForFile;
    } else {
      ws.send(`[ADMIN] ${msg}`);
    }
  });

  ws.on("close", () => {
    if (clients.get(ws)?.role === "admin") adminAssigned = false;
    clients.delete(ws);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [ws, data] of clients) {
    if (now - data.lastSeen > 120000) ws.close(1000, "Timeout");
  }
}, 5000);