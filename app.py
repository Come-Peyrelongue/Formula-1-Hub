from flask import Flask, jsonify, g, request
from flask_cors import CORS
import sqlite3
import requests
import math
import urllib3
import random

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})
DATABASE = 'f1_race_db.sqlite'

# Fallback simulation track
SIMULATION_TRACK = [
    (500, 900), (450, 850), (400, 800), (350, 700), (300, 600), 
    (250, 500), (200, 450), (150, 400), (100, 350), (50, 300), 
    (50, 200), (100, 150), (200, 100), (300, 50), (400, 50), 
    (500, 100), (600, 150), (700, 200), (800, 250), (900, 300), 
    (950, 400), (950, 500), (900, 600), (850, 700), (800, 800), 
    (700, 850), (600, 900), (500, 900)
]

class OpenF1Connector:
    def __init__(self):
        self.base_url = "https://api.openf1.org/v1"
        self.session_key = None
        self.location_cache = []
        self.car_data_cache = []
        self.current_index = 0
        self.track_layout = []
        self.mode = "SIMULATION"
        self.sim_pos = 0.0
        self.norm_min_x = 0
        self.norm_max_x = 1000
        self.norm_min_y = 0
        self.norm_max_y = 1000
        self.total_samples = 0
        self.sim_track = SIMULATION_TRACK # Initialize sim_track

    def initialize_session(self):
        print("🔄 Connecting to OpenF1 API...")
        headers = {"User-Agent": "Mozilla/5.0"}

        try:
            # 1. Get Sessions
            req = requests.Request('GET', f"{self.base_url}/sessions", params={'year': 2024}, headers=headers).prepare()
            resp = requests.get(req.url, timeout=10, verify=False)
            if resp.status_code != 200: raise Exception("Session fetch failed")
            
            sessions = [s for s in resp.json() if s.get('session_type') == 'Race']
            if not sessions: raise Exception("No races found")
            
            target = sessions[-1]
            self.session_key = target['session_key']
            meeting_key = target.get('meeting_key')
            print(f"✅ Selected: {target.get('location')}")

            # 2. Fetch Official Track
            official_loaded = False
            if meeting_key:
                try:
                    meet_req = requests.Request('GET', f"{self.base_url}/meetings", params={'meeting_key': meeting_key}, headers=headers).prepare()
                    meet_resp = requests.get(meet_req.url, timeout=5, verify=False)
                    if meet_resp.status_code == 200:
                        meet_data = meet_resp.json()
                        if meet_data and 'circuit_info_url' in meet_data[0]:
                            info_url = meet_data[0]['circuit_info_url']
                            print(f"🗺️  Fetching official track: {info_url}")
                            info_resp = requests.get(info_url, timeout=10, verify=False)
                            if info_resp.status_code == 200:
                                circuit_data = info_resp.json()
                                if 'x' in circuit_data and 'y' in circuit_data:
                                    self.track_layout = list(zip(circuit_data['x'], circuit_data['y']))
                                    official_loaded = True
                                    print(f"✅ Official Track Loaded: {len(self.track_layout)} points.")
                except Exception as e:
                    print(f"⚠️ Official track failed: {e}. Using live data.")

            # 3. Fetch Live Data
            def fetch_live(endpoint):
                r = requests.Request('GET', f"{self.base_url}/{endpoint}", 
                                     params={'session_key': self.session_key, 'driver_number': '1'}, 
                                     headers=headers).prepare()
                res = requests.get(r.url, timeout=15, verify=False)
                return res.json() if res.status_code == 200 else []

            locations = fetch_live("location")
            car_data = fetch_live("car_data")
            
            if not locations or not car_data: raise Exception("Missing live data")

            min_len = min(len(locations), len(car_data))
            self.location_cache = locations[:min_len]
            self.car_data_cache = car_data[:min_len]
            
            # Fast-Forward
            start_idx = 0
            for i, s in enumerate(self.car_data_cache):
                if s.get('speed', 0) > 50:
                    start_idx = i
                    break
            
            self.location_cache = self.location_cache[start_idx:]
            self.car_data_cache = self.car_data_cache[start_idx:]
            self.total_samples = len(self.car_data_cache)
            print(f"⏩ Racing samples: {self.total_samples}")

            # 4. Calculate Bounds
            points = self.track_layout if official_loaded else [(p['x'], p['y']) for p in self.location_cache]
            if points:
                xs = [p[0] for p in points]
                ys = [p[1] for p in points]
                self.norm_min_x, self.norm_max_x = min(xs), max(xs)
                self.norm_min_y, self.norm_max_y = min(ys), max(ys)
                
                padding_x = (self.norm_max_x - self.norm_min_x) * 0.15
                padding_y = (self.norm_max_y - self.norm_min_y) * 0.15
                self.norm_min_x -= padding_x
                self.norm_max_x += padding_x
                self.norm_min_y -= padding_y
                self.norm_max_y += padding_y
                
                print(f"📏 Bounds set with 15% padding.")
            else:
                self.norm_min_x, self.norm_max_x = 0, 1000
                self.norm_min_y, self.norm_max_y = 0, 1000

            if not official_loaded:
                seen = set()
                self.track_layout = []
                for p in self.location_cache:
                    coord = (p['x'], p['y'])
                    if coord not in seen:
                        self.track_layout.append(coord)
                        seen.add(coord)

            self.mode = "OPENF1"
            self.current_index = 0
            print(f"🏎️  MODE: REAL DATA")

        except Exception as e:
            print(f"❌ Error: {e}")
            self.mode = "SIMULATION"
            self.track_layout = SIMULATION_TRACK

    def normalize(self, val, min_v, max_v):
        if max_v == min_v: return 500
        return ((val - min_v) / (max_v - min_v)) * 900 + 50

    def calculate_steering(self, x, y, prev_x, prev_y, next_x, next_y):
        dx1 = x - prev_x
        dy1 = y - prev_y
        dx2 = next_x - x
        dy2 = next_y - y
        cross = (dx1 * dy2) - (dy1 * dx2)
        return max(-400, min(400, cross * 2))

    def get_next_telemetry(self):
        if self.mode == "OPENF1" and self.total_samples > 0:
            sample_car = self.car_data_cache[self.current_index]
            sample_loc = self.location_cache[self.current_index]
            
            self.current_index += 1
            if self.current_index >= self.total_samples:
                self.current_index = 0
            
            curr_x = self.normalize(sample_loc['x'], self.norm_min_x, self.norm_max_x)
            curr_y = self.normalize(sample_loc['y'], self.norm_min_y, self.norm_max_y)
            
            prev_idx = (self.current_index - 1) % self.total_samples
            next_idx = (self.current_index + 1) % self.total_samples
            p_prev = self.location_cache[prev_idx]
            p_next = self.location_cache[next_idx]
            
            px = self.normalize(p_prev['x'], self.norm_min_x, self.norm_max_x)
            py = self.normalize(p_prev['y'], self.norm_min_y, self.norm_max_y)
            nx = self.normalize(p_next['x'], self.norm_min_x, self.norm_max_x)
            ny = self.normalize(p_next['y'], self.norm_min_y, self.norm_max_y)
            
            steering = self.calculate_steering(curr_x, curr_y, px, py, nx, ny)
            
            return {
                "x": curr_x, "y": curr_y,
                "speed": sample_car.get('speed', 0),
                "gear": sample_car.get('n_gear', 0),
                "rpm": sample_car.get('rpm', 0),
                "throttle": sample_car.get('throttle', 0),
                "brake": sample_car.get('brake', 0),
                "steering": steering,
                "lap": sample_car.get('lap_number', 1),
                "lap_time": (self.current_index % 2000) * 0.27,
                "date": sample_car.get('date', 'mode = REAL')
            }
        else:
            if not self.sim_track: return {"x": 500, "y": 500, "speed": 0}
            idx = int(self.sim_pos)
            next_idx = (idx + 1) % len(self.sim_track)
            p1, p2 = self.sim_track[idx], self.sim_track[next_idx]
            dx, dy = p2[0]-p1[0], p2[1]-p1[1]
            dist = math.sqrt(dx*dx+dy*dy) or 1
            speed = 15 + 10 * math.sin(self.sim_pos / 5)
            self.sim_pos += speed / dist
            if self.sim_pos >= len(self.sim_track): self.sim_pos = 0.0
            return {
                "x": p1[0] + (dx * (self.sim_pos-idx)), "y": p1[1] + (dy * (self.sim_pos-idx)),
                "speed": speed*12, "gear": min(8, max(1, int(speed))), "rpm": int(speed*100),
                "throttle": 80 if dist>50 else 30, "brake": 0 if dist>50 else 50,
                "steering": (dx/10)*10, "lap": 1, "lap_time": 0, "date": "", "mode": "SIM"
            }

