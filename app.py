from flask import Flask, jsonify, g, request
from flask_cors import CORS
import sqlite3
import requests
import math
import urllib3
import random
import time
from datetime import datetime, timedelta
from bisect import bisect_right

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})

DATABASE = 'f1_race_db.sqlite'

FLAG_PRIORITY = {
    "green": 1, "blue": 1, "black_white": 1, "black": 2,
    "formation": 2, "yellow": 3, "vsc": 4, "safety_car": 5,
    "red": 6, "chequered": 6,
}

TYRE_TEMP_WINDOWS = {
    "SOFT":         (75, 85, 105, 115),
    "MEDIUM":       (80, 90, 115, 125),
    "HARD":         (85, 100, 120, 130),
    "INTERMEDIATE": (45, 60, 90, 100),
    "WET":          (35, 40, 70, 80),
}


def parse_dt(date_str):
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except Exception:
        return None


def safe_float(value, default=0.0):
    try:
        return default if value is None else float(value)
    except Exception:
        return default


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------------------
# Race-control
# ---------------------------------------------------------------------------

def _classify_rc_event(rc):
    message  = (rc.get('message')  or '').upper()
    flag     = (rc.get('flag')     or '').upper()
    category = (rc.get('category') or '').upper()
    scope_raw = (rc.get('scope')   or '').upper()

    if category == "SESSIONSTATUS":
        if any(k in message for k in ("FORMATION LAP", "GREEN LIGHT - PIT EXIT OPEN", "PIT EXIT OPEN")):
            return "FORMATION LAP", "formation", "track"
        if "STARTED" in message or "GREEN FLAG" in message or "SAFETY CAR IN" in message:
            return "GREEN FLAG", "green", "track"
        if "ABORTED" in message or "SUSPENDED" in message:
            return "RED FLAG", "red", "track"
        return None, None, None

    if category == "SAFETYCAR":
        if "SAFETY CAR" in message and "VIRTUAL" not in message:
            return "SAFETY CAR", "safety_car", "track"
        if "VSC" in message or "VIRTUAL SAFETY CAR" in message:
            return "VSC", "vsc", "track"
        if "SAFETY CAR IN" in message or "ENDING" in message or "WITHDRAWN" in message:
            return "GREEN FLAG", "green", "track"
        return None, None, None

    if category == "FLAG":
        is_sector = (scope_raw == "SECTOR" or "SECTOR" in message or "IN TRACK SECTOR" in message)
        scope = "sector" if is_sector else "track"

        if "RED" in flag or "RED FLAG" in message:
            return "RED FLAG", "red", "track"
        if "CHEQUERED" in flag or "CHECKERED" in flag:
            return "CHEQUERED FLAG", "chequered", "track"
        if "DOUBLE YELLOW" in flag or "DOUBLE YELLOW" in message:
            return "YELLOW FLAG", "yellow", scope
        if "YELLOW" in flag:
            return "YELLOW FLAG", "yellow", scope
        if "GREEN" in flag or "CLEAR" in message:
            return "GREEN FLAG", "green", scope
        if "BLUE" in flag:
            return "BLUE FLAG", "blue", scope
        if "BLACK AND WHITE" in flag:
            return "BLACK & WHITE", "black_white", scope
        if "BLACK" in flag:
            return "BLACK FLAG", "black", scope
        return None, None, None

    return None, None, None


def build_flag_timeline(race_control_cache):
    timeline = []
    for rc in race_control_cache:
        label, type_, scope = _classify_rc_event(rc)
        if label is None:
            continue
        dt = rc.get('_dt')
        if dt is not None:
            priority = FLAG_PRIORITY.get(type_, 0)
            timeline.append((dt, priority, label, type_, scope, rc))
    timeline.sort(key=lambda x: (x[0], x[1]))
    return [(dt, label, type_, scope, rc) for dt, pri, label, type_, scope, rc in timeline]


# ---------------------------------------------------------------------------
# Standings Manager
# ---------------------------------------------------------------------------

