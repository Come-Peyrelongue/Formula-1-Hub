import sqlite3

def create_database():
    # Connection to the database (file created automatically)
    conn = sqlite3.connect('f1_race_db.sqlite')
    cursor = conn.cursor()

    # 1. Table: tracks
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_name TEXT NOT NULL,
            country TEXT NOT NULL,
            length_km REAL NOT NULL
        )
    ''')

    # 2. Table: Drivers
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            driver_name TEXT NOT NULL,
            team TEXT NOT NULL
        )
    ''')

    # 3. Table: Results (Linking table)
    # Links a driver to a track with a performance metric
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id INTEGER,
            driver_id INTEGER,
            lap_time_sec REAL NOT NULL,
            year INTEGER NOT NULL,
            FOREIGN KEY (track_id) REFERENCES tracks(id),
            FOREIGN KEY (driver_id) REFERENCES drivers(id)
        )
    ''')

    # Commit changes and close
    conn.commit()
    conn.close()
    print("Database 'f1_race_db.sqlite' created successfully!")

if __name__ == "__main__":
    create_database()