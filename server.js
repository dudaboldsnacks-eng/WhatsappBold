const express = require("express");
const cors = require("cors");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const P = require("pino");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const API_KEY = process.env.API_KEY || "boldapi";

let sock;
let qrShown = false;
let connected = false;

async function startWhatsApp() {

  const { state, saveCreds } =
    await useMultiFileAuthState("auth");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" })
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
      console.log("ESCANEIE O QR CODE");
      console.log("=================================");
      console.log("");

      console.log(qr);

      console.log("");
      console.log("Cole esse texto em:");
      console.log("https://www.qr-code-generator.com/");
      console.log("");
      console.log("Escolha: TEXT");
      console.log("");

    }

    if (connection === "open") {

      connected = true;

      console.log("");
      console.log("=================================");
      console.log("WHATSAPP CONECTADO");
      console.log("=================================");
      console.log("");

    }

    if (connection === "close") {

      connected = false;

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("");
      console.log("CONEXÃO FECHADA");
      console.log("");

      if (shouldReconnect) {

        console.log("RECONectando...");
        qrShown = false;

        setTimeout(() => {
          startWhatsApp();
        }, 5000);

      }

    }

  });

}

startWhatsApp();

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

    console.log("");
    console.log("HEADER RECEBIDO:", receivedKey);
    console.log("API_KEY RAILWAY:", API_KEY);
    console.log("");

    if (receivedKey !== API_KEY) {

      return res.status(401).json({
        error: "API KEY INVALIDA"
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
      phone.replace(/\D/g, "") + "@s.whatsapp.net";

    await sock.sendMessage(number, {
      text: message
    });

    console.log("");
    console.log("MENSAGEM ENVIADA");
    console.log("PARA:", phone);
    console.log("");

    res.json({
      success: true
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "erro ao enviar mensagem"
    });

  }

});

app.listen(PORT, () => {

  console.log("");
  console.log("=================================");
  console.log("SERVIDOR ONLINE");
  console.log("PORTA:", PORT);
  console.log("=================================");
  console.log("");

});
