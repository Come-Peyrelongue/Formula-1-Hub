import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

// ---------------------------------------------------------------------------
// Flag config
// ---------------------------------------------------------------------------
const FLAG_CONFIG = {
  formation:   { bg: '#6f42c1', color: 'white',  label: 'FORMATION LAP' },
  yellow:      { bg: '#fbbf24', color: '#1a1d23', label: 'YELLOW FLAG'   },
  red:         { bg: '#ef4444', color: 'white',   label: 'RED FLAG'      },
  safety_car:  { bg: '#fbbf24', color: '#1a1d23', label: 'SAFETY CAR'    },
  vsc:         { bg: '#fef3c7', color: '#92400e', label: 'VIRTUAL SC'    },
  chequered:   { bg: '#1a1d23', color: 'white',   label: 'CHEQUERED'     },
  blue:        { bg: '#3b82f6', color: 'white',   label: 'BLUE FLAG'     },
  black:       { bg: '#000',    color: 'white',   label: 'BLACK FLAG'    },
  black_white: { bg: '#6b7280', color: 'white',   label: 'B&W FLAG'      },
}

const SHOW_FLAG_TYPES = new Set(Object.keys(FLAG_CONFIG))

// ---------------------------------------------------------------------------
// Flag banner (standings)
// ---------------------------------------------------------------------------
function FlagBanner({ raceControl }) {
  const type = raceControl?.type
  const cfg  = FLAG_CONFIG[type] || null
  if (!cfg || !SHOW_FLAG_TYPES.has(type)) return null

  return (
    <div style={{
      background: cfg.bg, color: cfg.color,
      padding: '4px 12px', textTransform: 'uppercase', textAlign: 'center',
      fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-data)', letterSpacing: '0.5px',
    }}>
      {cfg.label}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weather bar
// ---------------------------------------------------------------------------
function WeatherBar({ weather }) {
  if (!weather || weather.air_temperature === null) return null

  const windCardinal = (deg) => {
    if (deg === null || deg === undefined) return ''
    const dirs = ['N','NE','E','SE','S','SW','W','NW']
    return dirs[Math.round(deg / 45) % 8]
  }
  const isRaining = weather.rainfall > 0

  const items = [
    { icon: 'thermostat', value: weather.air_temperature != null ? `${weather.air_temperature.toFixed(1)}°C` : '--', label: 'Air' },
    { icon: 'heat', value: weather.track_temperature != null ? `${weather.track_temperature.toFixed(1)}°C` : '--', label: 'Track' },
    { icon: isRaining ? 'rainy' : 'wb_sunny', value: isRaining ? 'Rain' : 'Dry', label: 'Condition' },
    { icon: 'humidity_percentage', value: weather.humidity != null ? `${weather.humidity.toFixed(0)}%` : '--', label: 'Humidity' },
    { icon: 'speed', value: weather.pressure != null ? `${weather.pressure.toFixed(0)} hPa` : '--', label: 'Pressure' },
    { icon: 'air', value: weather.wind_speed != null ? `${weather.wind_speed.toFixed(1)} km/h` : '--', label: weather.wind_direction != null ? `Wind | ${windCardinal(weather.wind_direction)} ${weather.wind_direction}°` : 'Wind' },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'nowrap' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            {item.icon}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-data)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {item.value}
            </span>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              {item.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Race Event Timeline — icon + color config per event type
// ---------------------------------------------------------------------------
const EVENT_STYLE = {
  red:        { icon: 'flag',            color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  yellow:     { icon: 'warning',         color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
  green:      { icon: 'flag',            color: '#00c853', bg: 'rgba(0,200,83,0.08)' },
  blue:       { icon: 'flag',            color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  chequered:  { icon: 'sports_score',    color: 'var(--text-primary)', bg: 'var(--bg-elevated)' },
  black:      { icon: 'flag',            color: 'var(--text-primary)', bg: 'rgba(0,0,0,0.15)' },
  safety_car: { icon: 'directions_car',  color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
  drs:        { icon: 'speed',           color: '#22d3ee', bg: 'rgba(34,211,238,0.08)' },
  session:    { icon: 'schedule',        color: 'var(--accent-purple)', bg: 'rgba(168,85,247,0.08)' },
  car_event:  { icon: 'build',           color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' },
  flag:       { icon: 'flag',            color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' },
  info:       { icon: 'info',            color: 'var(--text-muted)', bg: 'transparent' },
}

// ---- Tyre temperature color based on compound operating window ----
const TYRE_WINDOWS = {
  SOFT:         { cold: 75, optLow: 85, optHigh: 105, overheat: 115 },
  MEDIUM:       { cold: 80, optLow: 90, optHigh: 115, overheat: 125 },
  HARD:         { cold: 85, optLow: 100, optHigh: 120, overheat: 130 },
  INTERMEDIATE: { cold: 45, optLow: 60, optHigh: 90, overheat: 100 },
  WET:          { cold: 35, optLow: 40, optHigh: 70, overheat: 80 },
}

const getTyreColor = (temp, compound) => {
  if (!temp || temp === 0) return 'var(--sector-neutral)'
  const w = TYRE_WINDOWS[compound] || TYRE_WINDOWS.MEDIUM
  if (temp < w.cold)    return '#3b82f6'  // Cold - blue
  if (temp < w.optLow)  return '#22d3ee'  // Warming - cyan
  if (temp <= w.optHigh) return '#00c853' // Optimal - green
  if (temp <= w.overheat) return '#fbbf24' // Hot - yellow
  return '#ef4444'                         // Overheat - red
}

const getCompoundColor = (compound) => {
  switch ((compound || '').toUpperCase()) {
    case 'SOFT':         return '#ef4444'
    case 'MEDIUM':       return '#fbbf24'
    case 'HARD':         return '#f0f0f0'
    case 'INTERMEDIATE': return '#22c55e'
    case 'WET':          return '#3b82f6'
    default:             return '#6b7280'
  }
}

const getCompoundTextColor = (compound) => {
  switch ((compound || '').toUpperCase()) {
    case 'HARD': return '#1a1d23'
    case 'MEDIUM': return '#1a1d23'
    default: return 'white'
  }
}

function RaceEventTimeline({ events }) {
  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '0' }}>
      {events.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
          No events yet...
        </div>
      ) : (
        events.map((ev, i) => {
          const style = EVENT_STYLE[ev.type] || EVENT_STYLE.info
          const time = ev.date ? new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '6px 10px',
                borderBottom: '1px solid var(--border-subtle)',
                background: style.bg,
                transition: 'background 0.15s',
              }}
            >
              {/* Icon */}
              <span className="material-symbols-outlined" style={{
                fontSize: '14px',
                color: style.color,
                marginTop: '1px',
                flexShrink: 0,
              }}>
                {style.icon}
              </span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-data)',
                  color: 'var(--text-primary)',
                  lineHeight: 1.3,
                  wordBreak: 'break-word',
                }}>
                  {ev.message}
                </div>
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '2px',
                  fontSize: '9px',
                  color: 'var(--text-muted)',
                }}>
                  {time && <span>{time}</span>}
                  {ev.lap_number && <span>Lap {ev.lap_number}</span>}
                  {ev.category && <span>{ev.category}</span>}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function TelemetryPage() {
  const [telemetry, setTelemetry]         = useState(null)
  const [trackPoints, setTrackPoints]     = useState("")
  const [trackRotation, setTrackRotation] = useState(0)
  const [sessionInfo, setSessionInfo]     = useState({ name: "Loading...", type: "" })
  const [error, setError]                 = useState(null)
  const [loading, setLoading]             = useState(true)
  const [lapHistory, setLapHistory]       = useState([])
  const [racePositions, setRacePositions] = useState([])
  const [raceEvents, setRaceEvents]       = useState([])
  const [switchingDriver, setSwitchingDriver] = useState(false)

  const prevTelRef = useRef(null)

  // ---- Completed lap tracking -------------------------------------------

  const addCompletedLap = (completedLap) => {
    if (!completedLap || !completedLap.lap) return
    setLapHistory(h => {
      if (h.some(l => l.lap === completedLap.lap)) return h
      return [{
        lap:      completedLap.lap,
        sector_1: completedLap.sector_1 || 0,
        sector_2: completedLap.sector_2 || 0,
        sector_3: completedLap.sector_3 || 0,
        lap_time: completedLap.lap_time || 0,
        sector_1_color: completedLap.sector_1_color || null,
        sector_2_color: completedLap.sector_2_color || null,
        sector_3_color: completedLap.sector_3_color || null,
      }, ...h].slice(0, 30)
    })
  }

  // ---- Driver switch -------------------------------------------------------

  const handleDriverClick = async (driverNumber) => {
    if (switchingDriver) return
    if (driverNumber === telemetry?.driver_number) return
    setSwitchingDriver(true)
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/switch-driver', { driver_number: driverNumber })
      if (res.data.success) {
        setLapHistory([])
        prevTelRef.current = null
      }
    } catch (err) {
      console.error("Switch driver error:", err)
    } finally {
      setSwitchingDriver(false)
    }
  }

  // ---- Data fetching -------------------------------------------------------

  const fetchTelemetry = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/telemetry')
      const data = response.data
      if (data.x !== undefined && data.y !== undefined) {
        const prev = prevTelRef.current
        if (data.completed_lap) {
          addCompletedLap(data.completed_lap)
        } else if (prev && data.lap !== prev.lap && prev.lap != null
                   && data.driver_number === prev.driver_number) {
          const fallbackS3 =
            prev.sector_3 ||
            (prev.lap_time > 0 && prev.sector_1 > 0 && prev.sector_2 > 0
              ? Math.max(0, prev.lap_time - prev.sector_1 - prev.sector_2)
              : 0)
          addCompletedLap({
            lap: prev.lap,
            sector_1: prev.sector_1 || 0, sector_2: prev.sector_2 || 0,
            sector_3: fallbackS3, lap_time: prev.lap_time || 0,
            sector_1_color: prev.sector_1_color || null,
            sector_2_color: prev.sector_2_color || null,
            sector_3_color: prev.sector_3_color || null,
          })
        }
        prevTelRef.current = data
        setTelemetry(data)
        setError(null)
      }
      setLoading(false)
    } catch (err) {
      console.error("Fetch error:", err)
      setError("Connection lost")
      setLoading(false)
    }
  }

  const fetchPositions = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/race-positions')
      if (Array.isArray(res.data)) setRacePositions(res.data)
    } catch { /* non-critical */ }
  }

  const fetchRaceEvents = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/race-events')
      if (res.data?.events) setRaceEvents(res.data.events)
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    const fetchSessionInfo = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:5000/api/session-info')
        if (res.data) setSessionInfo({ name: res.data.circuit || "Unknown Circuit", type: res.data.session_type || "Race" })
      } catch { setSessionInfo({ name: "Unknown Circuit", type: "Race" }) }
    }
    fetchSessionInfo()
  }, [])

  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/track-layout')
      .then(res => {
        if (res.data?.points) setTrackPoints(res.data.points)
        if (res.data?.rotation !== undefined) setTrackRotation(res.data.rotation)
      })
      .catch(err => console.error("No track layout", err))
  }, [])

  useEffect(() => {
    fetchTelemetry()
    fetchPositions()
    fetchRaceEvents()
    const telId    = setInterval(fetchTelemetry,   100)
    const posId    = setInterval(fetchPositions,   4000)
    const eventsId = setInterval(fetchRaceEvents,  3000)
    return () => { clearInterval(telId); clearInterval(posId); clearInterval(eventsId) }
  }, [])

  // ---- Formatters ----------------------------------------------------------

  const safeNum = (val, decimals = 1) =>
    (val === undefined || val === null) ? "0" : Number(val).toFixed(decimals)

  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return "0:00.000"
    const m = Math.floor(seconds / 60); const s = seconds % 60
    return `${m}:${s.toFixed(3).padStart(6, '0')}`
  }

  const formatSector = (value) => {
    if (!value || value === 0) return "--"
    const m = Math.floor(value / 60); const s = value % 60
    return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3)
  }

  // ---- Sector display ------------------------------------------------------

  const currentSector = telemetry?.current_sector ?? 1

  const getSectorDisplay = (sectorNum) => {
    if (!telemetry) return { value: null, state: 'waiting', color: null }
    const val   = telemetry[`sector_${sectorNum}`]
    const color = telemetry[`sector_${sectorNum}_color`]
    if (val && val > 0) return { value: val, state: 'done', color }
    if (sectorNum === currentSector) return { value: null, state: 'running', color: null }
    return { value: null, state: 'waiting', color: null }
  }

  const sectorColorHex = (color, state = 'done') => {
    if (state === 'running') return 'var(--accent-green)'
    if (color === 'purple')  return 'var(--sector-purple)'
    if (color === 'green')   return 'var(--sector-green)'
    if (color === 'yellow')  return 'var(--sector-yellow)'
    return 'var(--sector-neutral)'
  }

  const sectorTextStyle = (display) => {
    if (!display) return {}
    if (display.state === 'running') return { color: 'var(--accent-green)', fontWeight: 700 }
    if (display.state === 'done')    return { color: sectorColorHex(display.color), fontWeight: 700 }
    return { color: 'var(--text-muted)' }
  }

  const historySectorStyle = (color) => ({ color: sectorColorHex(color), fontWeight: 700 })

  // ---- Tyre colours --------------------------------------------------------

  const getTireColor = (temp) => {
    if (!temp || temp === 0) return 'var(--sector-neutral)'
    if (temp < 60)           return '#22d3ee'
    if (temp <= 130)         return '#00c853'
    if (temp <= 150)         return '#fbbf24'
    return '#ef4444'
  }

  // ---- Derived state -------------------------------------------------------

  const raceControl      = telemetry?.race_control || { label: 'GREEN FLAG', type: 'green', message: 'Track clear' }
  const weather          = telemetry?.weather || null
  const driverAcronym    = telemetry?.driver_acronym || 'DRV'
  const driverTeamColour = telemetry?.driver_team_colour || 'FFFFFF'
  const trackedDriverNum = telemetry?.driver_number || 0

  const teamColorBar = (hex) => (
    <span style={{
      display: 'inline-block', width: 3, height: 14, borderRadius: 2,
      background: `#${hex || 'FFFFFF'}`, marginRight: 6, flexShrink: 0,
    }} />
  )

  const steerVal     = telemetry?.steering || 0
  const steerPercent = Math.max(0, Math.min(100, 50 + (steerVal / 8)))

  // ---- Loading state -------------------------------------------------------

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100">
        <div className="text-center">
          <div className="spinner-border mb-3" role="status" style={{ color: 'var(--f1-red)' }}></div>
          <h5 style={{ color: 'var(--text-secondary)' }}>Loading Telemetry...</h5>
        </div>
      </div>
    )
  }

  const t_fl = telemetry?.tire_fl || 0; const t_fr = telemetry?.tire_fr || 0
  const t_rl = telemetry?.tire_rl || 0; const t_rr = telemetry?.tire_rr || 0

  const s1 = getSectorDisplay(1)
  const s2 = getSectorDisplay(2)
  const s3 = getSectorDisplay(3)

  const SVG_SIZE = 1000
  const cx = SVG_SIZE / 2; const cy = SVG_SIZE / 2

  return (
    <div className="d-flex flex-column h-100 gap-2" style={{ minHeight: 0, overflow: 'hidden' }}>

      {/* HEADER */}
      <div className="panel" style={{ flexShrink: 0 }}>
        <div style={{ padding: '8px 14px' }}>
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <h5 style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--text-heading)' }}>
                {sessionInfo.name}
              </h5>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{sessionInfo.type}</span>
              <span style={{
                fontSize: '10px', padding: '2px 6px', borderRadius: '3px', fontWeight: 700,
                fontFamily: 'var(--font-data)',
                background: `#${driverTeamColour}22`, color: `#${driverTeamColour}`,
                border: `1px solid #${driverTeamColour}44`,
              }}>
                {driverAcronym} #{trackedDriverNum}
              </span>
              {switchingDriver && (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>switching...</span>
              )}
            </div>
            <div className="d-flex align-items-center gap-3">
              <span style={{ fontFamily: 'var(--font-data)', color: 'var(--text-muted)', fontSize: '11px' }}>
                {telemetry?.date ? new Date(telemetry.date).toLocaleTimeString() : '--:--:--'}
              </span>
              {error ? <span className="badge-error">{error}</span> : <span className="badge-live">LIVE</span>}
            </div>
          </div>
          {weather && weather.air_temperature != null && (
            <div style={{ marginTop: '6px', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
              <WeatherBar weather={weather} />
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="d-flex flex-row flex-grow-1 gap-2" style={{ minHeight: 0, overflow: 'hidden' }}>

        {/* LEFT — Standings + Map + Events */}
        <div className="panel flex-grow-1 d-flex flex-row" style={{ minHeight: 0, overflow: 'hidden' }}>

          {/* STANDINGS */}
          <div className="d-flex flex-column overflow-hidden" style={{
            width: '220px', minWidth: '220px',
            borderRight: '1px solid var(--border-subtle)',
          }}>
            <div style={{
              padding: '8px 12px', fontSize: '10px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.8px',
              color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-ui)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Race Standings</span>
              <span style={{ fontFamily: 'var(--font-data)', color: 'var(--text-primary)', fontWeight: 700 }}>
                {telemetry?.lap || '-'}/{telemetry?.total_laps || '-'}
              </span>
            </div>

            <FlagBanner raceControl={raceControl} />

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {racePositions.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '11px', fontStyle: 'italic', color: 'var(--text-muted)' }}>Loading...</div>
              ) : (
                racePositions.slice(0, 20).map((driver) => {
                  const isTracked = driver.driver_number === trackedDriverNum
                  return (
                    <div
                      key={driver.driver_number}
                      onClick={() => handleDriverClick(driver.driver_number)}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '5px 12px', gap: 6,
                        borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s',
                        cursor: 'pointer',
                        background: isTracked ? `#${driverTeamColour}15` : 'transparent',
                        borderLeft: isTracked ? `3px solid #${driverTeamColour}` : '3px solid transparent',
                      }}
                      onMouseEnter={e => { if (!isTracked) e.currentTarget.style.background = 'var(--standings-row-hover)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = isTracked ? `#${driverTeamColour}15` : 'transparent' }}
                    >
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-data)', color: 'var(--text-muted)', width: '18px', textAlign: 'right' }}>
                        {driver.position}
                      </span>
                      {teamColorBar(driver.team_colour)}
                      <span style={{ fontSize: '11px', fontWeight: isTracked ? 700 : 600, flexGrow: 1, color: isTracked ? `#${driver.team_colour}` : 'var(--text-primary)', fontFamily: 'var(--font-data)' }}>
                        {driver.acronym}
                      </span>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-data)', color: driver.gap === 'LEAD' ? 'var(--accent-yellow)' : 'var(--text-secondary)' }}>
                        {driver.gap === 'LEAD' ? 'LEAD' : driver.gap}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* MAP + EVENTS (split vertically) */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* MAP — top part */}
            <div style={{ flex: '1 1 50%', minHeight: 0, overflow: 'hidden', position: 'relative', display: 'flex' }}>
              {trackPoints ? (
                <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} style={{ flex: 1 }}>
                  <g transform={`rotate(${-trackRotation}, ${cx}, ${cy})`}>
                    <polyline
                      points={trackPoints} fill="none" stroke="var(--track-stroke)"
                      strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                    />
                    {telemetry && (
                      <g transform={`translate(${telemetry.x}, ${telemetry.y})`}>
                        <circle r="6" fill={`#${driverTeamColour}`} stroke={`#${driverTeamColour}66`} strokeWidth="4" />
                        <text x="14" y="5" fontSize="20" fontWeight="700" fontFamily="var(--font-data)"
                              fill="var(--text-heading)" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)' }}>
                          {driverAcronym}
                        </text>
                      </g>
                    )}
                  </g>
                  {trackRotation !== 0 && (
                    <g transform={`translate(${SVG_SIZE - 50}, 40)`}>
                      <circle r="16" fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="1" />
                      <text x="0" y="-3" textAnchor="middle" fontSize="8" fill="var(--text-secondary)" fontWeight="700">N</text>
                      <polygon points="0,-12 3,-4 0,-6 -3,-4" fill="var(--text-secondary)" />
                    </g>
                  )}
                </svg>
              ) : (
                <span style={{ margin: 'auto', color: 'var(--text-muted)' }}>Loading Map...</span>
              )}
            </div>

            {/* RACE EVENTS — bottom part */}
            <div style={{
              flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column',
              borderTop: '1px solid var(--border-subtle)',
            }}>
              {/* Events header */}
              <div style={{
                padding: '6px 12px',
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.8px', color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-ui)',
                display: 'flex', alignItems: 'center', gap: '6px',
                flexShrink: 0,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>notifications</span>
                Race Control
                <span style={{
                  marginLeft: 'auto', fontSize: '9px', fontWeight: 600,
                  color: 'var(--text-muted)', fontFamily: 'var(--font-data)',
                }}>
                  {raceEvents.length} events
                </span>
              </div>

              {/* Events list */}
              <RaceEventTimeline events={raceEvents} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — Telemetry */}
        <div className="d-flex flex-column gap-2" style={{ width: '45%', minWidth: '380px', minHeight: 0, overflow: 'hidden' }}>

          {/* SPEED & GEAR */}
          <div className="panel" style={{ flexShrink: 0 }}>
            <div className="d-flex justify-content-between align-items-center" style={{ padding: '14px 18px' }}>
              <div>
                <div className="data-label">Speed</div>
                <div className="data-value" style={{ fontSize: '2.4rem', lineHeight: 1 }}>
                  {safeNum(telemetry?.speed, 0)}<span className="data-unit">km/h</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="data-label">Gear</div>
                <div className="data-value" style={{ fontSize: '2.4rem', lineHeight: 1, color: 'var(--accent-yellow)' }}>
                  {safeNum(telemetry?.gear, 0)}
                </div>
              </div>
            </div>
          </div>

          {/* TYRES + CONTROLS */}
          <div className="panel" style={{ flexShrink: 0 }}>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Tyres + Steering */}
              <div className="d-flex align-items-center gap-4">

                {/* Tyre diagram */}
                <div style={{ position: 'relative' }}>
                  <svg width="120" height="110" viewBox="0 0 120 110">
                    {/* Car body */}
                    <rect x="38" y="12" width="44" height="86" rx="10" fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="1" />

                    {/* FL */}
                    <rect x="6" y="10" width="28" height="38" rx="6" fill={getTyreColor(t_fl, telemetry?.tyre_compound)} stroke="var(--border-strong)" strokeWidth="1.5" />
                    <text x="20" y="33" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">{Math.round(t_fl)}°</text>

                    {/* FR */}
                    <rect x="86" y="10" width="28" height="38" rx="6" fill={getTyreColor(t_fr, telemetry?.tyre_compound)} stroke="var(--border-strong)" strokeWidth="1.5" />
                    <text x="100" y="33" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">{Math.round(t_fr)}°</text>

                    {/* RL */}
                    <rect x="6" y="62" width="28" height="38" rx="6" fill={getTyreColor(t_rl, telemetry?.tyre_compound)} stroke="var(--border-strong)" strokeWidth="1.5" />
                    <text x="20" y="85" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">{Math.round(t_rl)}°</text>

                    {/* RR */}
                    <rect x="86" y="62" width="28" height="38" rx="6" fill={getTyreColor(t_rr, telemetry?.tyre_compound)} stroke="var(--border-strong)" strokeWidth="1.5" />
                    <text x="100" y="85" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">{Math.round(t_rr)}°</text>
                  </svg>

                  {/* Compound badge */}
                  <div style={{
                    position: 'absolute', bottom: '50%', left: '50%', transform: 'translateX(-50%)',
                    padding: '2px 5px', borderRadius: '3px', fontSize: '7px', fontWeight: 700,
                    fontFamily: 'var(--font-data)', letterSpacing: '0.5px',
                    background: getCompoundColor(telemetry?.tyre_compound),
                    color: getCompoundTextColor(telemetry?.tyre_compound),
                  }}>
                    {telemetry?.tyre_compound || '?'} <br/> {telemetry?.tyre_age || 0}L
                  </div>
                </div>

                {/* Steering */}
                <div className="flex-grow-1 d-flex flex-column justify-content-center" style={{ minHeight: '80px' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="data-label">Steering</span>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {safeNum(steerVal, 0)}°
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill progress-fill--steering" style={{ width: `${steerPercent}%` }} />
                  </div>
                  <div className="d-flex justify-content-between mt-1" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                    <span>L</span><span>R</span>
                  </div>
                </div>
              </div>

              {/* Throttle */}
              <div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="data-label">Throttle</span>
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--accent-green)' }}>
                    {safeNum(telemetry?.throttle, 0)}%
                  </span>
                </div>
                <div className="progress-track" style={{ height: '8px' }}>
                  <div className="progress-fill progress-fill--throttle" style={{ width: `${telemetry?.throttle || 0}%` }} />
                </div>
              </div>

              {/* Brake */}
              <div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="data-label">Brake</span>
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: '11px', color: 'var(--status-danger)' }}>
                    {safeNum(telemetry?.brake, 0)}%
                  </span>
                </div>
                <div className="progress-track" style={{ height: '8px' }}>
                  <div className="progress-fill progress-fill--brake" style={{ width: `${telemetry?.brake || 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* LAP INFO + HISTORY */}
          <div className="panel flex-grow-1 d-flex flex-column" style={{ minHeight: 0, overflow: 'hidden' }}>
            <div className="d-flex flex-column" style={{ minHeight: 0, overflow: 'hidden', padding: '14px 18px', gap: '12px', flex: 1 }}>

              <div className="d-flex justify-content-between align-items-end gap-4" style={{ flexShrink: 0 }}>
                <div>
                  <div className="data-label">Lap</div>
                  <div className="data-value" style={{ fontSize: '1.8rem' }}>{telemetry?.lap || 1}</div>
                </div>
                <div className="d-flex flex-column gap-1 flex-grow-1">
                  {[
                    { label: 'S1', display: s1 },
                    { label: 'S2', display: s2 },
                    { label: 'S3', display: s3 },
                  ].map(({ label, display }) => (
                    <div key={label} className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center gap-2">
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                          background: display.state === 'done' ? sectorColorHex(display.color) : display.state === 'running' ? 'var(--accent-green)' : 'var(--text-muted)',
                          boxShadow: display.state === 'running' ? '0 0 6px var(--accent-green)' : display.color === 'purple' ? '0 0 8px var(--sector-purple)' : 'none',
                        }} />
                        <span className="data-label">{label}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: '13px', ...sectorTextStyle(display) }}>
                        {display.value != null ? formatSector(display.value) : '--'}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="data-label">Time</div>
                  <div className="data-value" style={{ fontSize: '1.4rem' }}>{formatTime(telemetry?.lap_time)}</div>
                </div>
              </div>

              <div className="flex-grow-1" style={{ minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Lap</th><th>S1</th><th>S2</th><th>S3</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lapHistory.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '16px' }}>
                          Waiting for first completed lap...
                        </td>
                      </tr>
                    ) : lapHistory.map((lap) => (
                      <tr key={lap.lap}>
                        <td style={{ fontWeight: 700 }}>{lap.lap}</td>
                        <td style={historySectorStyle(lap.sector_1_color)}>{formatSector(lap.sector_1)}</td>
                        <td style={historySectorStyle(lap.sector_2_color)}>{formatSector(lap.sector_2)}</td>
                        <td style={historySectorStyle(lap.sector_3_color)}>{formatSector(lap.sector_3)}</td>
                        <td style={{ fontWeight: 700, textAlign: 'right' }}>{formatTime(lap.lap_time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default TelemetryPage