require("dotenv/config");
const express = require("express");
const http = require("http");
const { connectDatabase } = require("./config/db");

const authRoute = require("./routes/authRoute");
const userRoute = require("./routes/userRoute");

const app = express();

// Middleware
app.use(express.json({ limit: "2mb" }));

// API Routes
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);

// Health Check
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server is running",
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);

  res.status(500).json({
    error: "Internal server error.",
  });
});

// HTTP Server
const server = http.createServer(app);

// Start Server
async function startServer() {
  const PORT = Number(process.env.PORT) || 5000;

  try {
    await connectDatabase();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Stay2Gether API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
