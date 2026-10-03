const http = require("http");

let pumpState = "OFF";

function getRandomSensorData() {
  /*
    Generate different soil conditions.

    20-29%  → very dry
    30-59%  → moderate
    60-85%  → healthy/wet
  */

  const scenario = Math.random();

  let soilMoisture;
  let temperature;
  let humidity;

  if (scenario < 0.25) {
    // Dry soil
    soilMoisture = Math.floor(Math.random() * 10) + 20;
    temperature = Number((30 + Math.random() * 7).toFixed(1));
    humidity = Number((40 + Math.random() * 15).toFixed(1));
  } else if (scenario < 0.5) {
    // Moderate soil
    soilMoisture = Math.floor(Math.random() * 25) + 30;
    temperature = Number((27 + Math.random() * 7).toFixed(1));
    humidity = Number((50 + Math.random() * 20).toFixed(1));
  } else {
    // Healthy/wet soil
    soilMoisture = Math.floor(Math.random() * 26) + 60;
    temperature = Number((24 + Math.random() * 8).toFixed(1));
    humidity = Number((65 + Math.random() * 25).toFixed(1));
  }

  return {
    device_id: "ESP32_SIMULATED",
    soil_moisture: soilMoisture,
    temperature,
    humidity
  };
}

function sendSensorData() {
  const sensorData = getRandomSensorData();

  const data = JSON.stringify(sensorData);

  const options = {
    hostname: "localhost",
    port: 5000,
    path: "/api/sensor-data",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data)
    }
  };

  const request = http.request(options, (response) => {
    let result = "";

    response.on("data", (chunk) => {
      result += chunk;
    });

    response.on("end", () => {
      console.log(
        `[SENSOR] Soil: ${sensorData.soil_moisture}% | ` +
        `Temp: ${sensorData.temperature}°C | ` +
        `Humidity: ${sensorData.humidity}%`
      );

      getIrrigationDecision();
    });
  });

  request.on("error", (error) => {
    console.error(
      "[SENSOR] Backend connection failed:",
      error.message
    );
  });

  request.write(data);
  request.end();
}

function getIrrigationDecision() {
  http.get(
    "http://localhost:5000/api/prediction",
    (response) => {
      let result = "";

      response.on("data", (chunk) => {
        result += chunk;
      });

      response.on("end", () => {
        try {
          const data = JSON.parse(result);

          if (
            !data.success ||
            !data.prediction
          ) {
            console.log(
              "[RELAY] No valid ML prediction received."
            );

            setPump("OFF", "No valid ML decision");

            return;
          }

          const prediction = data.prediction;

          const command =
            prediction.relay_command || "OFF";

          console.log(
            `[ML] Rain: ${prediction.rain_probability}% | ` +
            `Predicted soil: ${prediction.predicted_soil_moisture_6h}%`
          );

          console.log(
            `[ML] Recommendation: ${prediction.recommendation}`
          );

          console.log(
            `[ML] Reason: ${prediction.reason}`
          );

          setPump(
            command,
            prediction.reason
          );
        } catch (error) {
          console.error(
            "[ML] Invalid prediction response:",
            error.message
          );

          setPump(
            "OFF",
            "Invalid ML response"
          );
        }
      });
    }
  ).on("error", (error) => {
    console.error(
      "[ML] Could not contact backend:",
      error.message
    );

    // Fail-safe
    setPump(
      "OFF",
      "Backend unavailable"
    );
  });
}

function setPump(command, reason) {
  const newState =
    command === "ON" ? "ON" : "OFF";

  if (newState !== pumpState) {
    pumpState = newState;

    if (pumpState === "ON") {
      console.log("");
      console.log("=================================");
      console.log("💧 SIMULATED PUMP: ON");
      console.log("🔌 SIMULATED RELAY: ON");
      console.log(`Reason: ${reason}`);
      console.log("=================================");
      console.log("");
    } else {
      console.log("");
      console.log("=================================");
      console.log("🛑 SIMULATED PUMP: OFF");
      console.log("🔌 SIMULATED RELAY: OFF");
      console.log(`Reason: ${reason}`);
      console.log("=================================");
      console.log("");
    }
  } else {
    console.log(
      `[RELAY] Relay remains ${pumpState}`
    );
  }
}

console.log("=================================");
console.log("🌱 SMART IRRIGATION SIMULATOR");
console.log("=================================");
console.log("Fake ESP32 started.");
console.log("Fake sensor interval: 10 seconds.");
console.log("Fake relay: ACTIVE");
console.log("Fake pump: ACTIVE");
console.log("=================================");
console.log("");

sendSensorData();

setInterval(
  sendSensorData,
  10000
);