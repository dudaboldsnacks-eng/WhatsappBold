import express from "express";
import cors from "cors";
import pino from "pino";
import qrcode from "qrcode-terminal";
import fs from "fs";

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

console.log("API_KEY =", process.env.API_KEY);

let sock;
let currentQr = null;
let connected = false;
let reconnecting = false;

async function clearAuthFolder() {
  try {
    if (fs.existsSync("./auth")) {
      fs.rmSync("./auth", {
        recursive: true,
        force: true
      });
    }
  } catch (err) {
    console.log("ERRO AO LIMPAR AUTH:", err.message);
  }
}

async function startWhatsApp() {

  try {

    const { state, saveCreds } =
      await useMultiFileAuthState("auth2");

    const { version } =
      await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {

      const {
        connection,
        qr,
        lastDisconnect
      } = update;

      if (qr && !connected) {

  currentQr = qr;

  console.log("");
  console.log("=================================");
  console.log("QR CODE TEXTO");
  console.log("=================================");
  console.log("");
  console.log(qr);
  console.log("");
}

      if (connection === "open") {

        connected = true;
        reconnecting = false;

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

        if (reconnecting) return;

        reconnecting = true;

        if (
          statusCode === DisconnectReason.loggedOut ||
          statusCode === 401 ||
          statusCode === 405
        ) {

          console.log("SESSAO INVALIDA");
          console.log("LIMPANDO AUTH...");

          await clearAuthFolder();
        }

        console.log("REINICIANDO EM 5 SEGUNDOS...");

        setTimeout(() => {
          reconnecting = false;
          startWhatsApp();
        }, 5000);
      }
    });

  } catch (err) {

    console.log("");
    console.log("=================================");
    console.log("ERRO GERAL");
    console.log("=================================");
    console.log(err);
    console.log("");

    setTimeout(() => {
      startWhatsApp();
    }, 5000);
  }
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

app.get("/debug", (req, res) => {

  const receivedHeader =
    req.headers["apikey"] ||
    req.headers["api_key"] ||
    req.headers["authorization"] ||
    "nenhum";

  res.json({
    HEADER_RECEBIDO: receivedHeader,
    API_KEY_RAILWAY: process.env.API_KEY || "não definida",
    HEADERS_COMPLETOS: req.headers
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
