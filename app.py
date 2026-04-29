from flask import Flask, jsonify, g, request
from flask_cors import CORS
import sqlite3
import math
import time

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})
DATABASE = 'f1_race_db.sqlite'

# ---------------------------------------------------------
# PHYSICS ENGINE: Simulates a car driving on a track
# ---------------------------------------------------------
class TelemetrySimulator:
    def __init__(self):
        # Define a simple "Spa-like" track using normalized coordinates (0-1000)
        # This is a closed loop. The car moves from point 0 to N, then back to 0.
        self.track_points = [
            (500, 900), (450, 850), (400, 800), (350, 700), # Start/Finish straight & Turn 1
            (300, 600), (250, 500), (200, 450), (150, 400), # Eau Rouge / Raidillon simulation
            (100, 350), (50, 300), (50, 200), (100, 150),   # Long straight
            (200, 100), (300, 50), (400, 50), (500, 100),   # Middle sector
            (600, 150), (700, 200), (800, 250), (900, 300), # Pouhon / Fagnes
            (950, 400), (950, 500), (900, 600), (850, 700), # Stavelot
            (800, 800), (700, 850), (600, 900), (500, 900)  # Final corner back to start
        ]
        
        self.current_point_index = 0.0 # Float to allow smooth interpolation
        self.speed = 0.0
        self.max_speed = 15.0 # Units per tick
        self.lap_count = 0
        self.current_lap_time = 0.0
        self.last_sector_time = 0.0
        self.sector_times = [0.0, 0.0, 0.0]
        
        # Simulation state
        self.throttle = 0.0
        self.brake = 0.0
        self.steering = 0.0 # -1.0 (left) to 1.0 (right)
        
    def get_next_telemetry(self):
        # 1. Calculate Target Point
        idx = int(self.current_point_index)
        next_idx = (idx + 1) % len(self.track_points)
        
        p1 = self.track_points[idx]
        p2 = self.track_points[next_idx]
        
        # 2. Simple Physics: Accelerate on straights, brake in corners
        # Calculate angle to determine if we are cornering (simplified)
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        distance = math.sqrt(dx*dx + dy*dy)
        
        # Simulate driver behavior
        if distance > 100: # Long straight
            self.throttle = min(1.0, self.throttle + 0.05)
            self.brake = 0.0
            self.steering = 0.0
        else: # Corner
            self.throttle = max(0.2, self.throttle - 0.02)
            self.brake = max(0.0, 0.5 - (distance/200)) # Brake harder for tight corners
            # Simple steering logic based on direction
            self.steering = max(-1.0, min(1.0, dx / 50.0)) 
            
        # Update Speed
        target_speed = self.max_speed * self.throttle * (1 - self.brake)
        self.speed = self.speed + (target_speed - self.speed) * 0.1
        
        # 3. Move Car
        self.current_point_index += self.speed / distance
        self.current_lap_time += 0.1 # 100ms per tick
        
        # Check Lap Completion
        if self.current_point_index >= len(self.track_points):
            self.current_point_index = 0.0
            self.lap_count += 1
            self.sector_times = [self.current_lap_time/3] * 3 # Reset for demo
            self.current_lap_time = 0.0
            
        # 4. Interpolate Exact Position (X, Y)
        progress = self.current_point_index - idx
        car_x = p1[0] + (p2[0] - p1[0]) * progress
        car_y = p1[1] + (p2[1] - p1[1]) * progress
        
        return {
            "x": car_x,
            "y": car_y,
            "speed": self.speed * 10, # Arbitrary km/h scale
            "gear": min(8, max(1, int(self.speed) + 1)),
            "throttle": self.throttle * 100,
            "brake": self.brake * 100,
            "steering": self.steering * 300, # Degrees
            "lap": self.lap_count + 1,
            "lap_time": self.current_lap_time,
            "track_temp": 32.5,
            "air_temp": 24.0
        }

# Initialize the simulator (Single instance for this demo)
simulator = TelemetrySimulator()

# ... (Keep your get_db, close_connection, format_time functions) ...
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def format_time(seconds):
    m = int(seconds // 60)
    s = seconds % 60
    return f"{m}:{s:06.3f}"

# ---------------------------------------------------------
# NEW ROUTE: LIVE TELEMETRY
# ---------------------------------------------------------
@app.route('/api/telemetry', methods=['GET'])
def get_telemetry():
    # Get fresh data from our physics engine
    data = simulator.get_next_telemetry()
    
    # Add some random tire temps for realism
    data['tire_fl'] = 90 + simulator.speed
    data['tire_fr'] = 90 + simulator.speed
    data['tire_rl'] = 85 + simulator.speed
    data['tire_rr'] = 85 + simulator.speed
    
    return jsonify(data)

# Keep your other routes (/api/historical, /api/live-stream) as they are!

if __name__ == '__main__':
    app.run(debug=True, port=5000)