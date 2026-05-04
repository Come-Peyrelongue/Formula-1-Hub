import { useState, useEffect } from 'react'
import axios from 'axios'

function HistoricalPage() {
  const [years, setYears] = useState([])
  const [selectedYear, setSelectedYear] = useState(2024)
  const [races, setRaces] = useState([])
  const [selectedRace, setSelectedRace] = useState('championship')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('championship')

  // 1. Charger les années au démarrage
  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/championship/years')
      .then(res => setYears(res.data))
      .catch(err => console.error(err))
  }, [])

  // 2. Charger les courses quand l'année change
  useEffect(() => {
    if (!selectedYear) return
    setLoading(true)
    axios.get(`http://127.0.0.1:5000/api/championship/${selectedYear}`)
      .then(res => {
        setRaces(res.data.races)
        setSelectedRace('championship')
        fetchStandings(selectedYear)
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [selectedYear])

  // 3. Fetcher les données
  const fetchStandings = (year) => {
    setLoading(true)
    setViewMode('championship')
    axios.get(`http://127.0.0.1:5000/api/championship-standings/${year}`)
      .then(res => setData(res.data.standings))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  const fetchRaceResult = (sessionKey) => {
    setLoading(true)
    setViewMode('race')
    axios.get(`http://127.0.0.1:5000/api/race-result/${sessionKey}`)
      .then(res => setData(res.data.results))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  const handleRaceChange = (e) => {
    const val = e.target.value
    setSelectedRace(val)
    if (val === 'championship') {
      fetchStandings(selectedYear)
    } else {
      fetchRaceResult(val)
    }
  }

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white border-bottom-0 pt-4">
        <h2 className="fw-bold text-dark">📜 Historical Archives</h2>
        <p className="text-muted">Explore past seasons and race results.</p>
      </div>
      
      <div className="card-body">
        {/* Controls */}
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <label className="form-label fw-bold">Season</label>
            <select 
              className="form-select form-select-lg" 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {years.map(y => <option key={y} value={y}>{y} Season</option>)}
            </select>
          </div>
          
          <div className="col-md-8">
            <label className="form-label fw-bold">Event</label>
            <select 
              className="form-select form-select-lg" 
              value={selectedRace} 
              onChange={handleRaceChange}
              disabled={loading}
            >
              <option value="championship">🏆 {selectedYear} Championship Standings</option>
              {races.map(r => (
                <option key={r.session_key} value={r.session_key}>
                  🏁 {r.name} ({r.date})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-warning" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2 text-muted">Fetching F1 Archives...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-dark">
                <tr>
                  <th scope="col" className="ps-3">Pos</th>
                  <th scope="col">Driver</th>
                  <th scope="col">Team / Info</th>
                  
                  {viewMode === 'championship' ? (
                    <>
                      <th scope="col" className="text-end">Points</th>
                      <th scope="col" className="text-center">Pos</th>
                    </>
                  ) : (
                    <>
                      <th scope="col" className="text-end">Time / Gap</th>
                      <th scope="col" className="text-center">Laps</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-4">No results found for this race.</td></tr>
                ) : (
                  data.map((row, idx) => {
                    const isDNF = row.dnf || row.dns || row.dsq;
                    const pos = row.position_current || row.position;
                    
                    // Sécurité pour l'affichage des médailles
                    let posDisplay = pos;
                    if (pos === 1) posDisplay = '🥇';
                    else if (pos === 2) posDisplay = '🥈';
                    else if (pos === 3) posDisplay = '🥉';

                    // Sécurité pour le temps/écart
                    let timeDisplay = "-";
                    let gapDisplay = "";
                    
                    if (viewMode === 'race') {
                        if (row.duration) {
                            timeDisplay = row.duration.toFixed(3) + "s";
                        } else {
                            timeDisplay = "+ LAP"; // Ou DNF
                        }

                        // Gestion robuste du gap_to_leader
                        if (row.gap_to_leader !== null && row.gap_to_leader !== undefined) {
                            // Si c'est un nombre, on formate. Si c'est une chaîne (ex: "+1 LAP"), on l'affiche telle quelle.
                            if (typeof row.gap_to_leader === 'number') {
                                gapDisplay = `+${row.gap_to_leader.toFixed(3)}s`;
                            } else {
                                gapDisplay = String(row.gap_to_leader);
                            }
                        }
                    }

                    return (
                      <tr key={idx}>
                        <td className="ps-3 fw-bold fs-5">{posDisplay}</td>
                        <td>
                          <div className="fw-bold">{row.driver_name || `Driver #${row.driver_number}`}</div>
                          {isDNF && <span className="badge bg-danger">DNF</span>}
                        </td>
                        <td>
                          <small className="text-muted">
                            {row.dsq ? 'Disqualified' : (viewMode === 'championship' ? 'Season Complete' : 'Finished')}
                          </small>
                        </td>
                        
                        {viewMode === 'championship' ? (
                          <>
                            <td className="text-end fw-bold fs-5 text-primary">
                              {row.points_current !== undefined ? row.points_current : '-'}
                            </td>
                            <td className="text-center text-muted">
                              {row.position_current !== undefined ? row.position_current : '-'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="text-end font-monospace">
                              {timeDisplay}
                              {gapDisplay && (
                                <div className="small text-muted">{gapDisplay}</div>
                              )}
                            </td>
                            <td className="text-center">{row.number_of_laps || '-'}</td>
                          </>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            
            {viewMode === 'championship' && data.length > 0 && (
              <div className="alert alert-info mt-3">
                <small>ℹ️ Showing final championship standings for {selectedYear}.</small>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoricalPage