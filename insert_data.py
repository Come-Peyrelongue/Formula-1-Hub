import sqlite3

def insert_sample_data():
    conn = sqlite3.connect('f1_race_db.sqlite')
    cursor = conn.cursor()

    # 1. Insert tracks
    tracks = [
        ('Silverstone', 'UK', 5.891),
        ('Spa-Francorchamps', 'Belgium', 7.004),
        ('Monza', 'Italy', 5.793),
        ('Suzuka', 'Japan', 5.807)
    ]
    cursor.executemany('INSERT INTO tracks (track_name, country, length_km) VALUES (?, ?, ?)', tracks)

    # 2. Insert Drivers
    drivers = [
        ('Max Verstappen', 'Red Bull Racing'),
        ('Lewis Hamilton', 'Mercedes'),
        ('Charles Leclerc', 'Ferrari'),
        ('Oscar Piastri', 'McLaren')
    ]
    cursor.executemany('INSERT INTO drivers (driver_name, team) VALUES (?, ?)', drivers)

    # 3. Insert Results
    # Format: (track_id, driver_id, lap_time_sec, year)
    results = [
        (1, 1, 85.500, 2025), # Verstappen at Silverstone
        (1, 2, 86.120, 2025), # Hamilton at Silverstone
        (2, 3, 105.400, 2025), # Leclerc at Spa
        (2, 1, 104.900, 2025), # Verstappen at Spa
        (3, 4, 82.300, 2025),  # Piastri at Monza
        (4, 1, 92.100, 2025)   # Verstappen at Suzuka
    ]
    cursor.executemany('INSERT INTO results (track_id, driver_id, lap_time_sec, year) VALUES (?, ?, ?, ?)', results)

    conn.commit()
    conn.close()
    print("Data inserted successfully into the database!")

if __name__ == "__main__":
    insert_sample_data()