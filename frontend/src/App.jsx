import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const BACKEND_URL = "http://localhost:5000";

function getMoistureStatus(value) {
  if (value < 30) {
    return {
      label: "Dry",
      className: "status-dry",
      message: "Irrigation may be required",
    };
  }

  if (value < 60) {
    return {
      label: "Moderate",
      className: "status-moderate",
      message: "Monitor soil moisture",
    };
  }

  return {
    label: "Healthy",
    className: "status-healthy",
    message: "Moisture level is healthy",
  };
}

function App() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setError("");

      const [latestResponse, historyResponse, predictionResponse] =
        await Promise.all([
          fetch(`${BACKEND_URL}/api/latest`),
          fetch(`${BACKEND_URL}/api/history?limit=30`),
          fetch(`${BACKEND_URL}/api/prediction`),
        ]);

      if (
        !latestResponse.ok ||
        !historyResponse.ok ||
        !predictionResponse.ok
      ) {
        throw new Error("Backend request failed");
      }

      const latestData = await latestResponse.json();
      const historyData = await historyResponse.json();
      const predictionData = await predictionResponse.json();

      setLatest(latestData);
      setHistory(historyData);
      setPrediction(predictionData.prediction);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError(
        "Unable to connect to the monitoring backend. Make sure the Node.js and ML servers are running."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(loadDashboard, 10000);

    return () => clearInterval(interval);
  }, []);

  const chartData = useMemo(() => {
    return history.map((item) => ({
      time: new Date(item.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      moisture: item.soil_moisture,
    }));
  }, [history]);

  const moistureStatus = latest
    ? getMoistureStatus(latest.soil_moisture)
    : null;

  if (loading) {
    return (
      <div className="page">
        <div className="loading-screen">
          <div className="loading-icon">🌱</div>
          <h2>Loading Smart Soil Monitoring...</h2>
          <p>Connecting to your IoT and ML services</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="dashboard">

        {/* HEADER */}

        <header className="header">
          <div className="brand">
            <div className="brand-icon">🌱</div>

            <div>
              <h1>Smart Soil Monitoring</h1>
              <p>IoT + Machine Learning Agriculture Dashboard</p>
            </div>
          </div>

          <div className="system-status">
            <span className="online-dot"></span>
            System Online
          </div>
        </header>

        {/* ERROR */}

        {error && (
          <div className="error-banner">
            ⚠️ {error}
          </div>
        )}

        {/* SENSOR CARDS */}

        {latest && (
          <>
            <section className="section-heading">
              <div>
                <h2>Live Sensor Data</h2>
                <p>Latest readings from your connected device</p>
              </div>

              <span className={`status-pill ${moistureStatus.className}`}>
                {moistureStatus.label}
              </span>
            </section>

            <section className="sensor-grid">

              <div className="sensor-card">
                <div className="sensor-card-top">
                  <span className="sensor-icon green">🌱</span>
                  <span>SOIL MOISTURE</span>
                </div>

                <div className="sensor-value">
                  {latest.soil_moisture}
                  <small>%</small>
                </div>

                <div className="progress">
                  <div
                    className="progress-fill moisture-fill"
                    style={{
                      width: `${Math.min(
                        latest.soil_moisture,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>

                <p>{moistureStatus.message}</p>
              </div>

              <div className="sensor-card">
                <div className="sensor-card-top">
                  <span className="sensor-icon orange">🌡️</span>
                  <span>TEMPERATURE</span>
                </div>

                <div className="sensor-value">
                  {latest.temperature ?? "--"}
                  <small>°C</small>
                </div>

                <p>Current environmental temperature</p>
              </div>

              <div className="sensor-card">
                <div className="sensor-card-top">
                  <span className="sensor-icon blue">💧</span>
                  <span>HUMIDITY</span>
                </div>

                <div className="sensor-value">
                  {latest.humidity ?? "--"}
                  <small>%</small>
                </div>

                <div className="progress">
                  <div
                    className="progress-fill humidity-fill"
                    style={{
                      width: `${Math.min(
                        latest.humidity ?? 0,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>

                <p>Current atmospheric humidity</p>
              </div>

            </section>

            {/* ML SECTION */}

            <section className="section-heading prediction-heading">
              <div>
                <h2>Machine Learning Prediction</h2>
                <p>AI-assisted soil and rainfall analysis</p>
              </div>

              <span className="ml-badge">ML ACTIVE</span>
            </section>

            <section className="prediction-grid">

              <div className="prediction-card">
                <div className="prediction-icon">🌧️</div>

                <div>
                  <span>RAIN PROBABILITY</span>

                  <strong>
                    {prediction
                      ? prediction.rain_probability
                      : "--"}
                    <small>%</small>
                  </strong>

                  <p>Estimated rainfall probability</p>
                </div>
              </div>

              <div className="prediction-card">
                <div className="prediction-icon">🔮</div>

                <div>
                  <span>6-HOUR SOIL PREDICTION</span>

                  <strong>
                    {prediction
                      ? prediction.predicted_soil_moisture_6h
                      : "--"}
                    <small>%</small>
                  </strong>

                  <p>Predicted soil moisture after 6 hours</p>
                </div>
              </div>

              <div className="recommendation-card">
                <div className="recommendation-icon">💡</div>

                <div>
                  <span>SMART RECOMMENDATION</span>

                  <h3>
                    {prediction
                      ? prediction.recommendation
                      : "No recommendation"}
                  </h3>

                  <p>
                    Recommendation generated from current
                    sensor conditions and ML prediction.
                  </p>
                </div>
              </div>

            </section>

            {/* CHART */}

            <section className="chart-card">
              <div className="chart-header">
                <div>
                  <h2>Soil Moisture History</h2>
                  <p>Recent sensor readings</p>
                </div>

                <div className="chart-legend">
                  <span></span>
                  Soil Moisture
                </div>
              </div>

              {chartData.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={360}
                >
                  <LineChart
                    data={chartData}
                    margin={{
                      top: 20,
                      right: 20,
                      left: 0,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                    />

                    <XAxis
                      dataKey="time"
                      tick={{
                        fontSize: 11,
                      }}
                    />

                    <YAxis
                      domain={[0, 100]}
                      tick={{
                        fontSize: 11,
                      }}
                    />

                    <Tooltip />

                    <Line
                      type="monotone"
                      dataKey="moisture"
                      stroke="#16a34a"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{
                        r: 6,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-chart">
                  No historical sensor data available.
                </div>
              )}
            </section>

            {/* DEVICE INFORMATION */}

            <section className="device-card">
              <div className="device-title">
                <div className="device-icon">📡</div>

                <div>
                  <h2>Device Information</h2>
                  <p>Connected IoT device details</p>
                </div>
              </div>

              <div className="device-details">

                <div>
                  <span>DEVICE ID</span>
                  <strong>{latest.device_id}</strong>
                </div>

                <div>
                  <span>LAST READING</span>
                  <strong>
                    {new Date(
                      latest.timestamp
                    ).toLocaleString()}
                  </strong>
                </div>

                <div>
                  <span>BACKEND</span>
                  <strong className="connected">
                    ● Connected
                  </strong>
                </div>

                <div>
                  <span>ML ENGINE</span>
                  <strong className="connected">
                    ● Connected
                  </strong>
                </div>

              </div>
            </section>

            {/* FOOTER */}

            <footer>
              <div>
                Smart Soil Monitoring System
              </div>

              <div>
                Auto refresh: 10 seconds
                {lastUpdated &&
                  ` • Updated ${lastUpdated.toLocaleTimeString()}`}
              </div>
            </footer>
          </>
        )}

      </div>
    </div>
  );
}

export default App;