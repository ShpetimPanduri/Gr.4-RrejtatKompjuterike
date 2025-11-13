// server.js - SERVER SKEDARËSH ME WEBSOCKET (në shqip)
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";

const wss = new WebSocketServer({ port: 8080 });
const FILES_DIR = "./files";
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR);

let adminAssigned = false;
const clients = new Map();

console.log("Serveri është gati → ws://localhost:8080");
console.log("Hap index.html në shfletues → tab-i i parë bëhet admin\n");

wss.on("connection", (ws) => {
  if (clients.size >= 4) {
    ws.close(1013, "Serveri është plot. Provo më vonë.");
    return;
  }

  const isAdmin = !adminAssigned;
  if (isAdmin) adminAssigned = true;

  clients.set(ws, { role: isAdmin ? "admin" : "lexues", lastSeen: Date.now() });

  ws.send(
    isAdmin
      ? "Ti je admin! Komandat: /list | /upload <emri> | /download <emri> | /delete <emri>"
      : "Ti je user. Prit derisa admini të ngarkojë skedarë."
  );

  const sendList = () => {
    const files = fs.readdirSync(FILES_DIR).map((f) => {
      const stats = fs.statSync(path.join(FILES_DIR, f));
      const madhesia = (stats.size / 1024).toFixed(1);
      return `${f} (${madhesia} KB)`;
    });
    const lista = files.length > 0 ? files.join(" | ") : "Skedar bosh";
    wss.clients.forEach(
      (c) => c.readyState === 1 && c.send(`Skedarët: ${lista}`)
    );
  };

  ws.on("message", async (data) => {
    const msg = data.toString().trim();
    const client = clients.get(ws);
    client.lastSeen = Date.now();

    if (client.role !== "admin") {
      ws.send("Vetëm admini mund të përdorë komandat!");
      return;
    }

    if (msg === "/list") {
      sendList();
    } else if (msg.startsWith("/upload ")) {
      const filename = msg.slice(8).trim();
      if (!filename) {
        ws.send("Përdorimi: /upload emri_skeda.txt");
        return;
      }
      ws.send(
        `Gati për ngarkim: "${filename}". Tërhiq skedarin këtu ose kliko poshtë.`
      );
      ws.waitingForFile = { name: filename };
    } else if (msg.startsWith("/download ")) {
      const filename = msg.slice(10).trim();
      const filePath = path.join(FILES_DIR, filename);
      if (!fs.existsSync(filePath)) {
        ws.send("Skedari nuk u gjet!");
        return;
      }

      const fileData = fs.readFileSync(filePath);
      const base64 = fileData.toString("base64");
      const mime = filename.endsWith(".png")
        ? "image/png"
        : filename.endsWith(".jpg") || filename.endsWith(".jpeg")
        ? "image/jpeg"
        : filename.endsWith(".pdf")
        ? "application/pdf"
        : filename.endsWith(".zip")
        ? "application/zip"
        : filename.endsWith(".mp4")
        ? "video/mp4"
        : "application/octet-stream";

      ws.send(
        JSON.stringify({
          type: "download",
          filename,
          data: base64,
          mime,
        })
      );
      ws.send(`Po shkarkohet: ${filename}`);
    } else if (msg.startsWith("/delete ")) {
      const filename = msg.slice(8).trim();
      const filePath = path.join(FILES_DIR, filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        ws.send(`U fshi me sukses: ${filename}`);
        sendList();
      } else {
        ws.send("Skedari nuk u gjet për fshirje!");
      }
    } else if (msg.startsWith("/search ")) {
      const keyword = msg.slice(8).trim().toLowerCase();
      if (!keyword) {
        ws.send("Përdorimi: /search <fjalë_kyçe>");
        return;
      }

      const files = fs.readdirSync(FILES_DIR);
      const results = files.filter((f) => f.toLowerCase().includes(keyword));

      if (results.length > 0) {
        ws.send(` File-at që përmbajnë '${keyword}':\n` + results.join("\n"));
      } else {
        ws.send(` Asnjë file nuk përmban fjalën '${keyword}'.`);
      }
    } else if (msg.startsWith("/info ")) {
    const filename = msg.slice(6).trim();

    if (!filename) {
        ws.send("Usage: /info <filename>");
        return;
    }

    if (!fs.existsSync(filePath)) {
        ws.send("Error: File does not exist!");
        return;
    }

    const stats = fs.statSync(filePath);

    const infoTxt =
        `INFO for '${filename}':\n` +
        `• Size: ${stats.size} bytes\n` +
        `• Created: ${stats.birthtime}\n` +
        `• Last modified: ${stats.mtime}\n`;

    ws.send(infoTxt);

    } else if (ws.waitingForFile && data instanceof Buffer) {
      const { name } = ws.waitingForFile;
      const safeName = path.basename(name);
      fs.writeFileSync(path.join(FILES_DIR, safeName), data);
      ws.send(`U ngarkua me sukses: ${safeName}`);
      delete ws.waitingForFile;
      sendList();
    } else if (msg.startsWith("/")) {
      ws.send("Komandë e panjohur. Provo: /list, /upload, /download, /delete");
    } else {
      wss.clients.forEach(
        (c) => c.readyState === 1 && c.send(`[ADMIN] ${msg}`)
      );
    }
  });

  ws.on("close", () => {
    if (clients.get(ws)?.role === "admin") adminAssigned = false;
    clients.delete(ws);
    console.log("Një klient u shkëput.");
  });
});

// Largimi automatik pas 2 minutash pa aktivitet
setInterval(() => {
  const now = Date.now();
  for (const [ws, data] of clients) {
    if (now - data.lastSeen > 120000) {
      ws.close(1000, "Timeout: 2 minuta pa aktivitet");
    }
  }
}, 5000);

sendList(); // Lista fillestare
