import { useState, useEffect } from 'react'
import axios from 'axios'

// Utility function to convert seconds to H:MM:SS.mmm or M:SS.mmm
const formatRaceTime = (seconds) => {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return "-";
  
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);

  const mm = minutes.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  const mmm = ms.toString().padStart(3, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}.${mmm}`;
  }
  return `${minutes}:${ss}.${mmm}`;
};

// Helper to normalize country code for flag-icons
// flag-icons uses ISO 3166-1 alpha-2 codes (e.g., 'fr', 'gb', 'us')
const getCountryCode = (countryName) => {
  if (!countryName) return 'xx'; // 'xx' is often unknown/neutral

  const codeMap = {
    'Bahrain': 'bh',
    'Saudi Arabia': 'sa',
    'Australia': 'au',
    'Azerbaijan': 'az',
    'Japan': 'jp',
    'China': 'cn',
    'Miami': 'us', // Miami is in US
    'Emilia Romagna': 'it', // Imola
    'Monaco': 'mc',
    'Canada': 'ca',
    'Spain': 'es',
    'Austria': 'at',
    'Great Britain': 'gb',
    'UK': 'gb',
    'Hungary': 'hu',
    'Belgium': 'be',
    'Netherlands': 'nl',
    'Italy': 'it',
    'Singapore': 'sg',
    'United States': 'us',
    'USA': 'us',
    'Mexico': 'mx',
    'Brazil': 'br',
    'Las Vegas': 'us',
    'Qatar': 'qa',
    'Abu Dhabi': 'ae',
    'UAE': 'ae'
  };

  // Try direct match first (case insensitive)
  const lowerName = countryName.toLowerCase();
  
  // Check if the API already sent a code (e.g. 'FR')
  if (countryName.length === 2) {
    return countryName.toLowerCase();
  }

  // Check our map for full country names
  for (const [name, code] of Object.entries(codeMap)) {
    if (lowerName.includes(name.toLowerCase())) {
      return code;
    }
  }

  return 'xx'; // Fallback flag
};

function HistoricalPage() {
  const [years, setYears] = useState([])
  const [selectedYear, setSelectedYear] = useState(2024)
  const [races, setRaces] = useState([])
  const [selectedRace, setSelectedRace] = useState('championship')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('championship')

  // 1. Load years on startup
  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/championship/years')
      .then(res => setYears(res.data))
      .catch(err => console.error(err))
  }, [])

  // 2. Load races when year changes
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

  // 3. Fetch data
  const fetchStandings = (year) => {
    setLoading(true)
    setViewMode('championship')
    setData([]) // Clear data immediately
    
    axios.get(`http://127.0.0.1:5000/api/championship-standings/${year}`)
      .then(res => {
        if (res.data.standings) {
            setData(res.data.standings);
        } else {
            setData([]);
        }
      })
      .catch(err => {
        console.error(err);
        if (err.response && err.response.data && err.response.data.error) {
            setData({ message: err.response.data.error });
        }
      })
      .finally(() => setLoading(false))
  }

  const fetchRaceResult = (sessionKey) => {
    setLoading(true)
    setViewMode('race')
    setData([]) // Clear data immediately
    
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
    <div>
      <div>
        <h2 className="fw-bold text-dark">Results</h2>
        <p className="text-muted">Explore past seasons and race results.</p>
      </div>
      
      <div>
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
              <option value="championship">
                <span className="fi fi-xx me-2"></span> {selectedYear} Championship Standings
              </option>
              {races.map(r => {
                const flagCode = getCountryCode(r.country);
                return (
                  <option key={r.session_key} value={r.session_key}>
                    <span className={`fi fi-${flagCode} me-2`}></span> {r.name} ({r.date})
                  </option>
                );
              })}
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
            {data.length === 0 ? (
              <div className="alert alert-warning text-center py-4" role="alert">
                <h4 className="alert-heading">No Results Available</h4>
                <p>
                  {data.message || "Data for this season is not available in the OpenF1 archive."}
                </p>
                <hr />
                <p className="mb-0 small">
                  Try another year or check if the season was completed.
                </p>
              </div>
            ) : (
              <table className="table table-hover align-middle">
                <thead className="table-dark">
                  <tr>
                    <th scope="col" className="ps-3">Pos</th>
                    <th scope="col">Driver</th>
                    <th scope="col">Team / Info</th>
                    
                    {viewMode === 'championship' ? (
                      <>
                        <th scope="col" className="text-end">Points</th>
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
                  {data.map((row, idx) => {
                    const isDNF = row.dnf || row.dns || row.dsq;
                    const pos = row.position_current || row.position;
                    
                    let posDisplay = pos;

                    const timeDisplay = viewMode === 'race' ? formatRaceTime(row.duration) : "-";
                    
                    let gapDisplay = "";
                    if (viewMode === 'race' && row.gap_to_leader !== null && row.gap_to_leader !== undefined) {
                        if (typeof row.gap_to_leader === 'number') {
                            gapDisplay = `+${row.gap_to_leader.toFixed(3)}s`;
                        } else {
                            gapDisplay = String(row.gap_to_leader);
                        }
                    }

                    return (
                      <tr key={idx}>
                        <td className="ps-3 fw-bold fs-5">
                          {posDisplay}
                          {isDNF && <span className="badge bg-danger">DNF</span>}</td>
                        <td>
                          <div className="fw-bold">{row.driver_name || `Driver #${row.driver_number}`}</div>
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
                          </>
                        ) : (
                          <>
                            <td className="text-end font-monospace fs-6">
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
                  })}
                </tbody>
              </table>
            )}
            
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