const http = require("http");

function sendSensorData() {
  const soilMoisture = Math.floor(Math.random() * 61) + 20;
  const temperature = Number((25 + Math.random() * 10).toFixed(1));
  const humidity = Number((55 + Math.random() * 30).toFixed(1));

  const data = JSON.stringify({
    device_id: "ESP32_SIMULATED",
    soil_moisture: soilMoisture,
    temperature: temperature,
    humidity: humidity
  });

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
        new Date().toLocaleTimeString(),
        "→",
        `Soil: ${soilMoisture}%`,
        `Temp: ${temperature}°C`,
        `Humidity: ${humidity}%`
      );
    });
  });

  request.on("error", (error) => {
    console.error("Could not connect to backend:", error.message);
  });

  request.write(data);
  request.end();
}

console.log("Fake ESP32 sensor started...");
console.log("Sending data every 10 seconds.");

sendSensorData();

setInterval(sendSensorData, 10000);