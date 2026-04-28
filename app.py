from flask import Flask, jsonify, g, request
from flask_cors import CORS
import sqlite3
import random

app = Flask(__name__)
CORS(app) # Enable Cross-Origin Resource Sharing for React
DATABASE = 'f1_race_db.sqlite'

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
# ROUTE 1: HISTORICAL DATA (Static, Filterable)
# ---------------------------------------------------------
@app.route('/api/historical', methods=['GET'])
def get_historical_data():
    db = get_db()
    cursor = db.cursor()
    
    track_id = request.args.get('track_id')
    driver_id = request.args.get('driver_id')
    
    query = """
        SELECT d.driver_name, d.team, t.track_name, r.lap_time_sec, r.year
        FROM results r
        JOIN drivers d ON r.driver_id = d.id
        JOIN tracks t ON r.track_id = t.id
        WHERE 1=1
    """
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
    
    results_data = [{
        'driver': row['driver_name'],
        'team': row['team'],
        'track': row['track_name'],
        'time': format_time(row['lap_time_sec']),
        'year': row['year'],
        'is_live': False
    } for row in rows]
    
    # Fetch lists for filters
    cursor.execute("SELECT id, track_name FROM tracks")
    tracks = [{'id': t['id'], 'name': t['track_name']} for t in cursor.fetchall()]
    
    cursor.execute("SELECT id, driver_name FROM drivers")
    drivers = [{'id': d['id'], 'name': d['driver_name']} for d in cursor.fetchall()]
    
    return jsonify({
        'results': results_data,
        'tracks': tracks,
        'drivers': drivers
    })

# ---------------------------------------------------------
# ROUTE 2: LIVE STREAM (Dynamic, No Filters needed for demo)
# ---------------------------------------------------------
@app.route('/api/live-stream', methods=['GET'])
def get_live_stream():
    db = get_db()
    cursor = db.cursor()
    
    # 1. Generate a random "Live" event
    cursor.execute("SELECT id, driver_name, team FROM drivers ORDER BY RANDOM() LIMIT 1")
    random_driver = cursor.fetchone()
    cursor.execute("SELECT id, track_name FROM tracks ORDER BY RANDOM() LIMIT 1")
    random_track = cursor.fetchone()
    
    live_entry = None
    if random_driver and random_track:
        fake_lap_time = 80.0 + random.random() * 5.0
        live_entry = {
            'driver': random_driver['driver_name'],
            'team': random_driver['team'],
            'track': random_track['track_name'],
            'time': format_time(fake_lap_time),
            'year': 2026,
            'is_live': True
        }
    
    # 2. Fetch recent historical data to fill the table
    query = """
        SELECT d.driver_name, d.team, t.track_name, r.lap_time_sec, r.year
        FROM results r
        JOIN drivers d ON r.driver_id = d.id
        JOIN tracks t ON r.track_id = t.id
        ORDER BY r.id DESC LIMIT 10
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    
    history_data = [{
        'driver': row['driver_name'],
        'team': row['team'],
        'track': row['track_name'],
        'time': format_time(row['lap_time_sec']),
        'year': row['year'],
        'is_live': False
    } for row in rows]
    
    # Combine: Live entry first, then history
    final_results = []
    if live_entry:
        final_results.append(live_entry)
    final_results.extend(history_data)
    
    return jsonify({
        'results': final_results,
        'message': 'Live stream active'
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)