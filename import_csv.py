import sqlite3
import csv
import os

# Define the path to the data folder
DATA_FOLDER = 'data'
CSV_FILENAME = 'lap_times.csv'
CSV_PATH = os.path.join(DATA_FOLDER, CSV_FILENAME)

def convert_time_to_seconds(time_str):
    """Converts 'M:SS.mmm' string to float seconds."""
    time_str = time_str.strip()
    try:
        parts = time_str.split(':')
        minutes = int(parts[0])
        seconds = float(parts[1])
        return minutes * 60 + seconds
    except (ValueError, IndexError):
        print(f"Error parsing time: {time_str}")
        return None

def get_or_create_id(cursor, table, name_column, name_value):
    """Helper to get ID if exists, or return None if not found."""
    cursor.execute(f"SELECT id FROM {table} WHERE {name_column} = ?", (name_value,))
    result = cursor.fetchone()
    if result:
        return result[0]
    return None

def import_csv_data():
    if not os.path.exists(CSV_PATH):
        print(f"Error: File not found at {CSV_PATH}")
        return

    conn = sqlite3.connect('f1_race_db.sqlite')
    cursor = conn.cursor()

    with open(CSV_PATH, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        
        count_inserted = 0
        count_skipped = 0

        for row in reader:
            # 1. Clean data (remove extra spaces)
            driver_name = row['driver_name'].strip()
            track_name = row['track_name'].strip() # Changed column name to track_name
            time_str = row['lap_time_str'].strip()
            year = int(row['year'])

            # 2. Convert time to seconds
            lap_time_sec = convert_time_to_seconds(time_str)
            if lap_time_sec is None:
                count_skipped += 1
                continue

            # 3. Verify Driver and Track exist in DB
            # Note: We still query the 'tracks' table in SQL, but we treat it as 'tracks' logically
            # Ideally, you might rename the table in the DB later, but for now we map track_name -> tracks table
            driver_id = get_or_create_id(cursor, 'drivers', 'driver_name', driver_name)
            
            # Check if the track exists in the 'tracks' table
            cursor.execute("SELECT id FROM tracks WHERE track_name = ?", (track_name,))
            result = cursor.fetchone()
            
            track_id = result[0] if result else None

            if driver_id and track_id:
                # 4. Insert into results
                cursor.execute('''
                    INSERT INTO results (track_id, driver_id, lap_time_sec, year)
                    VALUES (?, ?, ?, ?)
                ''', (track_id, driver_id, lap_time_sec, year))
                count_inserted += 1
            else:
                print(f"Skipped row: Driver '{driver_name}' or Track '{track_name}' not found in database.")
                count_skipped += 1

    conn.commit()
    conn.close()
    print(f"Import complete: {count_inserted} rows inserted, {count_skipped} rows skipped.")

if __name__ == "__main__":
    import_csv_data()