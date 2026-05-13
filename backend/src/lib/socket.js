const { Server } = require("socket.io");

let io;

function init(server) {
  io = new Server(server, {
    cors: {
      origin: "*", // Simplificado para dev, em prod usar allowedOrigins
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log(`[WS] Novo cliente conectado: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`[WS] Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io não inicializado!");
  }
  return io;
}

// Helper para emitir eventos de forma segura
function emit(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

module.exports = { init, getIO, emit };
