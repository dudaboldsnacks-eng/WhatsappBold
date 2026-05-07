const express = require("express");
const cors = require("cors");
const {
  default: makeWASocket,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");

const Pino = require("pino");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "boldapi";

let sock = null;
let connected = false;
let qrShown = false;
let reconnecting = false;

async function startWhatsApp() {

  try {

    const { state, saveCreds } =
      await useMultiFileAuthState("auth_info");

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: Pino({ level: "silent" }),
      browser: ["Chrome", "Desktop", "1.0.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({
      connection,
      qr,
      lastDisconnect
    }) => {

      try {

        // QR CODE APENAS UMA VEZ
        if (qr && !qrShown) {

          qrShown = true;

          console.log("");
          console.log("=================================");
          console.log("ESCANEIE O QR CODE");
          console.log("=================================");
          console.log("");

          // QR CURTO
          console.log(qr);

          console.log("");
          console.log("Cole o texto acima em:");
          console.log("https://www.qr-code-generator.com/");
          console.log("Tipo: TEXT");
          console.log("");

        }

        // CONECTADO
        if (connection === "open") {

          connected = true;
          reconnecting = false;

          console.log("");
          console.log("=================================");
          console.log("WHATSAPP CONECTADO");
          console.log("=================================");
          console.log("");

        }

        // DESCONECTOU
        if (connection === "close") {

          connected = false;

          console.log("");
          console.log("=================================");
          console.log("CONEXAO FECHADA");
          console.log("=================================");
          console.log("");

          console.log(lastDisconnect || "SEM DETALHES");

          // EVITA LOOP INFINITO
          if (!reconnecting) {

            reconnecting = true;

            console.log("");
            console.log("RECONectando em 5 segundos...");
            console.log("");

            setTimeout(() => {

              qrShown = false;
              reconnecting = false;

              startWhatsApp();

            }, 5000);

          }

        }

      } catch (err) {

        console.log("");
        console.log("ERRO connection.update");
        console.log(err);
        console.log("");

      }

    });

  } catch (err) {

    console.log("");
    console.log("ERRO startWhatsApp");
    console.log(err);
    console.log("");

    setTimeout(() => {
      startWhatsApp();
    }, 5000);

  }

}

startWhatsApp();

// STATUS
app.get("/", (req, res) => {

  res.json({
    status: "online",
    whatsapp: connected
  });

});

// ENVIAR MENSAGEM
app.post("/notify", async (req, res) => {

  try {

    const receivedKey =
      req.headers["x-api-key"];

    // LOGS IMPORTANTES
    console.log("");
    console.log("HEADER RECEBIDO:", receivedKey);
    console.log("API_KEY RAILWAY:", API_KEY);
    console.log("");

    // VALIDA API KEY
    if (receivedKey !== API_KEY) {

      return res.status(401).json({
        error: "api key invalida"
      });

    }

    const { phone, message } = req.body;

    // VALIDA DADOS
    if (!phone || !message) {

      return res.status(400).json({
        error: "phone e message obrigatorios"
      });

    }

    // WHATSAPP OFFLINE
    if (!connected || !sock) {

      return res.status(500).json({
        error: "whatsapp nao conectado"
      });

    }

    // FORMATA NUMERO
    const number =
      phone.replace(/\D/g, "") +
      "@s.whatsapp.net";

    // ENVIA
    await sock.sendMessage(number, {
      text: message
    });

    console.log("");
    console.log("=================================");
    console.log("MENSAGEM ENVIADA");
    console.log("PARA:", phone);
    console.log("=================================");
    console.log("");

    res.json({
      success: true
    });

  } catch (err) {

    console.log("");
    console.log("ERRO AO ENVIAR");
    console.log(err);
    console.log("");

    res.status(500).json({
      error: "erro interno"
    });

  }

});

// START SERVIDOR
app.listen(PORT, () => {

  console.log("");
  console.log("=================================");
  console.log("SERVIDOR ONLINE");
  console.log("PORTA:", PORT);
  console.log("=================================");
  console.log("");

});
