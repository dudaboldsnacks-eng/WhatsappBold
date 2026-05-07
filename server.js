import express from "express";
import makeWASocket, {
  useMultiFileAuthState
} from "@whiskeysockets/baileys";

import QRCode from "qrcode";

const app = express();

app.use(express.json());

app.use((req, res, next) => {

  const apiKey = req.headers["x-api-key"];

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

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, qr }) => {

    if (qr) {

      console.log("ESCANEIE O QR:");

      const qrImage = await QRCode.toString(qr, {
        type: "terminal",
        small: true
      });

      console.log(qrImage);

    }

    if (connection === "open") {
      console.log("WHATSAPP CONECTADO");
    }

    if (connection === "close") {

      console.log("RECONNECTANDO...");

      connectWhatsApp();

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
