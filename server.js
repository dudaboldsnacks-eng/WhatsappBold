import express from "express";
import makeWASocket, {
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";

import P from "pino";

const app = express();

app.use(express.json());

// =========================
// API KEY
// =========================
app.use((req, res, next) => {

  // libera rota inicial
  if (req.path === "/") {
    return next();
  }

  // DEBUG HEADERS
  console.log("HEADERS COMPLETOS:");
  console.log(req.headers);

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

// =========================
// CONECTAR WHATSAPP
// =========================
async function connectWhatsApp() {

  const { state, saveCreds } =
    await useMultiFileAuthState("auth");

  const { version } =
    await fetchLatestBaileysVersion();

  sock = makeWASocket({

    version,
    auth: state,
    logger: P({ level: "silent" }),

    browser: [
      "Chrome",
      "Desktop",
      "10.0"
    ]

  });

  // salva sessão
  sock.ev.on("creds.update", saveCreds);

  // atualizações conexão
  sock.ev.on(
    "connection.update",
    async ({
      connection,
      qr,
      lastDisconnect
    }) => {

      // =========================
      // QR CODE
      // =========================
      if (qr) {

        console.log("");
        console.log("ESCANEIE O QR CODE AGORA");
        console.log("");

      }

      // =========================
      // CONECTADO
      // =========================
      if (connection === "open") {

        console.log("");
        console.log("WHATSAPP CONECTADO");
        console.log("");

      }

      // =========================
      // DESCONECTOU
      // =========================
      if (connection === "close") {

        console.log("");
        console.log("RECONNECTANDO...");
        console.log("");

        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;

        if (shouldReconnect) {

          connectWhatsApp();

        }

      }

    }
  );

}

// inicia conexão
connectWhatsApp();

// =========================
// ENVIAR MENSAGEM
// =========================
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

// =========================
// TESTE API
// =========================
app.get("/", (req, res) => {

  res.send("API online");

});

// =========================
// INICIAR SERVIDOR
// =========================
app.listen(

  process.env.PORT || 3000,

  () => {

    console.log("");
    console.log("SERVIDOR ONLINE");
    console.log("");

  }

);
