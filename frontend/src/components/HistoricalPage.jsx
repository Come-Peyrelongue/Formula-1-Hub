import { useState, useEffect } from 'react'
import axios from 'axios'

function HistoricalPage() {
  const [data, setData] = useState({ results: [], tracks: [], drivers: [] })
  const [selectedTrack, setSelectedTrack] = useState('')
  const [selectedDriver, setSelectedDriver] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      // Specific Route for Historical Data
      let url = 'http://127.0.0.1:5000/api/historical?' 
      if (selectedTrack) url += `track_id=${selectedTrack}&`
      if (selectedDriver) url += `driver_id=${selectedDriver}&`
      
      const response = await axios.get(url)
      setData(response.data)
    } catch (error) {
      console.error("Error:", error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [selectedTrack, selectedDriver])

  return (
    <div className="container mt-4">
      <h2>📊 Historical Database</h2>
      <div className="row mt-3">
        <div className="col-md-4">
          <div className="card p-3">
             <label className="form-label">Track</label>
             <select className="form-select" value={selectedTrack} onChange={e => setSelectedTrack(e.target.value)}>
                <option value="">All Tracks</option>
                {data.tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
             </select>
             
             <label className="form-label mt-2">Driver</label>
             <select className="form-select" value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
                <option value="">All Drivers</option>
                {data.drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
             </select>
          </div>
        </div>
        <div className="col-md-8">
          <table className="table table-striped">
            <thead><tr><th>Driver</th><th>Team</th><th>Track</th><th>Time</th><th>Year</th></tr></thead>
            <tbody>
              {data.results.map((r, i) => (
                <tr key={i}>
                  <td><strong>{r.driver}</strong></td>
                  <td><span className="badge bg-secondary">{r.team}</span></td>
                  <td>{r.track}</td>
                  <td className="text-success fw-bold">{r.time}</td>
                  <td>{r.year}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default HistoricalPage