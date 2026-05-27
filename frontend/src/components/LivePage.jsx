import { useState, useEffect } from 'react'
import axios from 'axios'

function LivePage() {
  const [data, setData] = useState({ results: [] })
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const fetchData = async () => {
    try {
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
    <div className="d-flex flex-column h-100" style={{ overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, marginBottom: 'var(--gap-lg)' }}>
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2 style={{ color: 'var(--text-heading)', fontWeight: 700 }}>Live Timing</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Real-time lap data stream
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
              {lastUpdate.toLocaleTimeString()}
            </span>
            <span className="badge-live">LIVE</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-grow-1" style={{ overflow: 'auto', minHeight: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>Status</th>
              <th>Driver</th>
              <th>Team</th>
              <th>Track</th>
              <th style={{ textAlign: 'right' }}>Time</th>
              <th style={{ textAlign: 'center' }}>Year</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((r, i) => (
              <tr key={i} style={{
                background: r.is_live ? 'rgba(225, 6, 0, 0.06)' : undefined,
                borderLeft: r.is_live ? '3px solid var(--f1-red)' : '3px solid transparent',
              }}>
                <td>
                  {r.is_live ? (
                    <span style={{
                      fontSize: '9px', padding: '2px 6px',
                      background: 'var(--f1-red)', color: 'white',
                      borderRadius: '2px', fontWeight: 700,
                      fontFamily: 'var(--font-data)',
                    }}>LIVE</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                  )}
                </td>
                <td style={{ fontWeight: 600 }}>{r.driver}</td>
                <td>
                  <span style={{
                    fontSize: '10px', padding: '2px 6px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '3px',
                    color: 'var(--text-secondary)',
                  }}>
                    {r.team}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{r.track}</td>
                <td style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-data)',
                  fontWeight: 600,
                  color: r.is_live ? 'var(--f1-red)' : 'var(--accent-green)',
                }}>
                  {r.time}
                </td>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{r.year}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LivePage