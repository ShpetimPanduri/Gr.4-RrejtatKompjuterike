import dgram from "dgram";
import readline from "readline";

const SERVER_PORT = 5000; 
const SERVER_HOST = "127.0.0.1"; 

const client = dgram.createSocket("udp4");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("Klienti është gati. Shtyp komandë për serverin:");
console.log("Për admin: /list, /read <file>, /STATS");
console.log("Për përdorues të zakonshëm: qdo mesazh tjetër.\n");

function sendMessage(msg) {
  client.send(msg, SERVER_PORT, SERVER_HOST);
}

client.on("message", (msg) => {
  console.log(`Përgjigje nga serveri:\n${msg.toString()}`);
  rl.prompt();
});

rl.setPrompt("> ");
rl.prompt();

rl.on("line", (input) => {
  const msg = input.trim();
  if (msg.length > 0) sendMessage(msg);
});