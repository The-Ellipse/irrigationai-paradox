from pathlib import Path
import joblib
from fastapi import FastAPI
from pydantic import BaseModel

BASE = Path(__file__).resolve().parent

rain_model = joblib.load(
    BASE / "models" / "rain_model.pkl"
)

moisture_model = joblib.load(
    BASE / "models" / "moisture_model.pkl"
)

app = FastAPI(
    title="Smart Soil Prediction API"
)


class SensorInput(BaseModel):
    soil_moisture: float
    temperature: float
    humidity: float


@app.get("/")
def root():
    return {
        "ok": True,
        "message": "ML prediction API is running"
    }


@app.post("/predict")
def predict(data: SensorInput):

    X = [[
        data.soil_moisture,
        data.temperature,
        data.humidity
    ]]

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

    if data.soil_moisture < 30 and rain_probability < 40:
        recommendation = "Irrigation required"

    elif data.soil_moisture < 30 and rain_probability >= 40:
        recommendation = "Wait and monitor rainfall"

    elif data.soil_moisture >= 60:
        recommendation = "Irrigation not required"

    else:
        recommendation = "Monitor soil moisture"

    return {
        "rain_probability": round(
            rain_probability, 2
        ),

        "predicted_soil_moisture_6h": round(
            future_moisture, 2
        ),

        "recommendation": recommendation
    }