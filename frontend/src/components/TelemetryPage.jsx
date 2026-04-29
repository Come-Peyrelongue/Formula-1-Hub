import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

function TelemetryPage() {
  const [telemetry, setTelemetry] = useState(null)
  const [error, setError] = useState(null)
  
  // Define the same track points as Python for the SVG visualization
  const trackPoints = [
    "500,900 450,850 400,800 350,700 300,600 250,500 200,450 150,400",
    "100,350 50,300 50,200 100,150 200,100 300,50 400,50 500,100",
    "600,150 700,200 800,250 900,300 950,400 950,500 900,600 850,700",
    "800,800 700,850 600,900 500,900"
  ].join(" ")

  const fetchData = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/telemetry')
      setTelemetry(response.data)
      setError(null)
    } catch (err) {
      setError("Connection lost with Simulator Server")
    }
  }

  useEffect(() => {
    fetchData()
    // High frequency polling for smooth animation (100ms)
    const intervalId = setInterval(fetchData, 100)
    return () => clearInterval(intervalId)
  }, [])

  if (!telemetry) return <div className="p-5">Connecting to Simulator Server...</div>

  return (
    <div className="container-fluid mt-3">
      <div className="row">
        {/* LEFT: Live Map */}
        <div className="col-md-8">
          <div className="card bg-dark text-white p-2" style={{height: '600px'}}>
            <h4 className="text-warning">📍 Live Track Map</h4>
            <svg viewBox="0 0 1000 1000" className="w-100 h-100" style={{background: '#222'}}>
              {/* Draw Track */}
              <polyline 
                points={trackPoints} 
                fill="none" 
                stroke="#555" 
                strokeWidth="40" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
              <polyline 
                points={trackPoints} 
                fill="none" 
                stroke="#888" 
                strokeWidth="36" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
              
              {/* Draw Car */}
              <g transform={`translate(${telemetry.x}, ${telemetry.y})`}>
                <circle r="15" fill="#ff0000" stroke="#fff" strokeWidth="2" />
                {/* Direction indicator */}
                <line x1="0" y1="0" x2="0" y2="-30" stroke="#fff" strokeWidth="3" />
              </g>
            </svg>
            
            {error && <div className="alert alert-danger position-absolute top-0 end-0 m-3">{error}</div>}
          </div>
        </div>

        {/* RIGHT: Telemetry Gauges */}
        <div className="col-md-4">
          <div className="card p-3 mb-3">
            <h4 className="text-danger">🏎️ Car Status</h4>
            <div className="display-4 text-center my-3">{telemetry.speed.toFixed(1)} <span className="fs-4">km/h</span></div>
            <div className="text-center text-muted">Gear: {telemetry.gear}</div>
          </div>

          <div className="card p-3 mb-3">
            <h5>Steering Angle</h5>
            <div className="progress" style={{height: '30px'}}>
              <div 
                className="progress-bar bg-warning" 
                style={{width: `${50 + (telemetry.steering / 6)}%`}} // Map -300/300 to 0-100%
              >
                {telemetry.steering.toFixed(0)}°
              </div>
            </div>
          </div>

          <div className="card p-3 mb-3">
            <h5>Pedals</h5>
            <div className="mb-2">
              <small>Throttle</small>
              <div className="progress" style={{height: '20px'}}>
                <div className="progress-bar bg-success" style={{width: `${telemetry.throttle}%`}}></div>
              </div>
            </div>
            <div>
              <small>Brake</small>
              <div className="progress" style={{height: '20px'}}>
                <div className="progress-bar bg-danger" style={{width: `${telemetry.brake}%`}}></div>
              </div>
            </div>
          </div>

          <div className="card p-3">
            <h5>Session Info</h5>
            <ul className="list-group list-group-flush">
              <li className="list-group-item d-flex justify-content-between">
                <span>Lap</span> <strong>{telemetry.lap}</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>Lap Time</span> <strong className="text-warning">{telemetry.lap_time.toFixed(2)}s</strong>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>Track Temp</span> <span>{telemetry.track_temp}°C</span>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>Air Temp</span> <span>{telemetry.air_temp}°C</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TelemetryPage