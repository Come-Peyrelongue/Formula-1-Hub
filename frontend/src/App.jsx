import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Home from './components/Home'
import HistoricalPage from './components/HistoricalPage'
import LivePage from './components/LivePage'
import TelemetryPage from './components/TelemetryPage'
import 'bootstrap/dist/css/bootstrap.min.css'

function App() {
  return (
    <Router>
      <nav className="navbar navbar-dark bg-black mb-4">
        <div className="container">
          <Link to="/" className="navbar-brand">F1 Hub Training App</Link>
          <div className="d-flex gap-3">
            <Link to="/historical" className="nav-link text-white">Historical</Link>
            <Link to="/live" className="nav-link text-white">Live Timing</Link>
            <Link to="/telemetry" className="nav-link text-warning">Simulator</Link>
          </div>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/historical" element={<HistoricalPage />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/telemetry" element={<TelemetryPage />} />
      </Routes>
    </Router>
  )
}

export default App