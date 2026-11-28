require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");

const authRoute = require("./routes/authRoute.js");
const mediaRoute = require("./routes/mediaRoute.js");
const messageRoute = require("./routes/messageRoute.js");
const notificationRoute = require("./routes/notificationRoute.js");
const postRoute = require("./routes/postRoute.js");
const userRoute = require("./routes/userRoute.js");

const { connectDatabase } = require("./config/db.js");
const { initWebSocketServer } = require("./utils/realtime.js");

const app = express();

// CORS configuration
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "2mb" }));

// API Routes
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api", postRoute);
app.use("/api/media", mediaRoute);
app.use("/api/notifications", notificationRoute);
app.use("/api/conversations", messageRoute);

// Express error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled server error:", err);

  res.status(500).json({
    error: "Internal server error.",
  });
});

const server = http.createServer(app);

// Initialize WebSocket
initWebSocketServer(server);

async function startServer() {

  const PORT = process.env.PORT || 5000;

  await connectDatabase();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Stay2Gether API server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

module.exports = { app, server };
