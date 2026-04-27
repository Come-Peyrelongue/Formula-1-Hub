import sqlite3

def insert_sample_data():
    conn = sqlite3.connect('f1_race_db.sqlite')
    cursor = conn.cursor()

    # 1. Insertion des Circuits
    circuits = [
        ('Silverstone', 'Royaume-Uni', 5.891),
        ('Spa-Francorchamps', 'Belgique', 7.004),
        ('Monza', 'Italie', 5.793),
        ('Suzuka', 'Japon', 5.807)
    ]
    # On utilise executemany pour insérer plusieurs lignes d'un coup
    cursor.executemany('INSERT INTO circuits (nom_circuit, pays, longueur_km) VALUES (?, ?, ?)', circuits)

    # 2. Insertion des Pilotes
    pilotes = [
        ('Max Verstappen', 'Red Bull Racing'),
        ('Lewis Hamilton', 'Mercedes'),
        ('Charles Leclerc', 'Ferrari'),
        ('Oscar Piastri', 'McLaren')
    ]
    cursor.executemany('INSERT INTO pilotes (nom_pilote, equipe) VALUES (?, ?)', pilotes)

    # 3. Insertion de Résultats (Liens entre pilotes et circuits)
    # Format: (id_circuit, id_pilote, temps_tour_sec, annee)
    # Supposons que les IDs sont 1, 2, 3, 4 dans l'ordre d'insertion ci-dessus
    resultats = [
        (1, 1, 85.500, 2025), # Verstappen à Silverstone
        (1, 2, 86.120, 2025), # Hamilton à Silverstone
        (2, 3, 105.400, 2025), # Leclerc à Spa
        (2, 1, 104.900, 2025), # Verstappen à Spa
        (3, 4, 82.300, 2025),  # Piastri à Monza
        (4, 1, 92.100, 2025)   # Verstappen à Suzuka
    ]
    cursor.executemany('INSERT INTO resultats (id_circuit, id_pilote, temps_tour_sec, annee) VALUES (?, ?, ?, ?)', resultats)

    conn.commit()
    conn.close()
    print("Données insérées avec succès dans la base de données !")

if __name__ == "__main__":
    insert_sample_data()