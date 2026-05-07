import express from "express";
import makeWASocket, {
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";

import QRCode from "qrcode";
import P from "pino";

const app = express();

app.use(express.json());

app.use((req, res, next) => {

  const apiKey = req.headers["x-api-key"];

  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      error: "API KEY inválida"
    });
  }

  next();

});

let sock;

async function connectWhatsApp() {

  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Chrome", "Desktop", "10.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, qr, lastDisconnect }) => {

    if (qr) {

      console.log("========== QR CODE ==========");

      const qrText = await QRCode.toString(qr, {
        type: "terminal",
        small: true
      });

      console.log(qrText);

    }

    if (connection === "open") {
      console.log("WHATSAPP CONECTADO");
    }

    if (connection === "close") {

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log("CONEXÃO FECHADA");

      if (shouldReconnect) {
        connectWhatsApp();
      }

    }

  });

}

connectWhatsApp();

app.post("/notify", async (req, res) => {

  try {

    const { phone, message } = req.body;

    if (!sock) {
      return res.status(500).json({
        error: "WhatsApp não conectado"
      });
    }

    await sock.sendMessage(
      `${phone}@s.whatsapp.net`,
      {
        text: message
      }
    );

    res.json({
      success: true
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: error.message
    });

  }

});

app.get("/", (req, res) => {
  res.send("API online");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("SERVIDOR ONLINE");
});
