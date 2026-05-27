import { useState, useEffect } from 'react'
import axios from 'axios'

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
  if (hours > 0) return `${hours}:${mm}:${ss}.${mmm}`;
  return `${minutes}:${ss}.${mmm}`;
};

const getCountryCode = (countryName) => {
  if (!countryName) return 'xx';
  const codeMap = {
    'Bahrain': 'bh', 'Saudi Arabia': 'sa', 'Australia': 'au', 'Azerbaijan': 'az',
    'Japan': 'jp', 'China': 'cn', 'Miami': 'us', 'Emilia Romagna': 'it',
    'Monaco': 'mc', 'Canada': 'ca', 'Spain': 'es', 'Austria': 'at',
    'Great Britain': 'gb', 'UK': 'gb', 'Hungary': 'hu', 'Belgium': 'be',
    'Netherlands': 'nl', 'Italy': 'it', 'Singapore': 'sg', 'United States': 'us',
    'USA': 'us', 'Mexico': 'mx', 'Brazil': 'br', 'Las Vegas': 'us',
    'Qatar': 'qa', 'Abu Dhabi': 'ae', 'UAE': 'ae'
  };
  if (countryName.length === 2) return countryName.toLowerCase();
  const lowerName = countryName.toLowerCase();
  for (const [name, code] of Object.entries(codeMap)) {
    if (lowerName.includes(name.toLowerCase())) return code;
  }
  return 'xx';
};

function HistoricalPage() {
  const [years, setYears] = useState([])
  const [selectedYear, setSelectedYear] = useState(2024)
  const [races, setRaces] = useState([])
  const [selectedRace, setSelectedRace] = useState('championship')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('championship')

  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/championship/years')
      .then(res => setYears(res.data))
      .catch(err => console.error(err))
  }, [])

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

  const fetchStandings = (year) => {
    setLoading(true)
    setViewMode('championship')
    setData([])
    axios.get(`http://127.0.0.1:5000/api/championship-standings/${year}`)
      .then(res => {
        if (res.data.standings) setData(res.data.standings);
        else setData([]);
      })
      .catch(err => {
        console.error(err);
        if (err.response?.data?.error) setData({ message: err.response.data.error });
      })
      .finally(() => setLoading(false))
  }

  const fetchRaceResult = (sessionKey) => {
    setLoading(true)
    setViewMode('race')
    setData([])
    axios.get(`http://127.0.0.1:5000/api/race-result/${sessionKey}`)
      .then(res => setData(res.data.results))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  const handleRaceChange = (e) => {
    const val = e.target.value
    setSelectedRace(val)
    if (val === 'championship') fetchStandings(selectedYear)
    else fetchRaceResult(val)
  }

  return (
    <div className="d-flex flex-column h-100" style={{ overflow: 'hidden' }}>

      {/* Page Header */}
      <div style={{ flexShrink: 0, marginBottom: 'var(--gap-lg)' }}>
        <h2 style={{ color: 'var(--text-heading)', fontWeight: 700 }}>Results</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Explore past seasons and race results.
        </p>
      </div>

      {/* Controls */}
      <div className="row g-3 mb-3" style={{ flexShrink: 0 }}>
        <div className="col-md-4">
          <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
            Season
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'var(--font-ui)',
              outline: 'none',
            }}
          >
            {years.map(y => <option key={y} value={y}>{y} Season</option>)}
          </select>
        </div>

        <div className="col-md-8">
          <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
            Event
          </label>
          <select
            value={selectedRace}
            onChange={handleRaceChange}
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'var(--font-ui)',
              outline: 'none',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <option value="championship">{selectedYear} Championship Standings</option>
            {races.map(r => (
              <option key={r.session_key} value={r.session_key}>
                {r.name} ({r.date})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-grow-1" style={{ overflow: 'auto', minHeight: 0 }}>
        {loading ? (
          <div className="d-flex flex-column align-items-center justify-content-center py-5">
            <div className="spinner-border" role="status" style={{ color: 'var(--f1-red)' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Fetching F1 Archives...
            </p>
          </div>
        ) : data.length === 0 ? (
          <div style={{
            padding: '32px',
            textAlign: 'center',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}>
            <h4 style={{ color: 'var(--text-heading)', marginBottom: '8px' }}>No Results Available</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              {data.message || "Data for this season is not available in the OpenF1 archive."}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '12px' }}>
              Try another year or check if the season was completed.
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>Pos</th>
                <th>Driver</th>
                <th>Info</th>
                {viewMode === 'championship' ? (
                  <th style={{ textAlign: 'right' }}>Points</th>
                ) : (
                  <>
                    <th style={{ textAlign: 'right' }}>Time / Gap</th>
                    <th style={{ textAlign: 'center' }}>Laps</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                const pos = row.position_current || row.position;
                const isDNF = row.dnf || row.dns || row.dsq;
                const timeDisplay = viewMode === 'race' ? formatRaceTime(row.duration) : "-";

                let gapDisplay = "";
                if (viewMode === 'race' && row.gap_to_leader !== null && row.gap_to_leader !== undefined) {
                  if (typeof row.gap_to_leader === 'number') gapDisplay = `+${row.gap_to_leader.toFixed(3)}s`;
                  else gapDisplay = String(row.gap_to_leader);
                }

                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700, fontSize: '13px' }}>
                      {pos}
                      {isDNF && (
                        <span style={{
                          marginLeft: 6, fontSize: '9px', padding: '1px 4px',
                          background: 'var(--status-danger)', color: 'white',
                          borderRadius: '2px', fontWeight: 700,
                        }}>DNF</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {row.driver_name || `Driver #${row.driver_number}`}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      {row.dsq ? 'Disqualified' : (viewMode === 'championship' ? '' : 'Finished')}
                    </td>
                    {viewMode === 'championship' ? (
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px', color: 'var(--accent-yellow)', fontFamily: 'var(--font-data)' }}>
                        {row.points_current !== undefined ? row.points_current : '-'}
                      </td>
                    ) : (
                      <>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '12px' }}>
                          {timeDisplay}
                          {gapDisplay && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{gapDisplay}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '12px' }}>{row.number_of_laps || '-'}</td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {viewMode === 'championship' && data.length > 0 && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}>
            ℹ️ Showing final championship standings for {selectedYear}.
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoricalPage