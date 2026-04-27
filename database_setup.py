import sqlite3

def create_database():
    # Connexion à la base de données (le fichier sera créé automatiquement)
    conn = sqlite3.connect('f1_race_db.sqlite')
    cursor = conn.cursor()

    # 1. Table : Circuits
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS circuits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom_circuit TEXT NOT NULL,
            pays TEXT NOT NULL,
            longueur_km REAL NOT NULL
        )
    ''')

    # 2. Table : Pilotes
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pilotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom_pilote TEXT NOT NULL,
            equipe TEXT NOT NULL
        )
    ''')

    # 3. Table : Resultats (Table de liaison)
    # Elle lie un pilote à un circuit avec une performance
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS resultats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_circuit INTEGER,
            id_pilote INTEGER,
            temps_tour_sec REAL NOT NULL,
            annee INTEGER NOT NULL,
            FOREIGN KEY (id_circuit) REFERENCES circuits(id),
            FOREIGN KEY (id_pilote) REFERENCES pilotes(id)
        )
    ''')

    # Validation des changements et fermeture
    conn.commit()
    conn.close()
    print("Base de données 'f1_race_db.sqlite' créée avec succès !")

if __name__ == "__main__":
    create_database()