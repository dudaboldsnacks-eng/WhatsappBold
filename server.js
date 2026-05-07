import express from "express";
import cors from "cors";
import pino from "pino";
import qrcode from "qrcode-terminal";

import {
  default as makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

let sock = null;
let currentQr = null;
let connected = false;

async function startWhatsApp() {

  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Chrome", "Desktop", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {

    const { connection, qr, lastDisconnect } = update;

    if (qr) {

      currentQr = qr;

      console.log("");
      console.log("=================================");
      console.log("ESCANEIE O QR CODE");
      console.log("=================================");
      console.log("");

      qrcode.generate(qr, {
        small: true
      });
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

      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      console.log("");
      console.log("=================================");
      console.log("CONEXAO FECHADA");
      console.log("STATUS:", statusCode);
      console.log("=================================");
      console.log("");

      if (
        statusCode === DisconnectReason.loggedOut ||
        statusCode === 401 ||
        statusCode === 405
      ) {

        console.log("SESSAO INVALIDA");
        console.log("APAGANDO AUTH...");

        const fs = await import("fs");

        if (fs.existsSync("./auth")) {
          fs.rmSync("./auth", {
            recursive: true,
            force: true
          });
        }

        console.log("REINICIANDO LIMPO...");

        setTimeout(() => {
          startWhatsApp();
        }, 5000);

        return;
      }

      console.log("RECONectando em 5 segundos...");

      setTimeout(() => {
        startWhatsApp();
      }, 5000);
    }
  });
}

app.get("/", (req, res) => {

  const receivedHeader =
    req.headers["apikey"] ||
    req.headers["api_key"] ||
    req.headers["authorization"] ||
    "nenhum";

  res.json({
    status: "online",
    connected,
    qr: currentQr ? true : false,
    header_recebido: receivedHeader,
    api_key_railway: process.env.API_KEY || "não definida"
  });
});

app.listen(PORT, () => {

  console.log("");
  console.log("=================================");
  console.log("SERVIDOR ONLINE");
  console.log("PORTA:", PORT);
  console.log("=================================");
  console.log("");

  startWhatsApp();
});
