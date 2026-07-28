import fastf1
import json
import math
import os

print("Enabling FastF1 Cache...")
fastf1.Cache.enable_cache('.')

print("Fetching Belgium GP 2023 Race...")
session = fastf1.get_session(2023, 'Belgium', 'R')
session.load(telemetry=True, laps=True, weather=False)

print("Extracting Max Verstappen's fastest lap telemetry...")
lap = session.laps.pick_driver('VER').pick_fastest()
telemetry = lap.get_telemetry()

# The telemetry DataFrame contains 'Date', 'SessionTime', 'Time', 'RPM', 'Speed', 'nGear', 'Throttle', 'Brake', 'DRS', 'Source', 'Distance', 'RelativeDistance', 'Status', 'X', 'Y', 'Z'
data = []

# Convert to list of dictionaries
for idx, row in telemetry.iterrows():
    # Handle NaNs
    x = row['X'] if not math.isnan(row['X']) else 0
    y = row['Y'] if not math.isnan(row['Y']) else 0
    speed = row['Speed'] if not math.isnan(row['Speed']) else 0
    rpm = row['RPM'] if not math.isnan(row['RPM']) else 0
    throttle = row['Throttle'] if not math.isnan(row['Throttle']) else 0
    brake = row['Brake'] if not isinstance(row['Brake'], float) or not math.isnan(row['Brake']) else False
    
    # Brake in FastF1 is usually boolean, convert to 100 for percentage
    brake_val = 100.0 if brake else 0.0
    
    data.append({
        "speed": float(speed),
        "rpm": float(rpm),
        "throttle": float(throttle),
        "brake_pressure": float(brake_val),
        "x": float(x),
        "y": float(y),
        # Add mock tire temperatures
        "tire_temp_fl": 100.0,
        "tire_temp_fr": 100.0,
        "tire_temp_rl": 100.0,
        "tire_temp_rr": 100.0
    })

output_file = os.path.join(os.path.dirname(__file__), 'belgium_gp_telemetry.json')
with open(output_file, 'w') as f:
    json.dump(data, f)

print(f"Successfully saved {len(data)} points to {output_file}")
