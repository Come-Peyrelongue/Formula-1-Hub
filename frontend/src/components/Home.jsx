import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="mt-5 text-center">
      <h1 className="display-4 mb-2">F1 Hub Training App</h1>
      <p className="lead mb-5">Select a tool to access track data.</p>
      
      <div className="row justify-content-center">
        <div className="col-md-5 mb-4">
          <div className="card h-100 ">
            <div className="card-body d-flex flex-column justify-content-between">
              <h3 className="card-title">📊 Historical Analysis</h3>
              <p className="card-text">Analyze past performance, filter by driver and track.</p>
              <Link to="/historical" className="btn btn-primary btn-lg">Open Tool</Link>
            </div>
          </div>
        </div>
        
        <div className="col-md-5 mb-4">
          <div className="card h-100">
            <div className="card-body d-flex flex-column justify-content-between">
              <h3 className="card-title text-danger">🔴 Live Timing</h3>
              <p className="card-text">Follow the session in real-time with auto-updates.</p>
              <Link to="/live" className="btn btn-danger btn-lg">Go Live</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home