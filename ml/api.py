from pathlib import Path
import joblib
from fastapi import FastAPI
from pydantic import BaseModel

BASE = Path(__file__).resolve().parent

rain_model = joblib.load(BASE / "models" / "rain_model.pkl")
moisture_model = joblib.load(BASE / "models" / "moisture_model.pkl")

app = FastAPI(title="Smart Irrigation ML API")


class SensorInput(BaseModel):
    soil_moisture: float
    temperature: float
    humidity: float


@app.get("/")
def root():
    return {
        "ok": True,
        "message": "Smart Irrigation ML API is running"
    }


@app.post("/predict")
def predict(data: SensorInput):

    X = [[
        data.soil_moisture,
        data.temperature,
        data.humidity
    ]]

    # -----------------------------
    # ML predictions
    # -----------------------------

    rain_probability = float(
        rain_model.predict_proba(X)[0][1] * 100
    )

    future_moisture = float(
        moisture_model.predict(X)[0]
    )

    future_moisture = max(
        0,
        min(100, future_moisture)
    )

    # -----------------------------
    # Smart irrigation logic
    # -----------------------------

    if (
        data.soil_moisture < 30
        and rain_probability < 40
        and future_moisture < 60
    ):
        relay_command = "ON"
        pump_status = "IRRIGATION ON"
        recommendation = "Irrigation required"
        reason = "Soil is dry and rain is unlikely"

    elif rain_probability >= 40:
        relay_command = "OFF"
        pump_status = "PUMP OFF"
        recommendation = "Wait and monitor rainfall"
        reason = "Rain probability is high"

    elif future_moisture >= 60:
        relay_command = "OFF"
        pump_status = "PUMP OFF"
        recommendation = "Irrigation not required"
        reason = "Predicted soil moisture is sufficient"

    else:
        relay_command = "OFF"
        pump_status = "PUMP OFF"
        recommendation = "Monitor soil moisture"
        reason = "Irrigation conditions are not satisfied"

    return {
        "rain_probability": round(
            rain_probability,
            2
        ),

        "predicted_soil_moisture_6h": round(
            future_moisture,
            2
        ),

        "recommendation": recommendation,

        "relay_command": relay_command,

        "pump_status": pump_status,

        "reason": reason
    }