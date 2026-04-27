import sqlite3

def get_connection():
    return sqlite3.connect('f1_race_db.sqlite')

def afficher_temps_moyen_par_circuit():
    """Calcule le temps moyen au tour pour chaque circuit."""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT c.nom_circuit, AVG(r.temps_tour_sec) as temps_moyen
        FROM resultats r
        JOIN circuits c ON r.id_circuit = c.id
        GROUP BY c.nom_circuit
        ORDER BY temps_moyen ASC
    """
    
    cursor.execute(query)
    resultats = cursor.fetchall()
    
    print("--- Temps moyen au tour par circuit ---")
    for circuit, temps in resultats:
        # Conversion du temps en format mm:ss.ms pour la lisibilité
        minutes = int(temps // 60)
        secondes = temps % 60
        print(f"{circuit}: {minutes}m {secondes:.3f}s")
    
    conn.close()

def afficher_meilleur_tour_par_pilote():
    """Affiche le meilleur temps réalisé par chaque pilote."""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT p.nom_pilote, MIN(r.temps_tour_sec) as meilleur_temps
        FROM resultats r
        JOIN pilotes p ON r.id_pilote = p.id
        GROUP BY p.nom_pilote
        ORDER BY meilleur_temps ASC
    """
    
    cursor.execute(query)
    resultats = cursor.fetchall()
    
    print("\n--- Meilleur temps par pilote ---")
    for pilote, temps in resultats:
        minutes = int(temps // 60)
        secondes = temps % 60
        print(f"{pilote}: {minutes}m {secondes:.3f}s")
        
    conn.close()

def filtrer_par_equipe(equipe_recherchee):
    """Trouve tous les résultats d'une équipe spécifique."""
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT p.nom_pilote, c.nom_circuit, r.temps_tour_sec, r.annee
        FROM resultats r
        JOIN pilotes p ON r.id_pilote = p.id
        JOIN circuits c ON r.id_circuit = c.id
        WHERE p.equipe = ?
    """
    
    cursor.execute(query, (equipe_recherchee,))
    resultats = cursor.fetchall()
    
    print(f"\n--- Résultats pour l'équipe : {equipe_recherchee} ---")
    if not resultats:
        print("Aucun résultat trouvé.")
    else:
        for pilote, circuit, temps, annee in resultats:
            print(f"{pilote} à {circuit} ({annee}) : {temps:.3f}s")
            
    conn.close()

if __name__ == "__main__":
    afficher_temps_moyen_par_circuit()
    afficher_meilleur_tour_par_pilote()
    filtrer_par_equipe('Red Bull Racing')