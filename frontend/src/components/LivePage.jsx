import { useState, useEffect } from 'react'
import axios from 'axios'

function LivePage() {
  const [data, setData] = useState({ results: [] })
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const fetchData = async () => {
    try {
      // Specific Route for Live Stream
      const response = await axios.get('http://127.0.0.1:5000/api/live-stream')
      setData(response.data)
      setLastUpdate(new Date())
    } catch (error) {
      console.error("Stream error:", error)
    }
  }

  useEffect(() => {
    fetchData()
    const intervalId = setInterval(fetchData, 2000)
    return () => clearInterval(intervalId)
  }, [])

  return (
    <div>
      <div>
        <h2 className="fw-bold text-dark">Live Timing</h2>
      </div>
      <div>
        <table className="table table-hover">
          <thead className="table-dark">
            <tr><th>Status</th><th>Driver</th><th>Team</th><th>Track</th><th>Time</th><th>Year</th></tr>
          </thead>
          <tbody>
            {data.results.map((r, i) => (
              <tr key={i} className={r.is_live ? 'table-warning' : ''}>
                <td>
                  {r.is_live ? <span className="badge bg-danger animate__animated animate__flash">LIVE</span> : '-'}
                </td>
                <td><strong>{r.driver}</strong></td>
                <td><span className="badge bg-secondary">{r.team}</span></td>
                <td>{r.track}</td>
                <td className={r.is_live ? 'text-danger fw-bold' : 'text-success fw-bold'}>{r.time}</td>
                <td>{r.year}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LivePage