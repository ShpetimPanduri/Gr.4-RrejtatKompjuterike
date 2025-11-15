import dgram from "dgram";
import readline from "readline";
import fs from "fs";

const SERVER_PORT = 5000;
const SERVER_HOST = "127.0.0.1";

const client = dgram.createSocket("udp4");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
}); 
const downloadsDir = "./downloads";

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

console.log("Klienti është gati. Shtyp komandë për serverin:");
console.log("Komandat e adminit:");
console.log("/list - liston file-t");
console.log("/read <file> - lexon file");
console.log("/upload <file> - dërgon file në server");
console.log("/download <file> - shkarkon file nga serveri");
console.log("/delete <file> - fshin file");
console.log("/search <keyword> - kerkon files sipas emrit");
console.log("/info <file> - informata per files");
console.log("/STATS - te dhenat e trafikut \n");
console.log("Përdorues i zakonshëm: çdo mesazh tjetër.\n");

function sendMessage(msg) {
  client.send(msg, SERVER_PORT, SERVER_HOST);
}

client.on("message", (msg) => {
  const text = msg.toString();

 if (text.startsWith("FILE_DATA ")) {
  const parts = text.split(" ");
  const filename = parts[1];
  const content = parts.slice(2).join(" ");

  const filePath = `${downloadsDir}/${filename}`;
  fs.writeFileSync(filePath, content);

  console.log(`File '${filename}' u shkarkua me sukses në ${filePath}!\n`);
  rl.prompt();
  return;
}

  console.log(`Përgjigje nga serveri:\n${text}`);
  rl.prompt();
});

rl.setPrompt("> ");
rl.prompt();

rl.on("line", (input) => {
  const msg = input.trim();
  if (!msg.length) return;

 if (msg.startsWith("/upload ")) {
  const filename = msg.split(" ")[1];

  if (!fs.existsSync(filename)) {
    console.log("File nuk ekziston në diskun lokal.");
    rl.prompt();
    return;
  }

  const content = fs.readFileSync(filename, "utf8");
  sendMessage(`/upload ${filename} ${content}`);
  return;
}

  if (msg.startsWith("/download ")) {
    sendMessage(msg);
    return;
  }

  // per komandat tjera(te cilat i menaxhon serveri) 
  sendMessage(msg);
});