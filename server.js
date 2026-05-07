const express = require("express");
const cors = require("cors");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const Pino = require("pino");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "boldapi";

let sock;
let connected = false;
let qrShown = false;

async function startWhatsApp() {

  const { state, saveCreds } =
    await useMultiFileAuthState("auth_info");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: Pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({
    connection,
    qr,
    lastDisconnect
  }) => {

    if (qr && !qrShown) {

      qrShown = true;

      console.log("");
      console.log("=================================");
      console.log("ESCANEIE O QR");
      console.log("=================================");
      console.log("");

      console.log(qr);

      console.log("");
      console.log("Cole o texto acima em:");
      console.log("https://www.qr-code-generator.com/");
      console.log("");

    }

    if (connection === "open") {

      connected = true;

      console.log("");
      console.log("WHATSAPP CONECTADO");
      console.log("");

    }

    if (connection === "close") {

  connected = false;

  console.log("");
  console.log("=================================");
  console.log("CONEXAO FECHADA");
  console.log("=================================");
  console.log("");

  const statusCode =
    lastDisconnect?.error?.output?.statusCode;

  console.log("STATUS:", statusCode);

  if (statusCode === DisconnectReason.loggedOut) {

    console.log("");
    console.log("WHATSAPP DESCONECTADO");
    console.log("APAGUE auth_info E ESCANEIE NOVAMENTE");
    console.log("");

    return;

  }

  console.log("");
  console.log("RECONectando em 5 segundos...");
  console.log("");

  qrShown = false;

  setTimeout(() => {
    startWhatsApp();
  }, 5000);

}

app.get("/", (req, res) => {

  res.json({
    status: "online",
    whatsapp: connected
  });

});

app.post("/notify", async (req, res) => {

  try {

    const receivedKey =
      req.headers["x-api-key"];

    console.log("HEADER RECEBIDO:", receivedKey);
    console.log("API_KEY RAILWAY:", API_KEY);

    if (receivedKey !== API_KEY) {

      return res.status(401).json({
        error: "api key invalida"
      });

    }

    const { phone, message } = req.body;

    if (!phone || !message) {

      return res.status(400).json({
        error: "phone e message obrigatorios"
      });

    }

    if (!connected) {

      return res.status(500).json({
        error: "whatsapp nao conectado"
      });

    }

    const number =
      phone.replace(/\D/g, "") +
      "@s.whatsapp.net";

    await sock.sendMessage(number, {
      text: message
    });

    console.log("MENSAGEM ENVIADA");

    res.json({
      success: true
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "erro interno"
    });

  }

});

app.listen(PORT, () => {

  console.log("");
  console.log("SERVIDOR ONLINE");
  console.log("");

});
