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

  // libera rota principal sem API KEY
  if (req.path === "/") {
    return next();
  }

  const apiKey = req.headers["x-api-key"];

  // DEBUG
  console.log("HEADER RECEBIDO:", apiKey);
  console.log("API_KEY RAILWAY:", process.env.API_KEY);

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
    browser: ["Chrome", "Desktop", "10.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, qr, lastDisconnect }) => {

    // QR CODE ORIGINAL
    if (qr) {

      console.log("QR GERADO");

      const qrImage = await QRCode.toDataURL(qr);

      console.log(qrImage);

    }

    // conectado
    if (connection === "open") {
      console.log("WHATSAPP CONECTADO");
    }

    // desconectado
    if (connection === "close") {

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect) {
        connectWhatsApp();
      }

    }

  });

}

connectWhatsApp();

// rota enviar mensagem
app.post("/notify", async (req, res) => {

  try {

    const { phone, message } = req.body;

    if (!phone || !message) {

      return res.status(400).json({
        error: "phone e message são obrigatórios"
      });

    }

    await sock.sendMessage(
      `${phone}@s.whatsapp.net`,
      {
        text: message
      }
    );

    res.json({
      success: true,
      message: "Mensagem enviada"
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: error.message
    });

  }

});

// rota principal
app.get("/", (req, res) => {

  res.send("API online");

});

// iniciar servidor
app.listen(process.env.PORT || 3000, () => {

  console.log("SERVIDOR ONLINE");

});
