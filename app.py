from flask import Flask, jsonify, g, request
from flask_cors import CORS
import sqlite3

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

@app.route('/api/data', methods=['GET'])
def get_data():
    db = get_db()
    cursor = db.cursor()
    
    # Get Filters from URL params (optional)
    track_id = request.args.get('track_id')
    driver_id = request.args.get('driver_id')
    
    # Base Query
    # Note: Using 'tracks' table and 'track_name' column as per your correction
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
    
    # Get lists for dropdowns
    cursor.execute("SELECT id, track_name FROM tracks")
    tracks = cursor.fetchall()
    
    cursor.execute("SELECT id, driver_name FROM drivers")
    drivers = cursor.fetchall()
    
    # Format Data
    results_data = [{
        'driver': row['driver_name'],
        'team': row['team'],
        'track': row['track_name'],
        'time': format_time(row['lap_time_sec']),
        'year': row['year']
    } for row in rows]
    
    tracks_data = [{'id': t['id'], 'name': t['track_name']} for t in tracks]
    drivers_data = [{'id': d['id'], 'name': d['driver_name']} for d in drivers]
    
    return jsonify({
        'results': results_data,
        'tracks': tracks_data,
        'drivers': drivers_data
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)