connector = OpenF1Connector()
connector.initialize_session()

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None: db.close()

def format_time(seconds):
    if not seconds: return "0:00.000"
    m = int(seconds // 60)
    s = seconds % 60
    return f"{m}:{s:06.3f}"

@app.route('/api/telemetry', methods=['GET'])
def get_telemetry():
    data = connector.get_next_telemetry()
    base_temp = 80 + (data.get('speed', 0) / 3)
    data['tire_fl'] = base_temp + 2
    data['tire_fr'] = base_temp + 2
    data['tire_rl'] = base_temp - 2
    data['tire_rr'] = base_temp - 2
    return jsonify(data)

@app.route('/api/track-layout', methods=['GET'])
def get_track_layout():
    points = connector.track_layout if connector.track_layout else SIMULATION_TRACK
    if connector.mode == "OPENF1":
        normalized = [(connector.normalize(x, connector.norm_min_x, connector.norm_max_x),
                       connector.normalize(y, connector.norm_min_y, connector.norm_max_y)) for x, y in points]
        svg_points = " ".join([f"{x},{y}" for x, y in normalized])
    else:
        svg_points = " ".join([f"{x},{y}" for x, y in points])
    return jsonify({"points": svg_points})

@app.route('/api/historical', methods=['GET'])
def get_historical_data():
    db = get_db()
    cursor = db.cursor()
    track_id = request.args.get('track_id')
    driver_id = request.args.get('driver_id')
    
    query = "SELECT d.driver_name, d.team, t.track_name, r.lap_time_sec, r.year FROM results r JOIN drivers d ON r.driver_id = d.id JOIN tracks t ON r.track_id = t.id WHERE 1=1"
    params = []
    if track_id:
        query += " AND r.track_id = ?"
        params.append(track_id)
    if driver_id:
        query += " AND r.driver_id = ?"
        params.append(driver_id)
    query += " ORDER BY r.lap_time_sec ASC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    results = [{'driver': r['driver_name'], 'team': r['team'], 'track': r['track_name'], 'time': format_time(r['lap_time_sec']), 'year': r['year'], 'is_live': False} for r in rows]
    
    cursor.execute("SELECT id, track_name FROM tracks")
    tracks = [{'id': t['id'], 'name': t['track_name']} for t in cursor.fetchall()]
    cursor.execute("SELECT id, driver_name FROM drivers")
    drivers = [{'id': d['id'], 'name': d['driver_name']} for d in cursor.fetchall()]
    
    return jsonify({'results': results, 'tracks': tracks, 'drivers': drivers})

@app.route('/api/championship/years', methods=['GET'])
def get_championship_years():
    return jsonify([2024, 2023, 2022, 2021, 2020])

@app.route('/api/championship/<int:year>', methods=['GET'])
def get_championship_data(year):
    """Returns the list of sessions (GPs) for the year."""
    headers = {"User-Agent": "Mozilla/5.0"}
    
    try:
        sessions = []
        
        # Strategy 1: Try with session_name='Race'
        req = requests.Request('GET', f"{connector.base_url}/sessions", 
                               params={'year': year, 'session_name': 'Race'}, 
                               headers=headers).prepare()
        resp = requests.get(req.url, timeout=10, verify=False)
        
        if resp.status_code == 200:
            sessions = resp.json()
        
        # Strategy 2: Fallback unfiltered
        if not sessions:
            print(f"⚠️ No sessions found with filter for {year}. Trying unfiltered...")
            req = requests.Request('GET', f"{connector.base_url}/sessions", 
                                   params={'year': year}, 
                                   headers=headers).prepare()
            resp = requests.get(req.url, timeout=10, verify=False)
            if resp.status_code == 200:
                all_sessions = resp.json()
                sessions = [s for s in all_sessions if s.get('session_type') == 'Race' or s.get('session_name') == 'Race']

        if not sessions:
            print(f"⚠️ No race sessions found for year {year}.")
            return jsonify({'year': year, 'races': []}), 200
            
        sessions.sort(key=lambda x: x.get('date_start', ''))
        
        races_list = []
        for s in sessions:
            if 'session_key' in s:
                race_name = s.get('meeting_name') or s.get('circuit_short_name') or s.get('country_name') or "Unknown GP"
                circuit_name = s.get('circuit_short_name') or ""
                
                if circuit_name and race_name != circuit_name:
                    display_name = f"{race_name} ({circuit_name})"
                else:
                    display_name = race_name

                races_list.append({
                    'session_key': s['session_key'],
                    'meeting_key': s.get('meeting_key', 0),
                    'name': display_name,
                    'date': s.get('date_start', '')[:10],
                    'country': s.get('country_name', 'Unknown')
                })
            
        return jsonify({
            'year': year,
            'races': races_list
        })
        
    except Exception as e:
        print(f"❌ Error in /api/championship/{year}: {e}")
        return jsonify({'error': str(e), 'details': 'Internal server error'}), 500
        
@app.route('/api/standings/<int:year>', methods=['GET'])
def get_driver_standings(year):
    """Retrieves final driver standings for a given year (Legacy)."""
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        req = requests.Request('GET', f"{connector.base_url}/sessions", 
                               params={'year': year, 'session_type': 'Race'}, 
                               headers=headers).prepare()
        resp = requests.get(req.url, timeout=10, verify=False)
        sessions = resp.json()
        
        if not sessions:
            return jsonify({'standings': []})
            
        sessions.sort(key=lambda x: x.get('date_start', ''))
        last_race_key = sessions[-1]['session_key']
        
        res_req = requests.Request('GET', f"{connector.base_url}/session_result", 
                                   params={'session_key': last_race_key}, 
                                   headers=headers).prepare()
        res_resp = requests.get(res_req.url, timeout=10, verify=False)
        
        if res_resp.status_code == 200:
            results = res_resp.json()
            results.sort(key=lambda x: x.get('position', 99))
            return jsonify({'standings': results})
        else:
            return jsonify({'standings': []})
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/race-result/<int:session_key>', methods=['GET'])
def get_race_result(session_key):
    """Retrieves detailed results for a specific race with driver names."""
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        req_res = requests.Request('GET', f"{connector.base_url}/session_result", 
                                   params={'session_key': session_key}, 
                                   headers=headers).prepare()
        resp_res = requests.get(req_res.url, timeout=10, verify=False)
        
        if resp_res.status_code != 200:
            return jsonify({'results': [], 'error': 'Failed to fetch results'}), 500
            
        results = resp_res.json()
        
        if not results:
            return jsonify({'results': []}), 200

        req_drv = requests.Request('GET', f"{connector.base_url}/drivers", 
                                   params={'session_key': session_key}, 
                                   headers=headers).prepare()
        resp_drv = requests.get(req_drv.url, timeout=10, verify=False)
        
        driver_map = {}
        if resp_drv.status_code == 200:
            drivers = resp_drv.json()
            for d in drivers:
                num = str(d.get('driver_number'))
                name = d.get('full_name') or f"{d.get('first_name', '')} {d.get('last_name', '')}".strip()
                if num and name:
                    driver_map[num] = name

        enriched_results = []
        for r in results:
            driver_num = str(r.get('driver_number', ''))
            r['driver_name'] = driver_map.get(driver_num, f"Driver #{driver_num}")
            enriched_results.append(r)
            
        enriched_results.sort(key=lambda x: x.get('position') if x.get('position') is not None else 99)
        
        return jsonify({'results': enriched_results})
        
    except Exception as e:
        print(f"❌ Error in /api/race-result/{session_key}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/championship-standings/<int:year>', methods=['GET'])
def get_real_standings(year):
    """Retrieves final driver standings with robust error handling and driver names."""
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        # 1. Find the last race of the year
        req = requests.Request('GET', f"{connector.base_url}/sessions", 
                               params={'year': year, 'session_type': 'Race'}, 
                               headers=headers).prepare()
        resp = requests.get(req.url, timeout=10, verify=False)
        
        sessions = resp.json() if resp.status_code == 200 else []
        
        # Fallback if 'Race' filter returns nothing
        if not sessions:
            req = requests.Request('GET', f"{connector.base_url}/sessions", 
                                   params={'year': year}, 
                                   headers=headers).prepare()
            resp = requests.get(req.url, timeout=10, verify=False)
            all_sessions = resp.json() if resp.status_code == 200 else []
            sessions = [s for s in all_sessions if s.get('session_type') == 'Race' or s.get('session_name') == 'Race']

        if not sessions:
            print(f"⚠️ No race sessions found for year {year}. Returning empty list.")
            return jsonify({
                'standings': [], 
                'message': f"No race data found for {year} in the OpenF1 API."
            }), 200
            
        sessions = sorted(sessions, key=lambda x: x.get('date_start', ''))
        last_key = sessions[-1]['session_key']
        
        # 2. Fetch championship standings
        stand_req = requests.Request('GET', f"{connector.base_url}/championship_drivers", 
                                     params={'session_key': last_key}, 
                                     headers=headers).prepare()
        stand_resp = requests.get(stand_req.url, timeout=10, verify=False)
        
        if stand_resp.status_code != 200:
            return jsonify({
                'standings': [], 
                'message': "Unable to retrieve championship data."
            }), 200
            
        standings_data = stand_resp.json()
        
        # SAFETY: Ensure data is a list of dictionaries
        if not isinstance(standings_data, list):
            print(f"⚠️ Unexpected data format for {year}: {type(standings_data)}")
            return jsonify({
                'standings': [], 
                'message': "Invalid data format received from API."
            }), 200

        # 3. Fetch driver list to map names
        req_drv = requests.Request('GET', f"{connector.base_url}/drivers", 
                                   params={'session_key': last_key}, 
                                   headers=headers).prepare()
        resp_drv = requests.get(req_drv.url, timeout=10, verify=False)
        
        driver_map = {}
        if resp_drv.status_code == 200:
            drivers = resp_drv.json()
            for d in drivers:
                if isinstance(d, dict):
                    num = str(d.get('driver_number'))
                    name = d.get('full_name') or f"{d.get('first_name', '')} {d.get('last_name', '')}".strip()
                    if num and name:
                        driver_map[num] = name

        # 4. Enrich data
        enriched_standings = []
        for row in standings_data:
            # Safety: Skip items that aren't dictionaries
            if not isinstance(row, dict):
                continue
                
            driver_num = str(row.get('driver_number', ''))
            row['driver_name'] = driver_map.get(driver_num, f"Driver #{driver_num}")
            enriched_standings.append(row)
            
        if not enriched_standings:
            return jsonify({
                'standings': [], 
                'message': f"No drivers found for the {year} season."
            }), 200

        enriched_standings.sort(key=lambda x: x.get('position_current', 99))
        
        return jsonify({'standings': enriched_standings})
        
    except Exception as e:
        print(f"❌ Error in /api/championship-standings/{year}: {e}")
        return jsonify({'standings': [], 'error': str(e)}), 500

@app.route('/api/live-stream', methods=['GET'])
def get_live_stream():
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT id, driver_name, team FROM drivers ORDER BY RANDOM() LIMIT 1")
    rd = cursor.fetchone()
    cursor.execute("SELECT id, track_name FROM tracks ORDER BY RANDOM() LIMIT 1")
    rt = cursor.fetchone()
    
    live = None
    if rd and rt:
        live = {'driver': rd['driver_name'], 'team': rd['team'], 'track': rt['track_name'], 'time': format_time(80.0 + random.random() * 5.0), 'year': 2026, 'is_live': True}
    
    cursor.execute("SELECT d.driver_name, d.team, t.track_name, r.lap_time_sec, r.year FROM results r JOIN drivers d ON r.driver_id = d.id JOIN tracks t ON r.track_id = t.id ORDER BY r.id DESC LIMIT 10")
    rows = cursor.fetchall()
    history = [{'driver': r['driver_name'], 'team': r['team'], 'track': r['track_name'], 'time': format_time(r['lap_time_sec']), 'year': r['year'], 'is_live': False} for r in rows]
    
    final = [live] + history if live else history
    return jsonify({'results': final, 'message': 'Live stream active'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)