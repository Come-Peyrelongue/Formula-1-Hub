import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Home from './components/Home'
import HistoricalPage from './components/HistoricalPage'
import LivePage from './components/LivePage'
import TelemetryPage from './components/TelemetryPage'
import 'bootstrap/dist/css/bootstrap.min.css'
import f1Logo from './assets/img/formula-1-logo.png' 
import './Sidebar.css'

function App() {
  return (
    <Router>
      <div className="d-flex h-100">
        
        {/* LEFT NAVBAR avec classe personnalisée */}
        <nav className="sidebar-expand-hover d-flex flex-column justify-content-between p-2 text-white bg-black align-items-start">
          
          <ul className="nav flex-column w-100">
            <li className="nav-item">
              <Link to="/" className="nav-link text-white d-flex align-items-center">
                <span className="material-symbols-outlined fs-3 mx-2">home</span>
                <span className="sidebar-text">Home</span>
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/historical" className="nav-link text-white d-flex align-items-center">
                <span className="material-symbols-outlined fs-3 mx-2">sports_score</span>
                <span className="sidebar-text">Historical</span>
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/live" className="nav-link text-white d-flex align-items-center">
                <span className="material-symbols-outlined fs-3 mx-2">avg_time</span>
                <span className="sidebar-text">Live Timing</span>
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/telemetry" className="nav-link text-success fw-bold d-flex align-items-center">
                <span className="material-symbols-outlined fs-3 mx-2">live_tv</span>
                <span className="sidebar-text">Simulator</span>
              </Link>
            </li>
          </ul>

          <div className="sidebar-logo-container">
            <img src={f1Logo} alt="F1 Logo" className="f1-sidebar-logo" />
            <span className="sidebar-text fw-bold ms-2">F1 Hub</span>
          </div>
        </nav>

        {/* RIGHT CONTENT AREA */}
        <main className="flex-grow-1 overflow-auto bg-light" style={{ height: '100vh' }}>
          <div className="container-fluid p-4 h-100">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/historical" element={<HistoricalPage />} />
              <Route path="/live" element={<LivePage />} />
              <Route path="/telemetry" element={<TelemetryPage />} />
            </Routes>
          </div>
        </main>
        
      </div>
    </Router>
  )
}

export default App