import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

// ===========================================================================
// SESSION SELECTOR
// ===========================================================================
function SessionSelector({ onSessionLoaded }) {
  const [years, setYears] = useState([])
  const [meetings, setMeetings] = useState([])
  const [sessions, setSessions] = useState([])
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [loadingMeetings, setLoadingMeetings] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingReplay, setLoadingReplay] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/replay/years')
      .then(res => { setYears(res.data); if (res.data.length) setSelectedYear(res.data[0]) })
      .catch(() => setYears([2024, 2023, 2022]))
  }, [])

  useEffect(() => {
    if (!selectedYear) return
    setLoadingMeetings(true); setMeetings([]); setSessions([]); setSelectedMeeting(null); setSelectedSession(null)
    axios.get(`http://127.0.0.1:5000/api/replay/meetings/${selectedYear}`)
      .then(res => setMeetings(res.data || []))
      .catch(() => setMeetings([]))
      .finally(() => setLoadingMeetings(false))
  }, [selectedYear])

  useEffect(() => {
    if (!selectedMeeting) return
    setLoadingSessions(true); setSessions([]); setSelectedSession(null)
    axios.get(`http://127.0.0.1:5000/api/replay/sessions/${selectedMeeting}`)
      .then(res => setSessions(res.data || []))
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false))
  }, [selectedMeeting])

  const handleStart = async () => {
    if (!selectedSession) return
    setLoadingReplay(true); setErrorMsg(null)
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/replay/load', { session_key: selectedSession })
      if (res.data.success) onSessionLoaded(res.data)
      else setErrorMsg(res.data.message || 'Failed to load session')
    } catch (err) { setErrorMsg(err.response?.data?.message || 'Connection error') }
    finally { setLoadingReplay(false) }
  }

  if (loadingReplay) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100">
        <div className="text-center">
          <div className="spinner-border mb-3" role="status" style={{ color: 'var(--f1-red)', width: '3rem', height: '3rem' }}></div>
          <h5 style={{ color: 'var(--text-heading)', marginBottom: '8px' }}>Loading Session...</h5>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Fetching telemetry data from OpenF1</p>
        </div>
      </div>
    )
  }

  const selectStyle = { width: '100%', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none', cursor: 'pointer' }

  return (
    <div className="d-flex align-items-center justify-content-center h-100">
      <div className="panel" style={{ width: '100%', maxWidth: '520px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--f1-red)', marginBottom: '8px', display: 'block' }}>play_circle</span>
          <h3 style={{ color: 'var(--text-heading)', fontWeight: 700, fontSize: '20px', marginBottom: '4px' }}>Session Replay</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Select a session to replay with full telemetry</p>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label className="data-label" style={{ display: 'block', marginBottom: '6px' }}>Season</label>
          <select style={selectStyle} value={selectedYear || ''} onChange={e => setSelectedYear(Number(e.target.value))}>
            <option value="" disabled>Select year...</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label className="data-label" style={{ display: 'block', marginBottom: '6px' }}>Event</label>
          <select style={{ ...selectStyle, opacity: loadingMeetings || !meetings.length ? 0.5 : 1 }} value={selectedMeeting || ''} onChange={e => setSelectedMeeting(Number(e.target.value))} disabled={loadingMeetings || !meetings.length}>
            <option value="" disabled>{loadingMeetings ? 'Loading...' : 'Select event...'}</option>
            {meetings.map(m => <option key={m.meeting_key} value={m.meeting_key}>{m.name} — {m.circuit} ({m.date_start})</option>)}
          </select>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label className="data-label" style={{ display: 'block', marginBottom: '6px' }}>Session</label>
          <select style={{ ...selectStyle, opacity: loadingSessions || !sessions.length ? 0.5 : 1 }} value={selectedSession || ''} onChange={e => setSelectedSession(Number(e.target.value))} disabled={loadingSessions || !sessions.length}>
            <option value="" disabled>{loadingSessions ? 'Loading...' : 'Select session...'}</option>
            {sessions.map(s => <option key={s.session_key} value={s.session_key}>{s.session_name} ({s.session_type})</option>)}
          </select>
        </div>
        {errorMsg && <div style={{ padding: '10px 14px', marginBottom: '16px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '12px', fontFamily: 'var(--font-data)' }}>{errorMsg}</div>}
        <button onClick={handleStart} disabled={!selectedSession} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 'var(--radius-md)', background: selectedSession ? 'var(--f1-red)' : 'var(--bg-elevated)', color: selectedSession ? 'white' : 'var(--text-muted)', fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-ui)', cursor: selectedSession ? 'pointer' : 'not-allowed', transition: 'all 0.2s ease', letterSpacing: '0.5px' }}>START REPLAY</button>
      </div>
    </div>
  )
}

// ===========================================================================
// SHARED COMPONENTS
// ===========================================================================
const FLAG_CONFIG = { formation: { bg: '#6f42c1', color: 'white', label: 'FORMATION LAP' }, yellow: { bg: '#fbbf24', color: '#1a1d23', label: 'YELLOW FLAG' }, red: { bg: '#ef4444', color: 'white', label: 'RED FLAG' }, safety_car: { bg: '#fbbf24', color: '#1a1d23', label: 'SAFETY CAR' }, vsc: { bg: '#fef3c7', color: '#92400e', label: 'VIRTUAL SC' }, chequered: { bg: '#1a1d23', color: 'white', label: 'CHEQUERED' }, blue: { bg: '#3b82f6', color: 'white', label: 'BLUE FLAG' }, black: { bg: '#000', color: 'white', label: 'BLACK FLAG' }, black_white: { bg: '#6b7280', color: 'white', label: 'B&W FLAG' } }
const SHOW_FLAG_TYPES = new Set(Object.keys(FLAG_CONFIG))

function FlagBanner({ raceControl }) { const type = raceControl?.type; const cfg = FLAG_CONFIG[type] || null; if (!cfg || !SHOW_FLAG_TYPES.has(type)) return null; return (<div style={{ background: cfg.bg, color: cfg.color, padding: '4px 12px', textTransform: 'uppercase', textAlign: 'center', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-data)', letterSpacing: '0.5px' }}>{cfg.label}</div>) }

function WeatherBar({ weather }) {
  if (!weather || weather.air_temperature === null) return null
  const windCardinal = (deg) => { if (deg == null) return ''; return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8] }
  const isRaining = weather.rainfall > 0
  const items = [
    { icon: 'thermostat', value: weather.air_temperature != null ? `${weather.air_temperature.toFixed(1)}°C` : '--', label: 'Air' },
    { icon: 'heat', value: weather.track_temperature != null ? `${weather.track_temperature.toFixed(1)}°C` : '--', label: 'Track' },
    { icon: isRaining ? 'rainy' : 'wb_sunny', value: isRaining ? 'Rain' : 'Dry', label: 'Condition' },
    { icon: 'humidity_percentage', value: weather.humidity != null ? `${weather.humidity.toFixed(0)}%` : '--', label: 'Humidity' },
    { icon: 'speed', value: weather.pressure != null ? `${weather.pressure.toFixed(0)} hPa` : '--', label: 'Pressure' },
    { icon: 'air', value: weather.wind_speed != null ? `${weather.wind_speed.toFixed(1)} km/h` : '--', label: weather.wind_direction != null ? `Wind | ${windCardinal(weather.wind_direction)} ${weather.wind_direction}°` : 'Wind' },
  ]
  return (<div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'nowrap' }}>{items.map((item, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{item.icon}</span><div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}><span style={{ fontSize: '11px', fontFamily: 'var(--font-data)', fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span><span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{item.label}</span></div></div>))}</div>)
}

const EVENT_STYLE = { red: { icon: 'flag', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }, yellow: { icon: 'warning', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' }, green: { icon: 'flag', color: '#00c853', bg: 'rgba(0,200,83,0.08)' }, blue: { icon: 'flag', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' }, chequered: { icon: 'sports_score', color: 'var(--text-primary)', bg: 'var(--bg-elevated)' }, black: { icon: 'flag', color: 'var(--text-primary)', bg: 'rgba(0,0,0,0.15)' }, safety_car: { icon: 'directions_car', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' }, drs: { icon: 'speed', color: '#22d3ee', bg: 'rgba(34,211,238,0.08)' }, session: { icon: 'schedule', color: 'var(--accent-purple)', bg: 'rgba(168,85,247,0.08)' }, car_event: { icon: 'build', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' }, flag: { icon: 'flag', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' }, info: { icon: 'info', color: 'var(--text-muted)', bg: 'transparent' } }

function RaceEventTimeline({ events }) {
  return (<div style={{ overflowY: 'auto', flex: 1 }}>{events.length === 0 ? <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>No events yet...</div> : events.map((ev, i) => { const st = EVENT_STYLE[ev.type] || EVENT_STYLE.info; const time = ev.date ? new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''; return (<div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', background: st.bg }}><span className="material-symbols-outlined" style={{ fontSize: '14px', color: st.color, marginTop: '1px', flexShrink: 0 }}>{st.icon}</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '10px', fontFamily: 'var(--font-data)', color: 'var(--text-primary)', lineHeight: 1.3, wordBreak: 'break-word' }}>{ev.message}</div><div style={{ display: 'flex', gap: '8px', marginTop: '2px', fontSize: '9px', color: 'var(--text-muted)' }}>{time && <span>{time}</span>}{ev.lap_number && <span>Lap {ev.lap_number}</span>}{ev.category && <span>{ev.category}</span>}</div></div></div>) })}</div>)
}

// ===========================================================================
// TYRE HELPERS
// ===========================================================================
const TYRE_WINDOWS = { SOFT: { cold: 75, optLow: 85, optHigh: 105, overheat: 115 }, MEDIUM: { cold: 80, optLow: 90, optHigh: 115, overheat: 125 }, HARD: { cold: 85, optLow: 100, optHigh: 120, overheat: 130 }, INTERMEDIATE: { cold: 45, optLow: 60, optHigh: 90, overheat: 100 }, WET: { cold: 35, optLow: 40, optHigh: 70, overheat: 80 } }
const getTyreColor = (temp, compound) => { if (!temp || temp === 0) return 'var(--sector-neutral)'; const w = TYRE_WINDOWS[compound] || TYRE_WINDOWS.MEDIUM; if (temp < w.cold) return '#3b82f6'; if (temp < w.optLow) return '#22d3ee'; if (temp <= w.optHigh) return '#00c853'; if (temp <= w.overheat) return '#fbbf24'; return '#ef4444' }
const getCompoundColor = (c) => { switch ((c || '').toUpperCase()) { case 'SOFT': return '#ef4444'; case 'MEDIUM': return '#fbbf24'; case 'HARD': return '#f0f0f0'; case 'INTERMEDIATE': return '#22c55e'; case 'WET': return '#3b82f6'; default: return '#6b7280' } }
const getCompoundTextColor = (c) => { switch ((c || '').toUpperCase()) { case 'HARD': case 'MEDIUM': return '#1a1d23'; default: return 'white' } }

// ===========================================================================
// SPEED TRACE — Pure SVG chart
// ===========================================================================
const LAP_COLORS = ['#ef4444', '#3b82f6', '#fbbf24', '#22c55e', '#a855f7', '#f97316', '#06b6d4', '#ec4899']

function SpeedTraceChart() {
  const [traceData, setTraceData] = useState(null)
  const [hoveredTime, setHoveredTime] = useState(null)
  const svgRef = useRef(null)
  const [dims, setDims] = useState({ width: 600, height: 250 })

  useEffect(() => {
    const fetchTrace = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:5000/api/speed-trace?laps=5')
        if (res.data?.laps) setTraceData(res.data)
      } catch { }
    }
    fetchTrace()
    const id = setInterval(fetchTrace, 2000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) setDims({ width, height })
      }
    })
    if (svgRef.current?.parentElement) observer.observe(svgRef.current.parentElement)
    return () => observer.disconnect()
  }, [])

  if (!traceData || !traceData.laps || traceData.laps.length === 0) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '8px', display: 'block', opacity: 0.5 }}>show_chart</span>
          Waiting for lap data...
        </div>
      </div>
    )
  }

  const PAD = { top: 16, right: 12, bottom: 28, left: 40 }
  const { width, height } = dims

  let maxTime = 0, maxSpeed = 0, minSpeed = Infinity
  traceData.laps.forEach(lap => {
    lap.points.forEach(p => {
      if (p.t > maxTime) maxTime = p.t
      if (p.speed > maxSpeed) maxSpeed = p.speed
      if (p.speed < minSpeed) minSpeed = p.speed
    })
  })
  minSpeed = Math.max(0, Math.floor(minSpeed / 10) * 10 - 10)
  maxSpeed = Math.ceil(maxSpeed / 10) * 10 + 10

  const sx = (t) => PAD.left + (t / maxTime) * (width - PAD.left - PAD.right)
  const sy = (speed) => PAD.top + (1 - (speed - minSpeed) / (maxSpeed - minSpeed)) * (height - PAD.top - PAD.bottom)

  const buildPath = (points) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.t).toFixed(1)},${sy(p.speed).toFixed(1)}`).join(' ')

  const yTicks = []; const yStep = (maxSpeed - minSpeed) > 200 ? 50 : 25
  for (let v = Math.ceil(minSpeed / yStep) * yStep; v <= maxSpeed; v += yStep) yTicks.push(v)

  const xTicks = []; for (let t = 0; t <= maxTime; t += 10) xTicks.push(t)

  const handleMouseMove = (e) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const t = ((x - PAD.left) / (width - PAD.left - PAD.right)) * maxTime
    if (t >= 0 && t <= maxTime) setHoveredTime(Math.round(t * 2) / 2)
    else setHoveredTime(null)
  }

  const getSpeedAtTime = (lap, t) => { const p = lap.points.find(p => Math.abs(p.t - t) < 0.3); return p ? p.speed : null }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredTime(null)}>
        {/* Grid */}
        {yTicks.map(v => (<g key={`y${v}`}><line x1={PAD.left} y1={sy(v)} x2={width - PAD.right} y2={sy(v)} stroke="var(--border-subtle)" strokeDasharray="2 3" /><text x={PAD.left - 5} y={sy(v) + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)" fontFamily="var(--font-data)">{v}</text></g>))}
        {xTicks.map(t => (<g key={`x${t}`}><line x1={sx(t)} y1={PAD.top} x2={sx(t)} y2={height - PAD.bottom} stroke="var(--border-subtle)" strokeDasharray="2 3" /><text x={sx(t)} y={height - PAD.bottom + 12} textAnchor="middle" fontSize="8" fill="var(--text-muted)" fontFamily="var(--font-data)">{t}s</text></g>))}

        {/* Lines */}
        {traceData.laps.map((lap, i) => (
          <path key={lap.lap_number} d={buildPath(lap.points)} fill="none" stroke={lap.is_current ? '#ffffff' : LAP_COLORS[i % LAP_COLORS.length]} strokeWidth={lap.is_current ? 2 : 1.5} strokeDasharray={lap.is_current ? '6 3' : undefined} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Hover line */}
        {hoveredTime !== null && <line x1={sx(hoveredTime)} y1={PAD.top} x2={sx(hoveredTime)} y2={height - PAD.bottom} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" opacity={0.5} />}

        {/* Legend */}
        {traceData.laps.map((lap, i) => {
          const lx = PAD.left + i * 55, ly = height - 4
          const color = lap.is_current ? '#ffffff' : LAP_COLORS[i % LAP_COLORS.length]
          return (<g key={`lg${lap.lap_number}`}><line x1={lx} y1={ly} x2={lx + 12} y2={ly} stroke={color} strokeWidth={1.5} strokeDasharray={lap.is_current ? '4 2' : undefined} /><text x={lx + 16} y={ly + 3} fontSize="8" fill={color} fontFamily="var(--font-data)" fontWeight="600">L{lap.lap_number}</text></g>)
        })}
      </svg>

      {/* Tooltip */}
      {hoveredTime !== null && (
        <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '10px', fontFamily: 'var(--font-data)', boxShadow: 'var(--shadow-elevated)', pointerEvents: 'none', zIndex: 10 }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '3px' }}>T+{hoveredTime.toFixed(1)}s</div>
          {traceData.laps.map((lap, i) => { const speed = getSpeedAtTime(lap, hoveredTime); if (speed === null) return null; return (<div key={lap.lap_number} style={{ color: lap.is_current ? '#fff' : LAP_COLORS[i % LAP_COLORS.length], display: 'flex', justifyContent: 'space-between', gap: '10px' }}><span>L{lap.lap_number}</span><span style={{ fontWeight: 700 }}>{speed}</span></div>) })}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// MAIN EXPORT
// ===========================================================================
function TelemetryPage() {
  const [sessionActive, setSessionActive] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(true)

  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/session-info')
      .then(res => { if (res.data?.active === true) setSessionActive(true) })
      .catch(() => { })
      .finally(() => setCheckingExisting(false))
  }, [])

  if (checkingExisting) return (<div className="d-flex align-items-center justify-content-center h-100"><div className="spinner-border" style={{ color: 'var(--f1-red)' }}></div></div>)
  if (!sessionActive) return <SessionSelector onSessionLoaded={() => setSessionActive(true)} />
  return <ReplayDashboard onBack={() => setSessionActive(false)} />
}

// ===========================================================================
// REPLAY DASHBOARD
// ===========================================================================
function ReplayDashboard({ onBack }) {
  const [telemetry, setTelemetry] = useState(null)
  const [trackPoints, setTrackPoints] = useState("")
  const [trackRotation, setTrackRotation] = useState(0)
  const [sessionInfo, setSessionInfo] = useState({ name: "Loading...", type: "" })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lapHistory, setLapHistory] = useState([])
  const [racePositions, setRacePositions] = useState([])
  const [raceEvents, setRaceEvents] = useState([])
  const [switchingDriver, setSwitchingDriver] = useState(false)
  const [positionChanges, setPositionChanges] = useState({})
  const [currentPage, setCurrentPage] = useState(0)
  const [paused, setPaused] = useState(false)

  const prevTelRef = useRef(null)
  const prevPositionsRef = useRef({})
  const snapContainerRef = useRef(null)

  const scrollToPage = (i) => { const c = snapContainerRef.current; if (c?.children[i]) c.children[i].scrollIntoView({ behavior: 'smooth' }) }
  const handleScroll = () => { const c = snapContainerRef.current; if (!c) return; const p = Math.round(c.scrollTop / c.clientHeight); if (p !== currentPage) setCurrentPage(p) }

  const addCompletedLap = (cl) => {
    if (!cl?.lap) return
    setLapHistory(h => {
      const key = `${cl.driver_number || trackedDriverNum}_${cl.lap}`
      if (h.some(l => l._key === key)) return h

      const newEntry = {
        _key: key,
        lap: cl.lap,
        sector_1: cl.sector_1 || 0,
        sector_2: cl.sector_2 || 0,
        sector_3: cl.sector_3 || 0,
        lap_time: cl.lap_time || 0,
        sector_1_color: cl.sector_1_color || null,
        sector_2_color: cl.sector_2_color || null,
        sector_3_color: cl.sector_3_color || null,
        lap_time_color: cl.lap_time_color || null,
        driver_acronym: cl.driver_acronym || driverAcronym,
        driver_team_colour: cl.driver_team_colour || driverTeamColour,
      }

      return [newEntry, ...h].slice(0, 40)
    })
  }

  const togglePause = async () => {
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/replay/pause')
      setPaused(res.data.paused)
    } catch (e) { console.error(e) }
  }

  const handleDriverClick = async (dn) => {
    if (switchingDriver || dn === telemetry?.driver_number) return
    setSwitchingDriver(true)
    try {
      const r = await axios.post('http://127.0.0.1:5000/api/switch-driver', { driver_number: dn })
      if (r.data.success) {
        // Don't clear lap history — keep all drivers' laps
        prevTelRef.current = null
      }
    } catch (e) { console.error(e) }
    finally { setSwitchingDriver(false) }
  }

  const fetchTelemetry = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/telemetry')
      const d = res.data
      if (d.x !== undefined && d.y !== undefined) {
        const prev = prevTelRef.current
        if (d.completed_lap) {
          addCompletedLap({
            ...d.completed_lap,
            driver_acronym: d.driver_acronym,
            driver_team_colour: d.driver_team_colour,
            driver_number: d.driver_number,
          })
        } else if (prev && d.lap !== prev.lap && prev.lap != null && d.driver_number === prev.driver_number) {
          const fs3 = prev.sector_3 || (prev.lap_time > 0 && prev.sector_1 > 0 && prev.sector_2 > 0 ? Math.max(0, prev.lap_time - prev.sector_1 - prev.sector_2) : 0)
          addCompletedLap({
            lap: prev.lap, sector_1: prev.sector_1 || 0, sector_2: prev.sector_2 || 0,
            sector_3: fs3, lap_time: prev.lap_time || 0,
            sector_1_color: prev.sector_1_color, sector_2_color: prev.sector_2_color,
            sector_3_color: prev.sector_3_color, lap_time_color: prev.lap_time_color,
            driver_acronym: prev.driver_acronym, driver_team_colour: prev.driver_team_colour,
            driver_number: prev.driver_number,
          })
        }
        prevTelRef.current = d; setTelemetry(d); setError(null)
        if (d.paused !== undefined) setPaused(d.paused)
      }
      setLoading(false)
    } catch { setError("Connection lost"); setLoading(false) }
  }

  const fetchPositions = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/race-positions')
      if (!Array.isArray(res.data)) return
      const np = res.data; const prev = prevPositionsRef.current; const ch = {}
      if (Object.keys(prev).length > 0) np.forEach(d => { const o = prev[d.driver_number]; if (o !== undefined && o !== d.position) ch[d.driver_number] = o - d.position })
      const cur = {}; np.forEach(d => { cur[d.driver_number] = d.position }); prevPositionsRef.current = cur
      if (Object.keys(ch).length > 0) { setPositionChanges(p => ({ ...p, ...ch })); setTimeout(() => { setPositionChanges(p => { const u = { ...p }; Object.keys(ch).forEach(k => delete u[k]); return u }) }, 8000) }
      setRacePositions(np)
    } catch { }
  }

  const fetchRaceEvents = async () => { try { const r = await axios.get('http://127.0.0.1:5000/api/race-events'); if (r.data?.events) setRaceEvents(r.data.events) } catch { } }

  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/session-info').then(r => { if (r.data) setSessionInfo({ name: r.data.circuit || "?", type: r.data.session_type || "?" }) }).catch(() => { })
    axios.get('http://127.0.0.1:5000/api/track-layout').then(r => { if (r.data?.points) setTrackPoints(r.data.points); if (r.data?.rotation !== undefined) setTrackRotation(r.data.rotation) }).catch(() => { })
    fetchTelemetry(); fetchPositions(); fetchRaceEvents()
    const t1 = setInterval(fetchTelemetry, 100), t2 = setInterval(fetchPositions, 4000), t3 = setInterval(fetchRaceEvents, 3000)
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3) }
  }, [])

  const safeNum = (v, d = 1) => (v == null) ? "0" : Number(v).toFixed(d)
  const formatTime = (s) => { if (!s) return "0:00.000"; const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${sec.toFixed(3).padStart(6, '0')}` }
  const formatSector = (v) => { if (!v) return "--"; const m = Math.floor(v / 60); const s = v % 60; return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3) }
  const currentSector = telemetry?.current_sector ?? 1
  const getSectorDisplay = (n) => { if (!telemetry) return { value: null, state: 'waiting', color: null }; const val = telemetry[`sector_${n}`]; const col = telemetry[`sector_${n}_color`]; if (val && val > 0) return { value: val, state: 'done', color: col }; if (n === currentSector) return { value: null, state: 'running', color: null }; return { value: null, state: 'waiting', color: null } }
  const sectorColorHex = (c, st = 'done') => { if (st === 'running') return 'var(--accent-green)'; if (c === 'purple') return 'var(--sector-purple)'; if (c === 'green') return 'var(--sector-green)'; if (c === 'yellow') return 'var(--sector-yellow)'; return 'var(--sector-neutral)' }
  const sectorTextStyle = (d) => { if (!d) return {}; if (d.state === 'running') return { color: 'var(--accent-green)', fontWeight: 700 }; if (d.state === 'done') return { color: sectorColorHex(d.color), fontWeight: 700 }; return { color: 'var(--text-muted)' } }
  const historySectorStyle = (c) => ({ color: sectorColorHex(c), fontWeight: 700 })

  const drsActive = (telemetry?.drs || 0) >= 10
  const raceControl = telemetry?.race_control || { label: 'GREEN FLAG', type: 'green' }
  const weather = telemetry?.weather || null
  const driverAcronym = telemetry?.driver_acronym || 'DRV'
  const driverTeamColour = telemetry?.driver_team_colour || 'FFFFFF'
  const trackedDriverNum = telemetry?.driver_number || 0
  const teamColorBar = (hex) => <span style={{ display: 'inline-block', width: 3, height: 14, borderRadius: 2, background: `#${hex || 'FFF'}`, marginRight: 6, flexShrink: 0 }} />
  const steerVal = telemetry?.steering || 0
  const steerPercent = Math.max(0, Math.min(100, 50 + (steerVal / 8)))

  if (loading) return (<div className="d-flex align-items-center justify-content-center h-100"><div className="text-center"><div className="spinner-border mb-3" style={{ color: 'var(--f1-red)' }}></div><h5 style={{ color: 'var(--text-secondary)' }}>Loading...</h5></div></div>)

  const t_fl = telemetry?.tire_fl || 0, t_fr = telemetry?.tire_fr || 0, t_rl = telemetry?.tire_rl || 0, t_rr = telemetry?.tire_rr || 0
  const s1 = getSectorDisplay(1), s2 = getSectorDisplay(2), s3 = getSectorDisplay(3)
  const SVG_SIZE = 1000, svgCx = 500, svgCy = 500
  const localTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const trackTime = telemetry?.date ? new Date(telemetry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'

    return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div ref={snapContainerRef} className="page-snap-container" onScroll={handleScroll} style={{ flex: 1, minWidth: 0 }}>

        {/* ===== PAGE 1 — TELEMETRY ===== */}
        <section className="page-snap-section" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)', overflow: 'hidden' }}>

          {/* Header */}
          <div className="panel" style={{ flexShrink: 0 }}>
            <div style={{ padding: '8px 14px' }}>
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span></button>
                  <h5 style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--text-heading)' }}>{sessionInfo.name}</h5>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{sessionInfo.type}</span>
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', fontWeight: 700, fontFamily: 'var(--font-data)', background: `#${driverTeamColour}22`, color: `#${driverTeamColour}`, border: `1px solid #${driverTeamColour}44` }}>{driverAcronym} #{trackedDriverNum}</span>
                  {switchingDriver && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>switching...</span>}
                </div>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}><span style={{ fontFamily: 'var(--font-data)', color: 'var(--text-primary)', fontSize: '11px', fontWeight: 600 }}>{trackTime}</span><span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Track</span></div>
                    <div style={{ width: '1px', height: '20px', background: 'var(--border-default)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}><span style={{ fontFamily: 'var(--font-data)', color: 'var(--text-secondary)', fontSize: '11px' }}>{localTime}</span><span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Local</span></div>
                  </div>
                  {error ? <span className="badge-error">{error}</span> : <span className="badge-live">LIVE</span>}
                </div>
              </div>
              {weather && weather.air_temperature != null && (
                <div style={{ marginTop: '6px', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <WeatherBar weather={weather} />
                  <button
                    onClick={togglePause}
                    style={{
                      background: paused ? 'rgba(251,191,36,0.15)' : 'var(--bg-elevated)',
                      border: `1.5px solid ${paused ? '#fbbf24' : 'var(--border-default)'}`,
                      borderRadius: '4px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: paused ? '#fbbf24' : 'var(--text-muted)',
                      transition: 'all 0.2s',
                      flexShrink: 0,
                    }}
                    title={paused ? 'Resume replay' : 'Pause replay'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                      {paused ? 'play_arrow' : 'pause'}
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-data)', textTransform: 'uppercase' }}>
                      {paused ? 'PAUSED' : 'LIVE'}
                    </span>
                  </button>
                </div>
              )}
              {(!weather || weather.air_temperature == null) && (
                <div style={{ marginTop: '6px', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={togglePause} style={{
                      background: paused ? 'rgba(251,191,36,0.15)' : 'var(--bg-elevated)',
                      border: `1.5px solid ${paused ? '#fbbf24' : 'var(--border-default)'}`,
                      borderRadius: '4px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: paused ? '#fbbf24' : 'var(--text-muted)',
                      transition: 'all 0.2s',
                      flexShrink: 0,
                    }} title={paused ? 'Resume' : 'Pause'}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{paused ? 'play_arrow' : 'pause'}</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-data)', textTransform: 'uppercase' }}>{paused ? 'PAUSED' : 'LIVE'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="d-flex flex-row flex-grow-1 gap-2" style={{ minHeight: 0, overflow: 'hidden' }}>

            {/* LEFT PANEL */}
            <div className="panel flex-grow-1 d-flex flex-row" style={{ minHeight: 0, overflow: 'hidden' }}>

              {/* Standings */}
              <div className="d-flex flex-column overflow-hidden" style={{ width: '220px', minWidth: '220px', borderRight: '1px solid var(--border-subtle)' }}>
                <div style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Standings</span>
                  <span style={{ fontFamily: 'var(--font-data)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '10px' }}>
                    {(() => {
                      const timing = telemetry?.session_timing
                      if (!timing) return '-/-'
                      if (timing.mode === 'race') return `${timing.lap || '-'}/${timing.total_laps || '-'}`
                      if (timing.mode === 'qualifying') {
                        const min = Math.floor((timing.remaining || 0) / 60)
                        const sec = (timing.remaining || 0) % 60
                        return <span>{timing.phase} <span style={{ color: 'var(--accent-yellow)' }}>{min}:{sec.toString().padStart(2, '0')}</span></span>
                      }
                      if (timing.mode === 'practice') {
                        const min = Math.floor((timing.remaining || 0) / 60)
                        const sec = (timing.remaining || 0) % 60
                        return <span style={{ color: 'var(--accent-yellow)' }}>{min}:{sec.toString().padStart(2, '0')}</span>
                      }
                      return '-'
                    })()}
                  </span>
                </div>
                <FlagBanner raceControl={raceControl} />
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {racePositions.length === 0 ? <div style={{ padding: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>Loading...</div> :
                    racePositions.slice(0, 20).map(driver => {
                      const isT = driver.driver_number === trackedDriverNum
                      const delta = positionChanges[driver.driver_number] || 0
                      return (
                        <div key={driver.driver_number} onClick={() => handleDriverClick(driver.driver_number)} style={{ display: 'flex', alignItems: 'center', padding: '5px 12px', gap: 6, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', background: isT ? `#${driverTeamColour}15` : 'transparent', borderLeft: isT ? `3px solid #${driverTeamColour}` : '3px solid transparent', transition: 'background 0.15s' }} onMouseEnter={e => { if (!isT) e.currentTarget.style.background = 'var(--standings-row-hover)' }} onMouseLeave={e => { e.currentTarget.style.background = isT ? `#${driverTeamColour}15` : 'transparent' }}>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-data)', color: 'var(--text-muted)', width: '18px', textAlign: 'right' }}>{driver.position}</span>
                          {delta !== 0 ? <span className="material-symbols-outlined" style={{ fontSize: '12px', width: '12px', flexShrink: 0, color: delta > 0 ? '#00c853' : '#ef4444' }}>{delta > 0 ? 'arrow_upward' : 'arrow_downward'}</span> : <span style={{ width: '12px', flexShrink: 0 }} />}
                          {teamColorBar(driver.team_colour)}
                          <span style={{ fontSize: '11px', fontWeight: isT ? 700 : 600, flexGrow: 1, color: isT ? `#${driver.team_colour}` : 'var(--text-primary)', fontFamily: 'var(--font-data)' }}>{driver.acronym}</span>
                          <span style={{ fontSize: '10px', fontFamily: 'var(--font-data)', color: driver.gap === 'LEAD' ? 'var(--accent-yellow)' : driver.gap?.startsWith?.('+') ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{driver.gap}</span>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Map + Events */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ flex: '1 1 50%', minHeight: 0, overflow: 'hidden', display: 'flex' }}>
                  {trackPoints ? (
                    <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} style={{ flex: 1 }}>
                      <g transform={`rotate(${-trackRotation},${svgCx},${svgCy})`}>
                        <polyline points={trackPoints} fill="none" stroke="var(--track-stroke)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                        {telemetry && (
                          <g transform={`translate(${telemetry.x},${telemetry.y})`}>
                            <circle r="6" fill={`#${driverTeamColour}`} stroke={`#${driverTeamColour}66`} strokeWidth="4" />
                            <text x="14" y="5" fontSize="20" fontWeight="700" fontFamily="var(--font-data)" fill="var(--text-heading)" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{driverAcronym}</text>
                          </g>
                        )}
                      </g>
                      {trackRotation !== 0 && (
                        <g transform={`translate(${SVG_SIZE - 50},40)`}>
                          <circle r="16" fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="1" />
                          <text x="0" y="-3" textAnchor="middle" fontSize="8" fill="var(--text-secondary)" fontWeight="700">N</text>
                          <polygon points="0,-12 3,-4 0,-6 -3,-4" fill="var(--text-secondary)" />
                        </g>
                      )}
                    </svg>
                  ) : <span style={{ margin: 'auto', color: 'var(--text-muted)' }}>Loading...</span>}
                </div>
                <div style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>notifications</span>
                    Race Control
                    <span style={{ marginLeft: 'auto', fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>{raceEvents.length}</span>
                  </div>
                  <RaceEventTimeline events={raceEvents} />
                </div>
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="d-flex flex-column gap-2" style={{ width: '45%', minWidth: '380px', minHeight: 0, overflow: 'hidden' }}>

              {/* Speed + DRS + Gear */}
              <div className="panel" style={{ flexShrink: 0 }}>
                <div className="d-flex justify-content-between align-items-center" style={{ padding: '14px 18px' }}>
                  <div>
                    <div className="data-label">Speed</div>
                    <div className="data-value" style={{ fontSize: '2.4rem', lineHeight: 1 }}>{safeNum(telemetry?.speed, 0)}<span className="data-unit">km/h</span></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, fontFamily: 'var(--font-data)', letterSpacing: '1px', background: drsActive ? 'rgba(0,200,83,0.15)' : 'var(--bg-elevated)', color: drsActive ? '#00c853' : 'var(--text-muted)', border: `1.5px solid ${drsActive ? '#00c853' : 'var(--border-default)'}`, boxShadow: drsActive ? '0 0 8px rgba(0,200,83,0.3)' : 'none', transition: 'all 0.2s' }}>DRS</div>
                    <span style={{ fontSize: '8px', color: drsActive ? '#00c853' : 'var(--text-muted)', fontWeight: 600 }}>{drsActive ? 'OPEN' : 'CLOSED'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="data-label">Gear</div>
                    <div className="data-value" style={{ fontSize: '2.4rem', lineHeight: 1, color: 'var(--accent-yellow)' }}>{safeNum(telemetry?.gear, 0)}</div>
                  </div>
                </div>
              </div>

              {/* Tyres + Controls */}
              <div className="panel" style={{ flexShrink: 0 }}>
                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="d-flex align-items-center gap-4">
                    <div style={{ position: 'relative' }}>
                      <svg width="120" height="110" viewBox="0 0 120 110">
                        <rect x="38" y="12" width="44" height="86" rx="10" fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="1" />
                        <rect x="6" y="10" width="28" height="38" rx="6" fill={getTyreColor(t_fl, telemetry?.tyre_compound)} stroke="var(--border-strong)" strokeWidth="1.5" />
                        <text x="20" y="33" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">{Math.round(t_fl)}°</text>
                        <rect x="86" y="10" width="28" height="38" rx="6" fill={getTyreColor(t_fr, telemetry?.tyre_compound)} stroke="var(--border-strong)" strokeWidth="1.5" />
                        <text x="100" y="33" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">{Math.round(t_fr)}°</text>
                        <rect x="6" y="62" width="28" height="38" rx="6" fill={getTyreColor(t_rl, telemetry?.tyre_compound)} stroke="var(--border-strong)" strokeWidth="1.5" />
                        <text x="20" y="85" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">{Math.round(t_rl)}°</text>
                        <rect x="86" y="62" width="28" height="38" rx="6" fill={getTyreColor(t_rr, telemetry?.tyre_compound)} stroke="var(--border-strong)" strokeWidth="1.5" />
                        <text x="100" y="85" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">{Math.round(t_rr)}°</text>
                      </svg>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', padding: '2px 5px', borderRadius: '3px', fontSize: '7px', fontWeight: 700, fontFamily: 'var(--font-data)', textAlign: 'center', lineHeight: 1.3, background: getCompoundColor(telemetry?.tyre_compound), color: getCompoundTextColor(telemetry?.tyre_compound) }}>
                        {(telemetry?.tyre_compound || '?').slice(0, 3)}<br />{telemetry?.tyre_age || 0}L
                      </div>
                    </div>
                    <div className="flex-grow-1 d-flex flex-column justify-content-center" style={{ minHeight: '80px' }}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="data-label">Steering</span>
                        <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--text-secondary)' }}>{safeNum(steerVal, 0)}°</span>
                      </div>
                      <div className="progress-track"><div className="progress-fill progress-fill--steering" style={{ width: `${steerPercent}%` }} /></div>
                      <div className="d-flex justify-content-between mt-1" style={{ fontSize: '9px', color: 'var(--text-muted)' }}><span>L</span><span>R</span></div>
                    </div>
                  </div>
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="data-label">Throttle</span>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--accent-green)' }}>{safeNum(telemetry?.throttle, 0)}%</span>
                    </div>
                    <div className="progress-track" style={{ height: '8px' }}><div className="progress-fill progress-fill--throttle" style={{ width: `${telemetry?.throttle || 0}%` }} /></div>
                  </div>
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="data-label">Brake</span>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--status-danger)' }}>{safeNum(telemetry?.brake, 0)}%</span>
                    </div>
                    <div className="progress-track" style={{ height: '8px' }}><div className="progress-fill progress-fill--brake" style={{ width: `${telemetry?.brake || 0}%` }} /></div>
                  </div>
                </div>
              </div>

              {/* Laps */}
              <div className="panel flex-grow-1 d-flex flex-column" style={{ minHeight: 0, overflow: 'hidden' }}>
                <div className="d-flex flex-column" style={{ minHeight: 0, overflow: 'hidden', padding: '14px 18px', gap: '12px', flex: 1 }}>

                  {/* Current lap info */}
                  <div className="d-flex justify-content-between align-items-end gap-4" style={{ flexShrink: 0 }}>
                    <div>
                      <div className="data-label">Lap</div>
                      <div className="data-value" style={{ fontSize: '1.8rem' }}>{telemetry?.lap || 1}</div>
                    </div>
                    <div className="d-flex flex-column gap-1 flex-grow-1">
                      {[{ l: 'S1', d: s1 }, { l: 'S2', d: s2 }, { l: 'S3', d: s3 }].map(({ l, d }) => (
                        <div key={l} className="d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center gap-2">
                            <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', flexShrink: 0, background: d.state === 'done' ? sectorColorHex(d.color) : d.state === 'running' ? 'var(--accent-green)' : 'var(--text-muted)', boxShadow: d.state === 'running' ? '0 0 6px var(--accent-green)' : d.color === 'purple' ? '0 0 8px var(--sector-purple)' : 'none' }} />
                            <span className="data-label">{l}</span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-data)', fontSize: '13px', ...sectorTextStyle(d) }}>{d.value != null ? formatSector(d.value) : '--'}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="data-label">Time</div>
                      <div className="data-value" style={{ fontSize: '1.4rem' }}>{formatTime(telemetry?.lap_time)}</div>
                    </div>
                  </div>

                  {/* Lap history table */}
                  <div className="flex-grow-1" style={{ minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '4px' }}></th>
                          <th>Driver</th>
                          <th>S1</th>
                          <th>S2</th>
                          <th>S3</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lapHistory.length === 0 ? (
                          <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '16px' }}>Waiting for first lap...</td></tr>
                        ) : lapHistory.map(lap => (
                          <tr key={lap._key}>
                            <td style={{ padding: '4px 2px' }}>
                              <span style={{ display: 'inline-block', width: 3, height: 12, borderRadius: 2, background: `#${lap.driver_team_colour || 'fff'}` }} />
                            </td>
                            <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {lap.driver_acronym || '?'}
                              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>L{lap.lap}</span>
                            </td>
                            <td style={historySectorStyle(lap.sector_1_color)}>{formatSector(lap.sector_1)}</td>
                            <td style={historySectorStyle(lap.sector_2_color)}>{formatSector(lap.sector_2)}</td>
                            <td style={historySectorStyle(lap.sector_3_color)}>{formatSector(lap.sector_3)}</td>
                            <td style={{ fontWeight: 700, textAlign: 'right', color: lap.lap_time_color ? sectorColorHex(lap.lap_time_color) : 'var(--text-primary)' }}>
                              {formatTime(lap.lap_time)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Scroll hint */}
          <div className="scroll-hint">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>expand_more</span>
            <span style={{ fontSize: '9px', letterSpacing: '0.5px' }}>ANALYTICS</span>
          </div>
        </section>

        {/* ===== PAGE 2 — ANALYTICS ===== */}
        <section className="page-snap-section" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)', overflow: 'hidden' }}>
          <div className="panel" style={{ flexShrink: 0 }}>
            <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="d-flex align-items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent-purple)' }}>analytics</span>
                <h5 style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--text-heading)' }}>Analytics</h5>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{sessionInfo.name} — {sessionInfo.type}</span>
              </div>
              <button onClick={() => scrollToPage(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>expand_less</span></button>
            </div>
          </div>

          <div className="d-flex flex-grow-1 gap-2" style={{ minHeight: 0, overflow: 'hidden' }}>
            <div className="d-flex flex-column gap-2" style={{ flex: 1, minHeight: 0 }}>
              <div className="panel flex-grow-1 d-flex flex-column" style={{ minHeight: 0 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Speed Trace</span><span style={{ fontFamily: 'var(--font-data)', fontSize: '9px', fontWeight: 400, color: 'var(--text-muted)' }}>Last 5 laps</span></div>
                <div style={{ flex: 1, minHeight: 0, padding: '4px' }}><SpeedTraceChart /></div>
              </div>
              <div className="panel flex-grow-1 d-flex flex-column" style={{ minHeight: 0 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.8px' }}>Throttle / Brake</div>
                <div className="d-flex align-items-center justify-content-center flex-grow-1" style={{ color: 'var(--text-muted)', fontSize: '12px' }}><div style={{ textAlign: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '8px', display: 'block', opacity: 0.5 }}>stacked_line_chart</span>Coming soon</div></div>
              </div>
            </div>
            <div className="d-flex flex-column gap-2" style={{ flex: 1, minHeight: 0 }}>
              <div className="panel flex-grow-1 d-flex flex-column" style={{ minHeight: 0 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.8px' }}>Lap Time Evolution</div>
                <div className="d-flex align-items-center justify-content-center flex-grow-1" style={{ color: 'var(--text-muted)', fontSize: '12px' }}><div style={{ textAlign: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '8px', display: 'block', opacity: 0.5 }}>timeline</span>Coming soon</div></div>
              </div>
              <div className="panel flex-grow-1 d-flex flex-column" style={{ minHeight: 0 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.8px' }}>Tyre Degradation</div>
                <div className="d-flex align-items-center justify-content-center flex-grow-1" style={{ color: 'var(--text-muted)', fontSize: '12px' }}><div style={{ textAlign: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '8px', display: 'block', opacity: 0.5 }}>tire_repair</span>Coming soon</div></div>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Page dots */}
      <div className="page-indicator">
        {[0, 1].map(i => (<button key={i} className={`page-dot ${currentPage === i ? 'page-dot--active' : ''}`} onClick={() => scrollToPage(i)} title={i === 0 ? 'Telemetry' : 'Analytics'} />))}
      </div>
    </div>
  )

}

export default TelemetryPage