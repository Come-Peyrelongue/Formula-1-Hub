import { useState, useEffect } from 'react'
import axios from 'axios'

function TelemetryPage() {
  const [telemetry, setTelemetry] = useState(null)
  const [trackPoints, setTrackPoints] = useState("")
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [debugCount, setDebugCount] = useState(0) // To prove data is updating

  const fetchData = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/telemetry')
      const data = response.data
      
      // DEBUG: Log the first 5 updates to console to verify data content
      if (debugCount < 5) {
        console.log(`Update ${debugCount}:`, data)
        setDebugCount(prev => prev + 1)
      }

      // Safety Check: Ensure we have coordinates before updating
      if (data.x !== undefined && data.y !== undefined) {
        setTelemetry(data)
        setError(null)
      }
      setLoading(false)
    } catch (err) {
      console.error("Fetch error:", err)
      setError("Connection lost with OpenF1 Server")
      setLoading(false)
    }
  }

  // Fetch Track Layout separately (One time)
  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/track-layout')
        .then(res => {
          if (res.data && res.data.points) {
            setTrackPoints(res.data.points)
            console.log("Track loaded:", res.data.points.length, "points")
          }
        })
        .catch(err => console.error("No track layout", err))
  }, [])

  useEffect(() => {
    fetchData()
    const intervalId = setInterval(fetchData, 100) // 10Hz
    return () => clearInterval(intervalId)
  }, [])

  // Helper for safe number formatting
  const safeNum = (val, decimals = 1) => {
      if (val === undefined || val === null) return "0";
      return Number(val).toFixed(decimals);
  };

  if (loading) return <div className="p-5 text-center">Loading Real Telemetry from OpenF1...</div>
  if (!telemetry) return <div className="p-5 text-danger">Error loading data.</div>

  return (
    <div className="container-fluid mt-3">
      <div className="row">
        {/* LEFT: Live Map */}
        <div className="col-md-8">
          <div className="card bg-dark text-white p-2" style={{height: '600px', position: 'relative'}}>
            <h4 className="text-warning">📍 Live Telemetry (Real Data)</h4>
            <p className="text-muted small">
              Source: OpenF1 API | Session: {telemetry.date ? new Date(telemetry.date).toLocaleTimeString() : 'Loading'}
              <span className="ms-2 text-success">● Live</span>
            </p>
            
            <svg viewBox="0 0 1000 1000" className="w-100 h-100" style={{background: '#1a1a1a'}}>
              
              {/* 1. DRAW THE TRACK */}
              {trackPoints && trackPoints.length > 0 ? (
                <polyline 
                  points={trackPoints} 
                  fill="none" 
                  stroke="#555" 
                  strokeWidth="30" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  opacity="0.8"
                />
              ) : (
                <text x="500" y="500" textAnchor="middle" fill="#666">Loading Track Layout...</text>
              )}

              {/* 2. DRAW THE CAR */}
              {telemetry && (
                <g transform={`translate(${telemetry.x}, ${telemetry.y})`}>
                  {/* Car Body */}
                  <circle r="12" fill="#ff0000" stroke="#fff" strokeWidth="2" />
                  
                  {/* Orientation Line */}
                  <line 
                    x1="0" y1="0" 
                    x2="0" y2="-25" 
                    stroke="#00ff00" 
                    strokeWidth="3" 
                    transform={`rotate(${safeNum(telemetry.steering, 0) / 10})`} 
                  />
                </g>
              )}
            </svg>
            
            {error && <div className="alert alert-danger position-absolute top-0 end-0 m-3">{error}</div>}
          </div>
        </div>

        {/* RIGHT: Gauges */}
        <div className="col-md-4">
          <div className="card p-3 mb-3 bg-dark text-white border-danger">
            <h4 className="text-danger">🏎️ Telemetry</h4>
            <div className="display-3 text-center my-3 font-monospace">
              {safeNum(telemetry.speed, 1)} <span className="fs-5">km/h</span>
            </div>
            <div className="text-center text-warning fs-4">Gear: {safeNum(telemetry.gear, 0)}</div>
          </div>

          <div className="card p-3 mb-3">
            <h5>Steering Angle</h5>
            <div className="d-flex justify-content-between mb-1">
                <span>-400°</span><span>0°</span><span>+400°</span>
            </div>
            <div className="progress" style={{height: '30px'}}>
              {/* Map -400/400 to 0-100% with safety clamp */}
              {(() => {
                const steer = Number(telemetry.steering) || 0;
                const width = Math.max(0, Math.min(100, 50 + (steer / 8)));
                return (
                  <div className="progress-bar bg-warning" style={{width: `${width}%`}}>
                    {safeNum(steer, 0)}°
                  </div>
                )
              })()}
            </div>
          </div>

          <div className="card p-3 mb-3">
            <h5>Pedals</h5>
            <div className="mb-2">
              <small>Throttle ({safeNum(telemetry.throttle, 0)}%)</small>
              <div className="progress" style={{height: '20px'}}>
                <div className="progress-bar bg-success" style={{width: `${safeNum(telemetry.throttle, 0)}%`}}></div>
              </div>
            </div>
            <div>
              <small>Brake ({safeNum(telemetry.brake, 0)}%)</small>
              <div className="progress" style={{height: '20px'}}>
                <div className="progress-bar bg-danger" style={{width: `${safeNum(telemetry.brake, 0)}%`}}></div>
              </div>
            </div>
          </div>
          
          <div className="card p-3">
             <h5>Lap Info</h5>
             <p>Lap: <strong>{telemetry.lap || 1}</strong></p>
             <p>Time: <strong className="text-warning">{formatTime(telemetry.lap_time)}</strong></p>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(seconds) {
    if (!seconds || seconds === 0) return "0:00.000";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export default TelemetryPage