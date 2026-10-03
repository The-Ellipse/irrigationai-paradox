from pathlib import Path
import joblib
import pandas as pd

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, mean_absolute_error


# ===============================
# File locations
# ===============================

BASE = Path(__file__).resolve().parent

DATA = BASE / "dataset" / "historical_weather.csv"

MODEL_DIR = BASE / "models"
MODEL_DIR.mkdir(exist_ok=True)


# ===============================
# Load dataset
# ===============================

print("Loading dataset...")

df = pd.read_csv(DATA)

print(f"Dataset loaded: {len(df)} rows")


# ===============================
# Input features
# ===============================

features = [
    "soil_moisture",
    "temperature",
    "humidity"
]

X = df[features]


# ===============================
# MODEL 1
# Rain prediction
# ===============================

print("\nTraining rain prediction model...")

y_rain = df["rain_next_6h"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y_rain,
    test_size=0.2,
    random_state=42,
    stratify=y_rain
)

rain_model = RandomForestClassifier(
    n_estimators=150,
    random_state=42,
    class_weight="balanced"
)

rain_model.fit(X_train, y_train)

rain_prediction = rain_model.predict(X_test)

rain_accuracy = accuracy_score(
    y_test,
    rain_prediction
)

print(
    "Rain model accuracy:",
    round(rain_accuracy, 3)
)


# ===============================
# MODEL 2
# Future soil moisture prediction
# ===============================

print("\nTraining soil moisture prediction model...")

y_moisture = df["soil_moisture_6h"]

X_train2, X_test2, y_train2, y_test2 = train_test_split(
    X,
    y_moisture,
    test_size=0.2,
    random_state=42
)

moisture_model = RandomForestRegressor(
    n_estimators=150,
    random_state=42
)

moisture_model.fit(
    X_train2,
    y_train2
)

moisture_prediction = moisture_model.predict(
    X_test2
)

moisture_error = mean_absolute_error(
    y_test2,
    moisture_prediction
)

print(
    "Soil moisture MAE:",
    round(moisture_error, 3)
)


# ===============================
# Save models
# ===============================

joblib.dump(
    rain_model,
    MODEL_DIR / "rain_model.pkl"
)

joblib.dump(
    moisture_model,
    MODEL_DIR / "moisture_model.pkl"
)


print("\nModels saved successfully!")

print("Location:")
print(MODEL_DIR)