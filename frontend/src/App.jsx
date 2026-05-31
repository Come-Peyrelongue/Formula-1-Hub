import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import Home from './components/Home'
import HistoricalPage from './components/HistoricalPage'
import LivePage from './components/LivePage'
import TelemetryPage from './components/TelemetryPage'
import 'bootstrap/dist/css/bootstrap.min.css'
import f1Logo from './assets/img/formula-1-logo.png'
import './index.css'
import './Sidebar.css'

function AppContent() {
  const { theme, toggleTheme } = useTheme()
  const [sidebarExpanded, setSidebarExpanded] = useState(false)

  return (
    <Router>
      <div className="d-flex" style={{ height: '100vh', overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <nav className={`sidebar ${sidebarExpanded ? 'sidebar--expanded' : ''}`}>
          <div>
            <ul className="nav flex-column w-100" style={{ paddingTop: '12px' }}>
              <li className="nav-item">
                <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
                  <span className="material-symbols-outlined">home</span>
                  <span className="sidebar-text">Home</span>
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/historical" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
                  <span className="material-symbols-outlined">sports_score</span>
                  <span className="sidebar-text">Historical</span>
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/live" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
                  <span className="material-symbols-outlined">avg_time</span>
                  <span className="sidebar-text">Live Timing</span>
                </NavLink>
              </li>

              <div className="sidebar-divider" />

              <li className="nav-item">
                <NavLink to="/replay" className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}>
                  <span className="material-symbols-outlined">play_circle</span>
                  <span className="sidebar-text">Replay</span>
                </NavLink>
              </li>
            </ul>
          </div>

          {/* Bottom section */}
          <div>
            {/* Theme toggle */}
            <button
              className="sidebar-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <span className="material-symbols-outlined">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
              <span className="sidebar-text">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
            </button>

            {/* Sidebar expand/collapse toggle */}
            <button
              className="sidebar-btn"
              onClick={() => setSidebarExpanded(prev => !prev)}
              title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <span className="material-symbols-outlined">
                {sidebarExpanded ? 'left_panel_close' : 'left_panel_open'}
              </span>
              <span className="sidebar-text">Collapse</span>
            </button>

            <div className="sidebar-logo-container">
              <img src={f1Logo} alt="F1" className="f1-sidebar-logo" />
              <span className="sidebar-text" style={{ fontWeight: 700, fontSize: '11px' }}>
                F1 DASHBOARD
              </span>
            </div>
          </div>
        </nav>

        {/* MAIN CONTENT */}
        <main style={{
          flex: 1,
          overflow: 'hidden',
          background: 'var(--bg-primary)',
          height: '100vh',
          padding: 'var(--gap-md)',
          transition: 'background 0.3s ease',
        }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/historical" element={<HistoricalPage />} />
            <Route path="/live" element={<LivePage />} />
            <Route path="/replay" element={<TelemetryPage />} />
          </Routes>
        </main>

      </div>
    </Router>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App