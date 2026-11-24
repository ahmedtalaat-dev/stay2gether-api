const mongoose = require ("mongoose");

let dbReady = false;

module.exports = {
  isDbConnected: function() {
    return dbReady && mongoose.connection.readyState === 1;
  },
}

module.exports.connectDatabase = async function() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.warn(
      "MONGODB_URI is not configured. Set MONGODB_URI in your environment secrets to enable database operations.",
    );
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    dbReady = true;
    console.log("Connected to MongoDB via Mongoose");
  } catch (err) {
    dbReady = false;
    console.error(
      "MongoDB connection failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
