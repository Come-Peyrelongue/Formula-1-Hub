import { useState, useEffect } from 'react'
import axios from 'axios'
import 'bootstrap/dist/css/bootstrap.min.css'

function App() {
  const [data, setData] = useState({ results: [], tracks: [], drivers: [] })
  const [selectedTrack, setSelectedTrack] = useState('')
  const [selectedDriver, setSelectedDriver] = useState('')
  const [loading, setLoading] = useState(true)

  // Fetch data from Flask API
  const fetchData = async () => {
    setLoading(true)
    try {
      let url = 'http://127.0.0.1:5000/api/data?'
      if (selectedTrack) url += `track_id=${selectedTrack}&`
      if (selectedDriver) url += `driver_id=${selectedDriver}&`
      
      const response = await axios.get(url)
      setData(response.data)
    } catch (error) {
      console.error("Error fetching data:", error)
    }
    setLoading(false)
  }

  // Fetch automatically when filters change
  useEffect(() => {
    fetchData()
  }, [selectedTrack, selectedDriver])

  const formatTime = (seconds) => {
    // In case API sends float, though we formatted in Python
    if (typeof seconds === 'number') {
        const m = Math.floor(seconds / 60)
        const s = (seconds % 60).toFixed(3)
        return `${m}:${s.padStart(6, '0')}`
    }
    return seconds
  }

  return (
    <div className="mt-4">
      <header className="bg-danger text-white p-4 mb-4 rounded text-center">
        <h1>Live Data Training App (LDTA)</h1>
      </header>

      <div className="row">
        {/* Filters */}
        <div className="col-md-4">
          <div className="card p-3 shadow-sm">
            <h4>Filters</h4>
            <div className="mb-3">
              <label className="form-label">Track</label>
              <select 
                className="form-select" 
                value={selectedTrack} 
                onChange={(e) => setSelectedTrack(e.target.value)}
              >
                <option value="">All Tracks</option>
                {data.tracks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Driver</label>
              <select 
                className="form-select" 
                value={selectedDriver} 
                onChange={(e) => setSelectedDriver(e.target.value)}
              >
                <option value="">All Drivers</option>
                {data.drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-dark" onClick={fetchData}>Refresh Data</button>
          </div>
        </div>

        {/* Table */}
        <div className="col-md-8">
          <div className="card p-3 shadow-sm">
            <h4>Lap Times</h4>
            {loading ? <p>Loading...</p> : (
              <table className="table table-hover">
                <thead className="table-dark">
                  <tr>
                    <th>Driver</th>
                    <th>Team</th>
                    <th>Track</th>
                    <th>Time</th>
                    <th>Year</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.length > 0 ? (
                    data.results.map((row, idx) => (
                      <tr key={idx}>
                        <td><strong>{row.driver}</strong></td>
                        <td><span className="badge bg-secondary">{row.team}</span></td>
                        <td>{row.track}</td>
                        <td className="text-success fw-bold">{row.time}</td>
                        <td>{row.year}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="5" className="text-center">No data found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App