import sqlite3

def get_connection():
    return sqlite3.connect('f1_race_db.sqlite')

def format_time(seconds):
    """Converts seconds (float) to F1 standard format: M:SS.mmm"""
    minutes = int(seconds // 60)
    remaining_seconds = seconds % 60
    # :06.3f ensures we always have 2 digits for seconds and 3 for milliseconds
    return f"{minutes}:{remaining_seconds:06.3f}"

def show_avg_lap_time_per_track():
    """Calculates the average lap time for each track."""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT c.track_name, AVG(r.lap_time_sec) as avg_time
        FROM results r
        JOIN tracks c ON r.track_id = c.id
        GROUP BY c.track_name
        ORDER BY avg_time ASC
    """
    
    cursor.execute(query)
    results = cursor.fetchall()
    
    print("--- Average Lap Time per track ---")
    for track, time in results:
        formatted_time = format_time(time)
        print(f"{track}: {formatted_time}")
    
    conn.close()

def show_best_lap_per_driver():
    """Displays the best lap time achieved by each driver."""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT d.driver_name, MIN(r.lap_time_sec) as best_time
        FROM results r
        JOIN drivers d ON r.driver_id = d.id
        GROUP BY d.driver_name
        ORDER BY best_time ASC
    """
    
    cursor.execute(query)
    results = cursor.fetchall()
    
    print("\n--- Best Lap Time per Driver ---")
    for driver, time in results:
        formatted_time = format_time(time)
        print(f"{driver}: {formatted_time}")
        
    conn.close()

def filter_by_team(team_search):
    """Finds all results for a specific team."""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT d.driver_name, c.track_name, r.lap_time_sec, r.year
        FROM results r
        JOIN drivers d ON r.driver_id = d.id
        JOIN tracks c ON r.track_id = c.id
        WHERE d.team = ?
    """
    
    cursor.execute(query, (team_search,))
    results = cursor.fetchall()
    
    print(f"\n--- Results for Team: {team_search} ---")
    if not results:
        print("No results found.")
    else:
        for driver, track, time, year in results:
            formatted_time = format_time(time)
            print(f"{driver} at {track} ({year}) : {formatted_time}")
            
    conn.close()

if __name__ == "__main__":
    show_avg_lap_time_per_track()
    show_best_lap_per_driver()
    filter_by_team('Red Bull Racing')