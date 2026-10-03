const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ===============================
// MongoDB Schema
// ===============================

const sensorSchema = new mongoose.Schema(
  {
    device_id: {
      type: String,
      required: true
    },

    soil_moisture: {
      type: Number,
      required: true
    },

    temperature: {
      type: Number,
      default: null
    },

    humidity: {
      type: Number,
      default: null
    },

    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

const SensorData = mongoose.model("SensorData", sensorSchema);

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart Soil Monitoring API is running"
  });
});

// ===============================
// HEALTH CHECK
// ===============================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    backend: "running",
    mongodb: mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected"
  });
});

// ===============================
// RECEIVE SENSOR DATA
// ===============================

app.post("/api/sensor-data", async (req, res) => {
  try {
    const {
      device_id,
      soil_moisture,
      temperature,
      humidity
    } = req.body;

    if (!device_id || soil_moisture === undefined) {
      return res.status(400).json({
        success: false,
        message: "device_id and soil_moisture are required"
      });
    }

    const record = await SensorData.create({
      device_id: device_id,
      soil_moisture: Number(soil_moisture),
      temperature:
        temperature === undefined || temperature === null
          ? null
          : Number(temperature),
      humidity:
        humidity === undefined || humidity === null
          ? null
          : Number(humidity)
    });

    console.log("Sensor data saved:", record);

    res.status(201).json({
      success: true,
      message: "Sensor data saved to MongoDB",
      data: record
    });

  } catch (error) {
    console.error("Sensor data error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save sensor data",
      error: error.message
    });
  }
});

// ===============================
// GET LATEST READING
// ===============================

app.get("/api/latest", async (req, res) => {
  try {
    const latest = await SensorData
      .findOne()
      .sort({ timestamp: -1 })
      .lean();

    res.json(latest || null);

  } catch (error) {
    console.error("Latest data error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch latest data"
    });
  }
});

// ===============================
// GET HISTORY
// ===============================

app.get("/api/history", async (req, res) => {
  try {
    const limit = Math.min(
      Number(req.query.limit) || 50,
      500
    );

    const history = await SensorData
      .find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json(history.reverse());

  } catch (error) {
    console.error("History error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch history"
    });
  }
});
// ===============================
// GET ML PREDICTION
// ===============================

app.get("/api/prediction", async (req, res) => {
  try {
    const latest = await SensorData
      .findOne()
      .sort({ timestamp: -1 })
      .lean();

    if (!latest) {
      return res.status(404).json({
        success: false,
        message: "No sensor data available"
      });
    }

    const predictionResponse = await axios.post(
      "http://127.0.0.1:8000/predict",
      {
        soil_moisture: latest.soil_moisture,
        temperature: latest.temperature ?? 0,
        humidity: latest.humidity ?? 0
      }
    );

    res.json({
      success: true,
      sensor_data: latest,
      prediction: predictionResponse.data
    });

  } catch (error) {
    console.error("Prediction error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to get ML prediction",
      error: error.message
    });
  }
});
// ===============================
// DELETE TEST DATA
// ===============================

app.delete("/api/test-data", async (req, res) => {
  try {
    const result = await SensorData.deleteMany({
      device_id: "ESP32_TEST"
    });

    res.json({
      success: true,
      message: "Test data deleted",
      deleted: result.deletedCount
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete test data"
    });
  }
});

// ===============================
// MONGODB + SERVER START
// ===============================

async function startServer() {
  try {
    console.log("Connecting to MongoDB...");

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully!");

    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
      console.log("");
      console.log("Available API endpoints:");
      console.log("GET  /");
      console.log("GET  /api/health");
      console.log("POST /api/sensor-data");
      console.log("GET  /api/latest");
      console.log("GET  /api/history");
console.log("GET  /api/prediction");
console.log("DELETE /api/test-data");
    });

  } catch (error) {
    console.error("MongoDB connection failed!");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();