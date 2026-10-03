const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());

// =====================================================
// MONGODB SCHEMA
// =====================================================

const sensorSchema = new mongoose.Schema(
  {
    device_id: {
      type: String,
      required: true,
      trim: true
    },

    soil_moisture: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },

    temperature: {
      type: Number,
      default: null
    },

    humidity: {
      type: Number,
      default: null,
      min: 0,
      max: 100
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

const SensorData = mongoose.model(
  "SensorData",
  sensorSchema
);

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart Irrigation & Plant Monitoring API",
    backend: "running",
    port: PORT
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,

    backend: "running",

    mongodb:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",

    ml_api: "http://127.0.0.1:8000",

    esp32_endpoint:
      `http://YOUR_PC_IP:${PORT}/api/sensor-data`
  });
});

// =====================================================
// RECEIVE SENSOR DATA FROM ESP32
// =====================================================

app.post("/api/sensor-data", async (req, res) => {
  try {
    const {
      device_id,
      soil_moisture,
      temperature,
      humidity
    } = req.body;

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (!device_id) {
      return res.status(400).json({
        success: false,
        message: "device_id is required"
      });
    }

    if (soil_moisture === undefined) {
      return res.status(400).json({
        success: false,
        message: "soil_moisture is required"
      });
    }

    const moisture = Number(soil_moisture);

    if (
      Number.isNaN(moisture) ||
      moisture < 0 ||
      moisture > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "soil_moisture must be a number between 0 and 100"
      });
    }

    // -------------------------------------------------
    // CREATE DATABASE RECORD
    // -------------------------------------------------

    const record = await SensorData.create({
      device_id: device_id,

      soil_moisture: moisture,

      temperature:
        temperature === undefined ||
        temperature === null
          ? null
          : Number(temperature),

      humidity:
        humidity === undefined ||
        humidity === null
          ? null
          : Number(humidity)
    });

    // -------------------------------------------------
    // CONSOLE LOG
    // -------------------------------------------------

    console.log("");
    console.log("=================================");
    console.log("REAL ESP32 SENSOR DATA RECEIVED");
    console.log("=================================");

    console.log(
      `Device      : ${record.device_id}`
    );

    console.log(
      `Soil        : ${record.soil_moisture}%`
    );

    console.log(
      `Temperature : ${record.temperature ?? "--"} °C`
    );

    console.log(
      `Humidity    : ${record.humidity ?? "--"}%`
    );

    console.log(
      `Time        : ${record.timestamp}`
    );

    console.log("=================================");
    console.log("");

    // -------------------------------------------------
    // RESPONSE TO ESP32
    // -------------------------------------------------

    res.status(201).json({
      success: true,

      message:
        "Sensor data received and saved successfully",

      data: record
    });

  } catch (error) {

    console.error(
      "Sensor data error:",
      error.message
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to save sensor data",

      error: error.message
    });
  }
});

// =====================================================
// GET LATEST SENSOR READING
// =====================================================

app.get("/api/latest", async (req, res) => {
  try {

    const latest =
      await SensorData
        .findOne()
        .sort({
          timestamp: -1
        })
        .lean();

    if (!latest) {
      return res.json(null);
    }

    res.json(latest);

  } catch (error) {

    console.error(
      "Latest data error:",
      error.message
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to fetch latest sensor data",

      error: error.message
    });
  }
});

// =====================================================
// GET SENSOR HISTORY
// =====================================================

app.get("/api/history", async (req, res) => {
  try {

    let limit =
      Number(req.query.limit) || 50;

    // Prevent extremely large requests
    limit = Math.min(
      Math.max(limit, 1),
      500
    );

    const history =
      await SensorData
        .find()
        .sort({
          timestamp: -1
        })
        .limit(limit)
        .lean();

    // Return oldest → newest
    history.reverse();

    res.json(history);

  } catch (error) {

    console.error(
      "History error:",
      error.message
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to fetch sensor history",

      error: error.message
    });
  }
});

// =====================================================
// ML PREDICTION
// =====================================================

app.get("/api/prediction", async (req, res) => {
  try {

    // -------------------------------------------------
    // GET LATEST SENSOR DATA
    // -------------------------------------------------

    const latest =
      await SensorData
        .findOne()
        .sort({
          timestamp: -1
        })
        .lean();

    if (!latest) {

      return res.status(404).json({
        success: false,

        message:
          "No sensor data available"
      });
    }

    // -------------------------------------------------
    // SEND DATA TO PYTHON ML API
    // -------------------------------------------------

    const mlResponse =
      await axios.post(
        "http://127.0.0.1:8000/predict",

        {
          soil_moisture:
            latest.soil_moisture,

          temperature:
            latest.temperature ?? 0,

          humidity:
            latest.humidity ?? 0
        },

        {
          timeout: 5000
        }
      );

    // -------------------------------------------------
    // RETURN RESULT
    // -------------------------------------------------

    res.json({
      success: true,

      sensor_data: latest,

      prediction:
        mlResponse.data
    });

  } catch (error) {

    console.error(
      "Prediction error:",
      error.message
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to get ML prediction",

      error: error.message
    });
  }
});