class RaceStandingsManager:
    def __init__(self):
        self.position_events = []
        self.interval_events = []
        self.driver_map      = {}
        self.current_standings = []
        self._pos_dates = []
        self._int_dates = []

    def load(self, session_key, headers):
        base = "https://api.openf1.org/v1"

        def get(endpoint, params):
            r = requests.Request('GET', f"{base}/{endpoint}", params=params, headers=headers).prepare()
            res = requests.get(r.url, timeout=15, verify=False)
            return res.json() if res.status_code == 200 else []

        drivers = get("drivers", {"session_key": session_key})
        for d in drivers:
            num = d.get("driver_number")
            if num is not None:
                self.driver_map[int(num)] = {
                    "acronym":     d.get("name_acronym", f"#{num}"),
                    "team_colour": d.get("team_colour", "FFFFFF"),
                    "full_name":   d.get("full_name", ""),
                }
        print(f"  ✅ Loaded {len(self.driver_map)} drivers.")

        raw_pos = get("position", {"session_key": session_key})
        for p in raw_pos:
            dt = parse_dt(p.get("date", ""))
            if dt is None:
                continue
            self.position_events.append({
                "date_dt": dt, "driver_number": int(p.get("driver_number", 0)),
                "position": int(p.get("position", 99)),
            })
        self.position_events.sort(key=lambda x: x["date_dt"])
        self._pos_dates = [e["date_dt"] for e in self.position_events]
        print(f"  ✅ Loaded {len(self.position_events)} position events.")

        raw_int = get("intervals", {"session_key": session_key})
        for iv in raw_int:
            dt = parse_dt(iv.get("date", ""))
            if dt is None:
                continue
            self.interval_events.append({
                "date_dt": dt, "driver_number": int(iv.get("driver_number", 0)),
                "gap_to_leader": iv.get("gap_to_leader"), "interval": iv.get("interval"),
            })
        self.interval_events.sort(key=lambda x: x["date_dt"])
        self._int_dates = [e["date_dt"] for e in self.interval_events]
        print(f"  ✅ Loaded {len(self.interval_events)} interval events.")

    def update(self, current_dt):
        if current_dt is None or not self.position_events:
            return
        cutoff     = bisect_right(self._pos_dates, current_dt)
        cutoff_int = bisect_right(self._int_dates, current_dt)

        latest_pos = {}
        for ev in self.position_events[:cutoff]:
            latest_pos[ev["driver_number"]] = ev["position"]

        latest_gap = {}; latest_interval = {}
        for ev in self.interval_events[:cutoff_int]:
            latest_gap[ev["driver_number"]]      = ev["gap_to_leader"]
            latest_interval[ev["driver_number"]] = ev["interval"]

        if not latest_pos:
            return

        standings = []
        for dn, pos in latest_pos.items():
            driver_info = self.driver_map.get(dn, {})
            standings.append({
                "position": pos, "driver_number": dn,
                "acronym": driver_info.get("acronym", f"#{dn}"),
                "team_colour": driver_info.get("team_colour", "FFFFFF"),
                "gap_to_leader": latest_gap.get(dn), "interval": latest_interval.get(dn),
            })
        standings.sort(key=lambda x: x["position"])
        self.current_standings = standings

    def format_gap(self, gap):
        if gap is None: return "LEAD"
        if isinstance(gap, str): return gap
        try:
            v = float(gap)
            if v == 0: return "LEAD"
            m = int(abs(v) // 60); s = abs(v) % 60
            return f"+{m}:{s:05.3f}" if m > 0 else f"+{s:.3f}"
        except Exception:
            return str(gap)

    def get_display(self):
        return [{
            "position": e["position"], "driver_number": e["driver_number"],
            "acronym": e["acronym"], "team_colour": e["team_colour"],
            "gap": self.format_gap(e["gap_to_leader"]),
            "interval": self.format_gap(e["interval"]),
        } for e in self.current_standings]


# ---------------------------------------------------------------------------
# Per-driver data cache
# ---------------------------------------------------------------------------

class DriverDataCache:
    def __init__(self):
        self.location_cache = []
        self.car_data_cache = []
        self.laps_cache     = []
        self.stints_cache   = []
        self.sample_dates   = []
        self.total_samples  = 0
        self.lap_boundaries = []
        self.lap_start_dates = []
        self.lap_by_number  = {}
        self.global_best_sectors = {1: None, 2: None, 3: None}


# ---------------------------------------------------------------------------
# Main Connector
# ---------------------------------------------------------------------------

class OpenF1Connector:
    def __init__(self):
        self.base_url      = "https://api.openf1.org/v1"
        self.session_key   = None
        self.driver_number = '1'
        self.driver_acronym = '---'
        self.driver_team_colour = 'FFFFFF'

        self.driver_caches = {}

        self.location_cache    = []
        self.car_data_cache    = []
        self.laps_cache        = []
        self.stints_cache      = []
        self.sample_dates      = []
        self.total_samples     = 0
        self.lap_boundaries    = []
        self.lap_start_dates   = []
        self.lap_by_number     = {}
        self.global_best_sectors = {1: None, 2: None, 3: None}

        self.race_control_cache = []
        self.weather_cache     = []
        self.weather_dates     = []

        self.flag_timeline      = []
        self.flag_timeline_dates = []

        self.current_index = 0
        self.track_layout  = []
        self.track_rotation = 0.0

        self.norm_min_x = 0; self.norm_max_x = 1000
        self.norm_min_y = 0; self.norm_max_y = 1000

        self.circuit_name = "Unknown Circuit"
        self.session_type = "Unknown"
        self.total_laps   = 0

        self.replay_speed      = 1.0
        self.replay_wall_start = None
        self.replay_data_start = None
        self.replay_data_end   = None
        self.last_lap_num_seen = None

        self.session_start_dt  = None

        self.standings_manager = RaceStandingsManager()
        self._last_standings_update    = None
        self._standings_update_interval = 4.0
        self._current_replay_dt        = None

    # ------------------------------------------------------------------
    # Session loading (called from /api/replay/load)
    # ------------------------------------------------------------------

    def reinitialize_session(self, session_key):
        print(f"\n🔄 Loading session_key={session_key}...")
        headers = {"User-Agent": "Mozilla/5.0"}

        try:
            req = requests.Request('GET', f"{self.base_url}/sessions",
                                   params={'session_key': session_key}, headers=headers).prepare()
            resp = requests.get(req.url, timeout=10, verify=False)
            if resp.status_code != 200:
                return False, "Failed to fetch session"

            sessions = resp.json()
            if not sessions:
                return False, "Session not found"

            target = sessions[0]
            self.session_key  = target['session_key']
            meeting_key       = target.get('meeting_key')
            self.circuit_name = target.get('circuit_short_name', target.get('location', 'Unknown Circuit'))
            self.session_type = target.get('session_type', 'Unknown')
            self.session_start_dt = parse_dt(target.get('date_start', ''))

            # Reset everything
            self.driver_caches = {}
            self.race_control_cache = []
            self.weather_cache = []
            self.weather_dates = []
            self.flag_timeline = []
            self.flag_timeline_dates = []
            self.total_laps = 0
            self._current_replay_dt = None
            self._last_standings_update = None

            print(f"  ✅ Session: {self.circuit_name} ({self.session_type}) - Key: {self.session_key}")

            # Track layout
            official_loaded = False
            if meeting_key:
                try:
                    meet_req = requests.Request('GET', f"{self.base_url}/meetings",
                                               params={'meeting_key': meeting_key}, headers=headers).prepare()
                    meet_resp = requests.get(meet_req.url, timeout=5, verify=False)
                    if meet_resp.status_code == 200:
                        meet_data = meet_resp.json()
                        if meet_data and 'circuit_info_url' in meet_data[0]:
                            info_url  = meet_data[0]['circuit_info_url']
                            info_resp = requests.get(info_url, timeout=10, verify=False)
                            if info_resp.status_code == 200:
                                circuit_data = info_resp.json()
                                if 'x' in circuit_data and 'y' in circuit_data:
                                    self.track_layout = list(zip(circuit_data['x'], circuit_data['y']))
                                    official_loaded = True
                                    self.track_rotation = float(circuit_data.get('rotation', 0) or 0)
                                    print(f"  ✅ Track: {len(self.track_layout)} pts, rotation={self.track_rotation}°")
                except Exception as e:
                    print(f"  ⚠️ Track layout: {e}")

            # Fetch shared data
            def fetch_live(endpoint, params=None):
                fp = {'session_key': self.session_key}
                if params: fp.update(params)
                r = requests.Request('GET', f"{self.base_url}/{endpoint}",
                                     params=fp, headers=headers).prepare()
                res = requests.get(r.url, timeout=15, verify=False)
                return res.json() if res.status_code == 200 else []

            race_control = fetch_live("race_control")
            weather_raw  = fetch_live("weather")

            # Total laps
            try:
                sample_laps = fetch_live("laps", {'driver_number': 1})
                if sample_laps:
                    self.total_laps = max(int(l.get('lap_number', 0)) for l in sample_laps if l.get('lap_number'))
            except Exception:
                self.total_laps = 0
            print(f"  🏁 Total laps: {self.total_laps}")

            # Race control
            self.race_control_cache = []
            for rc in race_control:
                dt = parse_dt(rc.get('date', ''))
                if dt is not None:
                    rc['_dt'] = dt
                    self.race_control_cache.append(rc)
            self.race_control_cache.sort(key=lambda x: x['_dt'])
            print(f"  ✅ Race control: {len(self.race_control_cache)} messages")

            self.flag_timeline = build_flag_timeline(self.race_control_cache)
            self.flag_timeline_dates = [e[0] for e in self.flag_timeline]

            # Weather
            self.weather_cache = []
            for w in weather_raw:
                dt = parse_dt(w.get('date', ''))
                if dt is not None:
                    w['_dt'] = dt
                    self.weather_cache.append(w)
            self.weather_cache.sort(key=lambda x: x['_dt'])
            self.weather_dates = [w['_dt'] for w in self.weather_cache]
            print(f"  🌤️ Weather: {len(self.weather_cache)} samples")

            # Standings
            self.standings_manager = RaceStandingsManager()
            self.standings_manager.load(self.session_key, headers)

            # Find first available driver
            available_drivers = list(self.standings_manager.driver_map.keys())
            if not available_drivers:
                return False, "No drivers found in session"

            # Load driver data (try first few until one works)
            success = False
            for dn in available_drivers[:10]:
                if self._load_driver_data(dn, headers, official_loaded):
                    success = True
                    break

            if not success:
                return False, "Could not load any driver data"

            # Normalisation bounds
            points = self.track_layout if official_loaded else [(p['x'], p['y']) for p in self.location_cache]
            if points:
                xs = [p[0] for p in points]; ys = [p[1] for p in points]
                self.norm_min_x, self.norm_max_x = min(xs), max(xs)
                self.norm_min_y, self.norm_max_y = min(ys), max(ys)
                px = (self.norm_max_x - self.norm_min_x) * 0.10
                py = (self.norm_max_y - self.norm_min_y) * 0.10
                self.norm_min_x -= px; self.norm_max_x += px
                self.norm_min_y -= py; self.norm_max_y += py
            else:
                self.norm_min_x = self.norm_min_y = 0
                self.norm_max_x = self.norm_max_y = 1000

            if not official_loaded:
                seen = set(); self.track_layout = []
                for p in self.location_cache:
                    coord = (p['x'], p['y'])
                    if coord not in seen:
                        self.track_layout.append(coord); seen.add(coord)

            self.current_index = 0
            self._reset_replay_clock()

            print(f"  🏎️ Ready: {self.circuit_name} {self.session_type} — tracking {self.driver_acronym}\n")
            return True, f"Loaded {self.circuit_name} — {self.session_type}"

        except Exception as e:
            print(f"  ❌ Error: {e}")
            return False, str(e)

    # ------------------------------------------------------------------
    # Driver data loading
    # ------------------------------------------------------------------

    def _load_driver_data(self, driver_num, headers=None, official_loaded=True):
        if driver_num in self.driver_caches:
            self._activate_driver_cache(driver_num)
            return True

        if headers is None:
            headers = {"User-Agent": "Mozilla/5.0"}

        print(f"  📡 Fetching driver #{driver_num}...")

        def fetch_live(endpoint, params=None):
            fp = {'session_key': self.session_key}
            if params: fp.update(params)
            r = requests.Request('GET', f"{self.base_url}/{endpoint}",
                                 params=fp, headers=headers).prepare()
            res = requests.get(r.url, timeout=15, verify=False)
            return res.json() if res.status_code == 200 else []

        locations = fetch_live("location", {'driver_number': driver_num})
        car_data  = fetch_live("car_data",  {'driver_number': driver_num})
        laps      = fetch_live("laps",      {'driver_number': driver_num})
        stints    = fetch_live("stints",    {'driver_number': driver_num})

        if not locations or not car_data:
            print(f"  ⚠️ No data for driver #{driver_num}")
            return False

        # Sync location <-> car_data
        car_dates = [parse_dt(c.get('date', '')) for c in car_data]
        synced_locations, synced_car = [], []
        search_start = 0

        for loc in locations:
            loc_dt = parse_dt(loc.get('date', ''))
            if loc_dt is None:
                continue
            best_idx, best_delta = None, float('inf')
            window_start = max(0, search_start - 2)
            window_end   = min(len(car_data), window_start + 25)
            for i in range(window_start, window_end):
                if car_dates[i] is None: continue
                delta = abs((loc_dt - car_dates[i]).total_seconds())
                if delta < best_delta:
                    best_delta = delta; best_idx = i
                elif delta > best_delta + 0.05:
                    break
            if best_idx is not None and best_delta < 0.5:
                synced_locations.append(loc)
                synced_car.append(car_data[best_idx])
                search_start = best_idx

        # Fast-forward to session start
        start_idx = 0
        if self.session_start_dt:
            for i, c in enumerate(synced_car):
                sample_dt = parse_dt(c.get('date', ''))
                if sample_dt and sample_dt >= self.session_start_dt:
                    start_idx = i; break

        final_locations = synced_locations[start_idx:]
        final_car       = synced_car[start_idx:]

        if len(final_car) < 2:
            print(f"  ⚠️ Not enough samples for driver #{driver_num}")
            return False

        # Build cache
        cache = DriverDataCache()
        cache.location_cache = final_locations
        cache.car_data_cache = final_car
        cache.laps_cache     = laps
        cache.stints_cache   = stints
        cache.sample_dates   = [parse_dt(c.get('date', '')) for c in final_car]
        cache.total_samples  = len(final_car)

        boundaries = []
        cache.lap_by_number = {}
        for lap in laps:
            dt = parse_dt(lap.get('date_start', ''))
            if dt is not None:
                boundaries.append((dt, lap))
            ln = lap.get('lap_number')
            if ln is not None:
                try: cache.lap_by_number[int(ln)] = lap
                except: pass
        boundaries.sort(key=lambda x: x[0])
        cache.lap_boundaries  = boundaries
        cache.lap_start_dates = [b[0] for b in boundaries]

        bests = {1: None, 2: None, 3: None}
        for lap in laps:
            for sn, field in [(1,'duration_sector_1'),(2,'duration_sector_2'),(3,'duration_sector_3')]:
                val = safe_float(lap.get(field), 0.0)
                if val > 0 and (bests[sn] is None or val < bests[sn]):
                    bests[sn] = val
        cache.global_best_sectors = bests

        self.driver_caches[driver_num] = cache
        print(f"  ✅ Cached #{driver_num}: {cache.total_samples} samples, {len(stints)} stints")

        self._activate_driver_cache(driver_num)
        return True

    def _activate_driver_cache(self, driver_num):
        cache = self.driver_caches[driver_num]
        self.location_cache     = cache.location_cache
        self.car_data_cache     = cache.car_data_cache
        self.laps_cache         = cache.laps_cache
        self.stints_cache       = cache.stints_cache
        self.sample_dates       = cache.sample_dates
        self.total_samples      = cache.total_samples
        self.lap_boundaries     = cache.lap_boundaries
        self.lap_start_dates    = cache.lap_start_dates
        self.lap_by_number      = cache.lap_by_number
        self.global_best_sectors = cache.global_best_sectors

        self.driver_number = str(driver_num)
        self.last_lap_num_seen = None

        driver_info = self.standings_manager.driver_map.get(driver_num, {})
        self.driver_acronym     = driver_info.get('acronym', f'#{driver_num}')
        self.driver_team_colour = driver_info.get('team_colour', 'FFFFFF')

    def switch_driver(self, driver_num):
        driver_num = int(driver_num)
        if str(driver_num) == str(self.driver_number):
            return True, f"Already tracking #{driver_num}"
        if self.session_key is None:
            return False, "No session loaded"

        _, _, _, current_target_dt = self._get_replay_state()

        success = self._load_driver_data(driver_num)
        if not success:
            return False, f"No data for driver #{driver_num}"

        if current_target_dt and self.sample_dates:
            valid_dates = [dt for dt in self.sample_dates if dt is not None]
            if valid_dates:
                self.replay_data_start = valid_dates[0]
                self.replay_data_end   = valid_dates[-1]
                if current_target_dt < self.replay_data_start:
                    current_target_dt = self.replay_data_start
                elif current_target_dt > self.replay_data_end:
                    current_target_dt = self.replay_data_end
                elapsed_data = (current_target_dt - self.replay_data_start).total_seconds()
                self.replay_wall_start = time.monotonic() - (elapsed_data / self.replay_speed)

        return True, f"Now tracking {self.driver_acronym} (#{driver_num})"

    # ------------------------------------------------------------------
    # Replay clock
    # ------------------------------------------------------------------

    def _reset_replay_clock(self):
        self.current_index = 0
        self.last_lap_num_seen = None
        self.replay_wall_start = time.monotonic()
        valid = [dt for dt in self.sample_dates if dt is not None]
        self.replay_data_start = valid[0]  if valid else None
        self.replay_data_end   = valid[-1] if valid else None

    def _get_replay_state(self):
        if not self.sample_dates or not self.replay_data_start:
            return 0, 0, 0.0, None
        elapsed_wall = (time.monotonic() - self.replay_wall_start) * self.replay_speed
        target_dt    = self.replay_data_start + timedelta(seconds=elapsed_wall)
        if self.replay_data_end and target_dt >= self.replay_data_end:
            self._reset_replay_clock()
            target_dt = self.replay_data_start

        idx1 = bisect_right(self.sample_dates, target_dt)
        if idx1 <= 0:
            idx0, idx1, alpha = 0, 1, 0.0
        elif idx1 >= self.total_samples:
            idx0, idx1, alpha = self.total_samples - 2, self.total_samples - 1, 1.0
        else:
            idx0 = idx1 - 1
            dt0, dt1 = self.sample_dates[idx0], self.sample_dates[idx1]
            total = (dt1 - dt0).total_seconds() if (dt0 and dt1) else 0
            part  = (target_dt - dt0).total_seconds() if dt0 else 0
            alpha = max(0.0, min(1.0, part / total)) if total > 0 else 0.0

        self.current_index = idx0
        return idx0, idx1, alpha, target_dt

    def _interpolate_numeric(self, a, b, key, alpha, default=0.0):
        va = safe_float(a.get(key), default)
        vb = safe_float(b.get(key), va)
        return lerp(va, vb, alpha)

    # ------------------------------------------------------------------
    # Weather
    # ------------------------------------------------------------------

    def _get_weather_at(self, curr_dt):
        default = {"air_temperature": None, "track_temperature": None,
                   "humidity": None, "pressure": None,
                   "wind_speed": None, "wind_direction": None, "rainfall": 0}
        if curr_dt is None or not self.weather_cache:
            return default
        idx = bisect_right(self.weather_dates, curr_dt) - 1
        if idx < 0: return default
        w = self.weather_cache[idx]
        return {
            "air_temperature": w.get("air_temperature"),
            "track_temperature": w.get("track_temperature"),
            "humidity": w.get("humidity"), "pressure": w.get("pressure"),
            "wind_speed": w.get("wind_speed"), "wind_direction": w.get("wind_direction"),
            "rainfall": w.get("rainfall", 0),
        }

    # ------------------------------------------------------------------
    # Tyres / Stints
    # ------------------------------------------------------------------

    def _get_current_stint(self, lap_num):
        if not self.stints_cache:
            return {"compound": "UNKNOWN", "tyre_age": 0, "stint_number": 0}
        current_stint = None
        for stint in self.stints_cache:
            lap_start = stint.get('lap_start', 0) or 0
            lap_end   = stint.get('lap_end') or 9999
            if lap_start <= lap_num <= lap_end:
                current_stint = stint; break
        if current_stint is None and self.stints_cache:
            current_stint = self.stints_cache[-1]
        if current_stint:
            compound = (current_stint.get('compound') or 'UNKNOWN').upper()
            lap_start = current_stint.get('lap_start', 1) or 1
            tyre_age = max(0, lap_num - lap_start + 1)
            return {"compound": compound, "tyre_age": tyre_age, "stint_number": current_stint.get('stint_number', 1)}
        return {"compound": "UNKNOWN", "tyre_age": 0, "stint_number": 0}

    # ------------------------------------------------------------------
    # Lap + sector helpers
    # ------------------------------------------------------------------

    def _find_current_lap_by_dt(self, curr_dt):
        if not self.lap_boundaries or curr_dt is None: return None
        idx = bisect_right(self.lap_start_dates, curr_dt) - 1
        return None if idx < 0 else self.lap_boundaries[idx][1]

    def _previous_personal_best(self, lap_num, sector_num):
        field = f'duration_sector_{sector_num}'; best = None
        for lap in self.laps_cache:
            n = lap.get('lap_number')
            if n is None: continue
            try: n = int(n)
            except: continue
            if n >= lap_num: continue
            val = safe_float(lap.get(field), 0.0)
            if val > 0 and (best is None or val < best): best = val
        return best

    def _sector_color(self, lap_num, sector_num, value):
        if not value or value <= 0: return None
        gb = self.global_best_sectors.get(sector_num)
        pb = self._previous_personal_best(lap_num, sector_num)
        eps = 0.001
        if gb is not None and abs(value - gb) <= eps: return "purple"
        if pb is None or value < pb - eps: return "green"
        return "yellow"

    def _format_completed_lap(self, lap):
        if not lap: return None
        lap_num = int(lap.get('lap_number', 1))
        s1 = safe_float(lap.get('duration_sector_1'), 0.0)
        s2 = safe_float(lap.get('duration_sector_2'), 0.0)
        s3 = safe_float(lap.get('duration_sector_3'), 0.0)
        tot = safe_float(lap.get('lap_duration'), 0.0)
        if s3 <= 0 and tot > 0 and s1 > 0 and s2 > 0:
            s3 = max(0.0, tot - s1 - s2)
        return {
            "lap": lap_num, "sector_1": s1, "sector_2": s2, "sector_3": s3, "lap_time": tot,
            "sector_1_color": self._sector_color(lap_num, 1, s1),
            "sector_2_color": self._sector_color(lap_num, 2, s2),
            "sector_3_color": self._sector_color(lap_num, 3, s3),
        }

    # ------------------------------------------------------------------
    # Flag status
    # ------------------------------------------------------------------

    def _race_control_status(self, curr_dt):
        default = {"label": "GREEN FLAG", "type": "green", "message": "Track clear", "flag": "GREEN"}
        if curr_dt is None or not self.flag_timeline: return default
        idx = bisect_right(self.flag_timeline_dates, curr_dt) - 1
        if idx < 0: return default

        dt, label, type_, scope, rc = self.flag_timeline[idx]

        if type_ == "green" and scope == "sector":
            for i in range(idx - 1, -1, -1):
                _, _, prev_type, prev_scope, prev_rc = self.flag_timeline[i]
                if prev_scope == "track":
                    if prev_type != "green":
                        return {"label": self.flag_timeline[i][1], "type": prev_type,
                                "message": prev_rc.get('message') or self.flag_timeline[i][1], "flag": prev_rc.get('flag')}
                    else: break
                if prev_type in ("red", "safety_car", "vsc"):
                    return {"label": self.flag_timeline[i][1], "type": prev_type,
                            "message": prev_rc.get('message') or self.flag_timeline[i][1], "flag": prev_rc.get('flag')}
            return default

        return {"label": label, "type": type_, "message": rc.get('message') or label, "flag": rc.get('flag')}

    # ------------------------------------------------------------------
    # Normalisation
    # ------------------------------------------------------------------

    def normalize(self, val, min_v, max_v):
        if max_v == min_v: return 500
        return ((val - min_v) / (max_v - min_v)) * 900 + 50

    def calculate_steering(self, x, y, px, py, nx, ny):
        dx1, dy1 = x - px, y - py
        dx2, dy2 = nx - x, ny - y
        cross = dx1 * dy2 - dy1 * dx2
        return max(-400, min(400, cross * 2))

    # ------------------------------------------------------------------
    # Main telemetry tick
    # ------------------------------------------------------------------

    def get_next_telemetry(self):
        if self.session_key is None or self.total_samples == 0:
            return None

        idx0, idx1, alpha, target_dt = self._get_replay_state()
        self._current_replay_dt = target_dt

        now = time.monotonic()
        if (self._last_standings_update is None or
                now - self._last_standings_update >= self._standings_update_interval):
            self.standings_manager.update(target_dt)
            self._last_standings_update = now

        car0, car1 = self.car_data_cache[idx0], self.car_data_cache[idx1]
        loc0, loc1 = self.location_cache[idx0], self.location_cache[idx1]

        raw_x = lerp(safe_float(loc0.get('x')), safe_float(loc1.get('x')), alpha)
        raw_y = lerp(safe_float(loc0.get('y')), safe_float(loc1.get('y')), alpha)
        curr_x = self.normalize(raw_x, self.norm_min_x, self.norm_max_x)
        curr_y = self.normalize(raw_y, self.norm_min_y, self.norm_max_y)

        pi = max(0, idx0 - 1); ni = min(self.total_samples - 1, idx1 + 1)
        pp = self.location_cache[pi]; pn = self.location_cache[ni]
        px_ = self.normalize(pp['x'], self.norm_min_x, self.norm_max_x)
        py_ = self.normalize(pp['y'], self.norm_min_y, self.norm_max_y)
        nx_ = self.normalize(pn['x'], self.norm_min_x, self.norm_max_x)
        ny_ = self.normalize(pn['y'], self.norm_min_y, self.norm_max_y)
        steering = self.calculate_steering(curr_x, curr_y, px_, py_, nx_, ny_)

        current_lap_data = self._find_current_lap_by_dt(target_dt)
        completed_lap = None

        if current_lap_data:
            lap_num = int(current_lap_data.get('lap_number', 1))
            if self.last_lap_num_seen is None:
                self.last_lap_num_seen = lap_num
            elif lap_num != self.last_lap_num_seen:
                prev_lap = self.lap_by_number.get(self.last_lap_num_seen)
                completed_lap = self._format_completed_lap(prev_lap)
                self.last_lap_num_seen = lap_num

            s1o = safe_float(current_lap_data.get('duration_sector_1'), 0.0)
            s2o = safe_float(current_lap_data.get('duration_sector_2'), 0.0)
            s3o = safe_float(current_lap_data.get('duration_sector_3'), 0.0)
            lto = safe_float(current_lap_data.get('lap_duration'), 0.0)

            start_dt = parse_dt(current_lap_data.get('date_start', ''))
            elapsed = max(0.0, (target_dt - start_dt).total_seconds()) if start_dt and target_dt else 0.0
            lap_time = min(elapsed, lto) if lto > 0 else elapsed

            s1 = s2 = s3 = 0.0; s1c = s2c = s3c = None; eps = 0.10
            if s1o > 0 and elapsed >= s1o - eps:
                s1 = s1o; s1c = self._sector_color(lap_num, 1, s1)
            if s1o > 0 and s2o > 0 and elapsed >= s1o + s2o - eps:
                s2 = s2o; s2c = self._sector_color(lap_num, 2, s2)
            if lto > 0 and elapsed >= lto - eps:
                s3 = s3o if s3o > 0 else max(0.0, lto - s1o - s2o)
                s3c = self._sector_color(lap_num, 3, s3)

            if lto > 0 and elapsed >= lto - eps:   current_sector = 4
            elif s1 > 0 and s2 > 0:                current_sector = 3
            elif s1 > 0:                            current_sector = 2
            else:                                   current_sector = 1
        else:
            lap_num = 1; s1 = s2 = s3 = 0.0; lap_time = 0.0
            current_sector = 1; s1c = s2c = s3c = None

        stint_info = self._get_current_stint(lap_num)

        return {
            "x": curr_x, "y": curr_y,
            "speed":    self._interpolate_numeric(car0, car1, 'speed', alpha),
            "gear":     car0.get('n_gear', 0),
            "rpm":      self._interpolate_numeric(car0, car1, 'rpm', alpha),
            "throttle": self._interpolate_numeric(car0, car1, 'throttle', alpha),
            "brake":    self._interpolate_numeric(car0, car1, 'brake', alpha),
            "drs":      car0.get('drs', 0),
            "steering": steering,
            "lap": lap_num, "total_laps": self.total_laps, "lap_time": lap_time,
            "sector_1": s1, "sector_2": s2, "sector_3": s3,
            "sector_1_color": s1c, "sector_2_color": s2c, "sector_3_color": s3c,
            "date": target_dt.isoformat() if target_dt else car0.get('date', ''),
            "current_sector": current_sector,
            "completed_lap": completed_lap,
            "race_control": self._race_control_status(target_dt),
            "weather": self._get_weather_at(target_dt),
            "driver_acronym": self.driver_acronym,
            "driver_team_colour": self.driver_team_colour,
            "driver_number": int(self.driver_number),
            "tyre_compound": stint_info["compound"],
            "tyre_age": stint_info["tyre_age"],
            "stint_number": stint_info["stint_number"],
        }

    def get_race_positions(self):
        if self.session_key is None:
            return []
        self.standings_manager.update(self._current_replay_dt)
        return self.standings_manager.get_display()


# ---------------------------------------------------------------------------
# No session loaded at startup — user selects from frontend
# ---------------------------------------------------------------------------

connector = OpenF1Connector()
print("🏁 Server ready — waiting for session selection from frontend.\n")


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
    if not seconds or seconds == 0: return "0:00.000"
    m = int(seconds // 60); s = seconds % 60
    return f"{m}:{s:06.3f}"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route('/api/telemetry', methods=['GET'])
def get_telemetry():
    data = connector.get_next_telemetry()
    if data is None:
        return jsonify({"error": "No session loaded"}), 503

    compound = data.get('tyre_compound', 'MEDIUM')
    base_map = {"SOFT": 95, "MEDIUM": 90, "HARD": 85, "INTERMEDIATE": 65, "WET": 50}
    base_temp = base_map.get(compound, 90) + (data.get('speed', 0) / 15)
    data['tire_fl'] = base_temp + random.uniform(-1, 3)
    data['tire_fr'] = base_temp + random.uniform(-1, 3)
    data['tire_rl'] = base_temp + random.uniform(-3, 1)
    data['tire_rr'] = base_temp + random.uniform(-3, 1)
    return jsonify(data)


@app.route('/api/race-positions', methods=['GET'])
def get_race_positions():
    try:
        return jsonify(connector.get_race_positions())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/session-info', methods=['GET'])
def get_session_info():
    if connector.session_key is None:
        return jsonify({"circuit": None, "session_type": None, "active": False})
    return jsonify({
        "circuit": connector.circuit_name,
        "session_type": connector.session_type,
        "driver_acronym": connector.driver_acronym,
        "driver_number": int(connector.driver_number),
        "driver_team_colour": connector.driver_team_colour,
        "total_laps": connector.total_laps,
        "active": True,
    })


@app.route('/api/switch-driver', methods=['POST'])
def switch_driver():
    try:
        body = request.get_json(force=True)
        driver_num = body.get('driver_number')
        if driver_num is None:
            return jsonify({"success": False, "message": "Missing driver_number"}), 400
        success, message = connector.switch_driver(int(driver_num))
        return jsonify({
            "success": success, "message": message,
            "driver_number": int(connector.driver_number),
            "driver_acronym": connector.driver_acronym,
            "driver_team_colour": connector.driver_team_colour,
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/track-layout', methods=['GET'])
def get_track_layout():
    if connector.session_key is None or not connector.track_layout:
        return jsonify({"points": "", "rotation": 0})
    normalized = [
        (connector.normalize(x, connector.norm_min_x, connector.norm_max_x),
         connector.normalize(y, connector.norm_min_y, connector.norm_max_y))
        for x, y in connector.track_layout
    ]
    svg_points = " ".join([f"{x},{y}" for x, y in normalized])
    return jsonify({"points": svg_points, "rotation": connector.track_rotation})


@app.route('/api/race-events', methods=['GET'])
def get_race_events():
    try:
        curr_dt = connector._current_replay_dt
        if curr_dt is None or not connector.race_control_cache:
            return jsonify({"events": []})
        idx = bisect_right([rc['_dt'] for rc in connector.race_control_cache], curr_dt)
        events_raw = list(reversed(connector.race_control_cache[:idx]))
        events = []
        for rc in events_raw[:50]:
            category = rc.get('category', ''); flag = rc.get('flag', '')
            event_type = 'info'
            if category == 'Flag':
                if 'RED' in (flag or '').upper(): event_type = 'red'
                elif 'YELLOW' in (flag or '').upper(): event_type = 'yellow'
                elif 'GREEN' in (flag or '').upper(): event_type = 'green'
                elif 'BLUE' in (flag or '').upper(): event_type = 'blue'
                elif 'CHEQUERED' in (flag or '').upper(): event_type = 'chequered'
                elif 'BLACK' in (flag or '').upper(): event_type = 'black'
                else: event_type = 'flag'
            elif category == 'SafetyCar': event_type = 'safety_car'
            elif category == 'Drs': event_type = 'drs'
            elif category == 'SessionStatus': event_type = 'session'
            elif category == 'CarEvent': event_type = 'car_event'
            events.append({
                "date": rc.get('date', ''), "category": category, "flag": flag,
                "message": rc.get('message', ''), "scope": rc.get('scope', ''),
                "sector": rc.get('sector'), "lap_number": rc.get('lap_number'),
                "driver_number": rc.get('driver_number'), "type": event_type,
            })
        return jsonify({"events": events})
    except Exception as e:
        return jsonify({"events": [], "error": str(e)}), 200


# --- Replay session selector ---

@app.route('/api/replay/years', methods=['GET'])
def replay_years():
    return jsonify([2024, 2023, 2022, 2021, 2020])


@app.route('/api/replay/meetings/<int:year>', methods=['GET'])
def replay_meetings(year):
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        req = requests.Request('GET', f"{connector.base_url}/meetings",
                               params={'year': year}, headers=headers).prepare()
        resp = requests.get(req.url, timeout=10, verify=False)
        if resp.status_code != 200: return jsonify([])
        meetings = resp.json()
        result = []
        for m in meetings:
            result.append({
                'meeting_key': m.get('meeting_key'),
                'name': m.get('meeting_name', m.get('meeting_official_name', 'Unknown')),
                'country': m.get('country_name', ''),
                'circuit': m.get('circuit_short_name', ''),
                'date_start': (m.get('date_start') or '')[:10],
            })
        result.sort(key=lambda x: x.get('date_start', ''))
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/replay/sessions/<int:meeting_key>', methods=['GET'])
def replay_sessions(meeting_key):
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        req = requests.Request('GET', f"{connector.base_url}/sessions",
                               params={'meeting_key': meeting_key}, headers=headers).prepare()
        resp = requests.get(req.url, timeout=10, verify=False)
        if resp.status_code != 200: return jsonify([])
        sessions = resp.json()
        result = []
        for s in sessions:
            result.append({
                'session_key': s.get('session_key'),
                'session_name': s.get('session_name', ''),
                'session_type': s.get('session_type', ''),
                'date_start': s.get('date_start', ''),
            })
        result.sort(key=lambda x: x.get('date_start', ''))
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/replay/load', methods=['POST'])
def replay_load():
    try:
        body = request.get_json(force=True)
        session_key = body.get('session_key')
        if not session_key:
            return jsonify({"success": False, "message": "Missing session_key"}), 400
        success, message = connector.reinitialize_session(int(session_key))
        return jsonify({
            "success": success, "message": message,
            "circuit": connector.circuit_name,
            "session_type": connector.session_type,
            "driver_acronym": connector.driver_acronym,
            "driver_number": int(connector.driver_number),
            "total_laps": connector.total_laps,
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# --- Other existing routes ---

@app.route('/api/historical', methods=['GET'])
def get_historical_data():
    db = get_db(); cursor = db.cursor()
    track_id = request.args.get('track_id'); driver_id = request.args.get('driver_id')
    query = ("SELECT d.driver_name, d.team, t.track_name, r.lap_time_sec, r.year "
             "FROM results r JOIN drivers d ON r.driver_id = d.id "
             "JOIN tracks t ON r.track_id = t.id WHERE 1=1")
    params = []
    if track_id: query += " AND r.track_id = ?"; params.append(track_id)
    if driver_id: query += " AND r.driver_id = ?"; params.append(driver_id)
    query += " ORDER BY r.lap_time_sec ASC"
    cursor.execute(query, params); rows = cursor.fetchall()
    results = [{'driver': r['driver_name'], 'team': r['team'], 'track': r['track_name'],
                'time': format_time(r['lap_time_sec']), 'year': r['year'], 'is_live': False} for r in rows]
    cursor.execute("SELECT id, track_name FROM tracks"); tracks = [{'id': t['id'], 'name': t['track_name']} for t in cursor.fetchall()]
    cursor.execute("SELECT id, driver_name FROM drivers"); drivers = [{'id': d['id'], 'name': d['driver_name']} for d in cursor.fetchall()]
    return jsonify({'results': results, 'tracks': tracks, 'drivers': drivers})


@app.route('/api/championship/years', methods=['GET'])
def get_championship_years():
    return jsonify([2024, 2023, 2022, 2021, 2020])


@app.route('/api/championship/<int:year>', methods=['GET'])
def get_championship_data(year):
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        sessions = []
        req = requests.Request('GET', f"{connector.base_url}/sessions", params={'year': year, 'session_name': 'Race'}, headers=headers).prepare()
        resp = requests.get(req.url, timeout=10, verify=False)
        if resp.status_code == 200: sessions = resp.json()
        if not sessions:
            req = requests.Request('GET', f"{connector.base_url}/sessions", params={'year': year}, headers=headers).prepare()
            resp = requests.get(req.url, timeout=10, verify=False)
            if resp.status_code == 200: sessions = [s for s in resp.json() if s.get('session_type') == 'Race' or s.get('session_name') == 'Race']
        if not sessions: return jsonify({'year': year, 'races': []}), 200
        sessions.sort(key=lambda x: x.get('date_start', ''))
        races_list = []
        for s in sessions:
            if 'session_key' in s:
                rn = s.get('meeting_name') or s.get('circuit_short_name') or s.get('country_name') or "Unknown GP"
                cn = s.get('circuit_short_name') or ""
                dn = f"{rn} ({cn})" if cn and rn != cn else rn
                races_list.append({'session_key': s['session_key'], 'meeting_key': s.get('meeting_key', 0), 'name': dn, 'date': s.get('date_start', '')[:10], 'country': s.get('country_name', 'Unknown')})
        return jsonify({'year': year, 'races': races_list})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/race-result/<int:session_key>', methods=['GET'])
def get_race_result(session_key):
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        req_res = requests.Request('GET', f"{connector.base_url}/session_result", params={'session_key': session_key}, headers=headers).prepare()
        resp_res = requests.get(req_res.url, timeout=10, verify=False)
        if resp_res.status_code != 200: return jsonify({'results': []}), 500
        results = resp_res.json()
        if not results: return jsonify({'results': []}), 200
        req_drv = requests.Request('GET', f"{connector.base_url}/drivers", params={'session_key': session_key}, headers=headers).prepare()
        resp_drv = requests.get(req_drv.url, timeout=10, verify=False)
        driver_map = {}
        if resp_drv.status_code == 200:
            for d in resp_drv.json():
                num = str(d.get('driver_number')); name = d.get('full_name') or f"{d.get('first_name','')} {d.get('last_name','')}".strip()
                if num and name: driver_map[num] = name
        enriched = []
        for r in results:
            r['driver_name'] = driver_map.get(str(r.get('driver_number', '')), f"Driver #{r.get('driver_number')}")
            enriched.append(r)
        enriched.sort(key=lambda x: x.get('position') if x.get('position') is not None else 99)
        return jsonify({'results': enriched})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/championship-standings/<int:year>', methods=['GET'])
def get_real_standings(year):
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        req = requests.Request('GET', f"{connector.base_url}/sessions", params={'year': year, 'session_type': 'Race'}, headers=headers).prepare()
        resp = requests.get(req.url, timeout=10, verify=False)
        sessions = resp.json() if resp.status_code == 200 else []
        if not sessions:
            req = requests.Request('GET', f"{connector.base_url}/sessions", params={'year': year}, headers=headers).prepare()
            resp = requests.get(req.url, timeout=10, verify=False)
            sessions = [s for s in (resp.json() if resp.status_code == 200 else []) if s.get('session_type') == 'Race' or s.get('session_name') == 'Race']
        if not sessions: return jsonify({'standings': [], 'message': f"No data for {year}"}), 200
        sessions.sort(key=lambda x: x.get('date_start', ''))
        last_key = sessions[-1]['session_key']
        stand_req = requests.Request('GET', f"{connector.base_url}/championship_drivers", params={'session_key': last_key}, headers=headers).prepare()
        stand_resp = requests.get(stand_req.url, timeout=10, verify=False)
        if stand_resp.status_code != 200: return jsonify({'standings': []}), 200
        data = stand_resp.json()
        if not isinstance(data, list): return jsonify({'standings': [], 'message': "Invalid format"}), 200
        req_drv = requests.Request('GET', f"{connector.base_url}/drivers", params={'session_key': last_key}, headers=headers).prepare()
        resp_drv = requests.get(req_drv.url, timeout=10, verify=False)
        driver_map = {}
        if resp_drv.status_code == 200:
            for d in resp_drv.json():
                if isinstance(d, dict):
                    num = str(d.get('driver_number')); name = d.get('full_name') or f"{d.get('first_name','')} {d.get('last_name','')}".strip()
                    if num and name: driver_map[num] = name
        enriched = []
        for row in data:
            if not isinstance(row, dict): continue
            row['driver_name'] = driver_map.get(str(row.get('driver_number', '')), f"Driver #{row.get('driver_number')}")
            enriched.append(row)
        enriched.sort(key=lambda x: x.get('position_current', 99))
        return jsonify({'standings': enriched})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/live-stream', methods=['GET'])
def get_live_stream():
    db = get_db(); cursor = db.cursor()
    cursor.execute("SELECT id, driver_name, team FROM drivers ORDER BY RANDOM() LIMIT 1"); rd = cursor.fetchone()
    cursor.execute("SELECT id, track_name FROM tracks ORDER BY RANDOM() LIMIT 1"); rt = cursor.fetchone()
    live = None
    if rd and rt:
        live = {'driver': rd['driver_name'], 'team': rd['team'], 'track': rt['track_name'], 'time': format_time(80.0 + random.random() * 5.0), 'year': 2026, 'is_live': True}
    cursor.execute("SELECT d.driver_name, d.team, t.track_name, r.lap_time_sec, r.year FROM results r JOIN drivers d ON r.driver_id = d.id JOIN tracks t ON r.track_id = t.id ORDER BY r.id DESC LIMIT 10")
    rows = cursor.fetchall()
    history = [{'driver': r['driver_name'], 'team': r['team'], 'track': r['track_name'], 'time': format_time(r['lap_time_sec']), 'year': r['year'], 'is_live': False} for r in rows]
    return jsonify({'results': [live] + history if live else history, 'message': 'Live stream active'})


if __name__ == '__main__':
    app.run(debug=True, port=5000)