// =====================================================
// IRRIGATION COMMAND FOR ESP32
// =====================================================

app.get(
  "/api/irrigation-command",
  async (req, res) => {

    try {

      // ------------------------------------------------
      // GET LATEST SENSOR DATA
      // ------------------------------------------------

      const latest =
        await SensorData
          .findOne()
          .sort({
            timestamp: -1
          })
          .lean();

      if (!latest) {

        // FAIL-SAFE
        return res.json({
          success: true,

          relay_command: "OFF",

          pump_status: "OFF",

          reason:
            "No sensor data available"
        });
      }

      // ------------------------------------------------
      // ASK ML API
      // ------------------------------------------------

      const mlResponse =
        await axios.post(
          "http://127.0.0.1:8000/predict",

          {
            soil_moisture:
              latest.soil_moisture,

            temperature:
              latest.temperature ?? 0,

            humidity:
              latest.humidity ?? 0
          },

          {
            timeout: 5000
          }
        );

      const prediction =
        mlResponse.data;

      // ------------------------------------------------
      // RETURN SIMPLE COMMAND TO ESP32
      // ------------------------------------------------

      const relayCommand =
        prediction.relay_command === "ON"
          ? "ON"
          : "OFF";

      res.json({

        success: true,

        relay_command:
          relayCommand,

        pump_status:
          relayCommand === "ON"
            ? "ON"
            : "OFF",

        reason:
          prediction.reason ||
          "ML irrigation decision",

        rain_probability:
          prediction.rain_probability,

        predicted_soil_moisture_6h:
          prediction.predicted_soil_moisture_6h
      });

    } catch (error) {

      console.error(
        "Irrigation command error:",
        error.message
      );

      // ------------------------------------------------
      // FAIL-SAFE
      // ------------------------------------------------

      res.json({

        success: false,

        relay_command: "OFF",

        pump_status: "OFF",

        reason:
          "ML/backend unavailable - fail-safe OFF"
      });
    }
  }
);

// =====================================================
// DELETE TEST DATA
// =====================================================

app.delete(
  "/api/test-data",
  async (req, res) => {

    try {

      const result =
        await SensorData.deleteMany({
          device_id: "ESP32_TEST"
        });

      res.json({

        success: true,

        message:
          "Test data deleted",

        deleted:
          result.deletedCount
      });

    } catch (error) {

      console.error(
        "Delete test data error:",
        error.message
      );

      res.status(500).json({

        success: false,

        message:
          "Failed to delete test data",

        error: error.message
      });
    }
  }
);

// =====================================================
// MONGODB + SERVER START
// =====================================================

async function startServer() {

  try {

    console.log("");
    console.log("=================================");
    console.log("SMART IRRIGATION BACKEND");
    console.log("=================================");

    console.log(
      "Connecting to MongoDB..."
    );

    await mongoose.connect(
      process.env.MONGODB_URI
    );

    console.log(
      "MongoDB connected successfully!"
    );

    // -------------------------------------------------
    // IMPORTANT:
    // 0.0.0.0 allows ESP32 to connect
    // through the local network.
    // -------------------------------------------------

    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log("");
        console.log(
          "Backend server started!"
        );

        console.log(
          `Local:   http://localhost:${PORT}`
        );

        console.log(
          `Network: http://0.0.0.0:${PORT}`
        );

        console.log("");
        console.log(
          "Available API endpoints:"
        );

        console.log(
          `GET     http://localhost:${PORT}/`
        );

        console.log(
          `GET     http://localhost:${PORT}/api/health`
        );

        console.log(
          `POST    http://localhost:${PORT}/api/sensor-data`
        );

        console.log(
          `GET     http://localhost:${PORT}/api/latest`
        );

        console.log(
          `GET     http://localhost:${PORT}/api/history`
        );

        console.log(
          `GET     http://localhost:${PORT}/api/prediction`
        );

        console.log(
          `GET     http://localhost:${PORT}/api/irrigation-command`
        );

        console.log(
          `DELETE  http://localhost:${PORT}/api/test-data`
        );

        console.log("");
        console.log(
          "Waiting for ESP32 sensor data..."
        );

        console.log(
          "================================="
        );
        console.log("");
      }
    );

  } catch (error) {

    console.error("");
    console.error(
      "MongoDB connection failed!"
    );

    console.error(
      error.message
    );

    console.error("");

    process.exit(1);
  }
}

// =====================================================
// START SERVER
// =====================================================

startServer();