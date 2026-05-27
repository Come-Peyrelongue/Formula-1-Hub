import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

// ===========================================================================
// SESSION SELECTOR COMPONENT
// ===========================================================================
function SessionSelector({ onSessionLoaded }) {
  const [years, setYears]             = useState([])
  const [meetings, setMeetings]       = useState([])
  const [sessions, setSessions]       = useState([])
  const [selectedYear, setSelectedYear]       = useState(null)
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [loadingMeetings, setLoadingMeetings] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingReplay, setLoadingReplay]     = useState(false)
  const [errorMsg, setErrorMsg]               = useState(null)

  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/replay/years')
      .then(res => { setYears(res.data); if (res.data.length) setSelectedYear(res.data[0]) })
      .catch(() => setYears([2024, 2023, 2022]))
  }, [])

  useEffect(() => {
    if (!selectedYear) return
    setLoadingMeetings(true)
    setMeetings([]); setSessions([]); setSelectedMeeting(null); setSelectedSession(null)
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
      if (res.data.success) {
        onSessionLoaded(res.data)
      } else {
        setErrorMsg(res.data.message || 'Failed to load session')
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Connection error')
    } finally {
      setLoadingReplay(false)
    }
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

  const selectStyle = {
    width: '100%', padding: '10px 14px',
    background: 'var(--bg-input)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: '14px', fontFamily: 'var(--font-ui)', outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div className="d-flex align-items-center justify-content-center h-100">
      <div className="panel" style={{ width: '100%', maxWidth: '520px', padding: '32px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--f1-red)', marginBottom: '8px', display: 'block' }}>
            play_circle
          </span>
          <h3 style={{ color: 'var(--text-heading)', fontWeight: 700, fontSize: '20px', marginBottom: '4px' }}>
            Session Replay
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            Select a session to replay with full telemetry
          </p>
        </div>

        {/* Year */}
        <div style={{ marginBottom: '16px' }}>
          <label className="data-label" style={{ display: 'block', marginBottom: '6px' }}>Season</label>
          <select style={selectStyle} value={selectedYear || ''} onChange={e => setSelectedYear(Number(e.target.value))}>
            <option value="" disabled>Select year...</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Meeting */}
        <div style={{ marginBottom: '16px' }}>
          <label className="data-label" style={{ display: 'block', marginBottom: '6px' }}>Event</label>
          <select
            style={{ ...selectStyle, opacity: loadingMeetings || !meetings.length ? 0.5 : 1 }}
            value={selectedMeeting || ''}
            onChange={e => setSelectedMeeting(Number(e.target.value))}
            disabled={loadingMeetings || !meetings.length}
          >
            <option value="" disabled>
              {loadingMeetings ? 'Loading...' : 'Select event...'}
            </option>
            {meetings.map(m => (
              <option key={m.meeting_key} value={m.meeting_key}>
                {m.name} — {m.circuit} ({m.date_start})
              </option>
            ))}
          </select>
        </div>

        {/* Session */}
        <div style={{ marginBottom: '24px' }}>
          <label className="data-label" style={{ display: 'block', marginBottom: '6px' }}>Session</label>
          <select
            style={{ ...selectStyle, opacity: loadingSessions || !sessions.length ? 0.5 : 1 }}
            value={selectedSession || ''}
            onChange={e => setSelectedSession(Number(e.target.value))}
            disabled={loadingSessions || !sessions.length}
          >
            <option value="" disabled>
              {loadingSessions ? 'Loading...' : 'Select session...'}
            </option>
            {sessions.map(s => (
              <option key={s.session_key} value={s.session_key}>
                {s.session_name} ({s.session_type})
              </option>
            ))}
          </select>
        </div>

        {/* Error */}
        {errorMsg && (
          <div style={{
            padding: '10px 14px', marginBottom: '16px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444', fontSize: '12px', fontFamily: 'var(--font-data)',
          }}>
            {errorMsg}
          </div>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!selectedSession}
          style={{
            width: '100%', padding: '12px', border: 'none', borderRadius: 'var(--radius-md)',
            background: selectedSession ? 'var(--f1-red)' : 'var(--bg-elevated)',
            color: selectedSession ? 'white' : 'var(--text-muted)',
            fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-ui)',
            cursor: selectedSession ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            letterSpacing: '0.5px',
          }}
        >
          START REPLAY
        </button>

      </div>
    </div>
  )
}

// ===========================================================================
// FLAG / WEATHER / EVENTS (inchangés — copie de ta version actuelle)
// ===========================================================================
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

function FlagBanner({ raceControl }) {
  const type = raceControl?.type; const cfg = FLAG_CONFIG[type] || null
  if (!cfg || !SHOW_FLAG_TYPES.has(type)) return null
  return (<div style={{ background: cfg.bg, color: cfg.color, padding: '4px 12px', textTransform: 'uppercase', textAlign: 'center', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-data)', letterSpacing: '0.5px' }}>{cfg.label}</div>)
}

function WeatherBar({ weather }) {
  if (!weather || weather.air_temperature === null) return null
  const windCardinal = (deg) => { if (deg === null || deg === undefined) return ''; const dirs = ['N','NE','E','SE','S','SW','W','NW']; return dirs[Math.round(deg / 45) % 8] }
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
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{item.icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-data)', fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const EVENT_STYLE = {
  red: { icon: 'flag', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }, yellow: { icon: 'warning', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
  green: { icon: 'flag', color: '#00c853', bg: 'rgba(0,200,83,0.08)' }, blue: { icon: 'flag', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  chequered: { icon: 'sports_score', color: 'var(--text-primary)', bg: 'var(--bg-elevated)' }, black: { icon: 'flag', color: 'var(--text-primary)', bg: 'rgba(0,0,0,0.15)' },
  safety_car: { icon: 'directions_car', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' }, drs: { icon: 'speed', color: '#22d3ee', bg: 'rgba(34,211,238,0.08)' },
  session: { icon: 'schedule', color: 'var(--accent-purple)', bg: 'rgba(168,85,247,0.08)' }, car_event: { icon: 'build', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' },
  flag: { icon: 'flag', color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' }, info: { icon: 'info', color: 'var(--text-muted)', bg: 'transparent' },
}

function RaceEventTimeline({ events }) {
  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {events.length === 0 ? <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>No events yet...</div>
      : events.map((ev, i) => {
        const style = EVENT_STYLE[ev.type] || EVENT_STYLE.info
        const time = ev.date ? new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', background: style.bg }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: style.color, marginTop: '1px', flexShrink: 0 }}>{style.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-data)', color: 'var(--text-primary)', lineHeight: 1.3, wordBreak: 'break-word' }}>{ev.message}</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '2px', fontSize: '9px', color: 'var(--text-muted)' }}>
                {time && <span>{time}</span>}{ev.lap_number && <span>Lap {ev.lap_number}</span>}{ev.category && <span>{ev.category}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ===========================================================================
// TYRE HELPERS
// ===========================================================================
const TYRE_WINDOWS = { SOFT: { cold: 75, optLow: 85, optHigh: 105, overheat: 115 }, MEDIUM: { cold: 80, optLow: 90, optHigh: 115, overheat: 125 }, HARD: { cold: 85, optLow: 100, optHigh: 120, overheat: 130 }, INTERMEDIATE: { cold: 45, optLow: 60, optHigh: 90, overheat: 100 }, WET: { cold: 35, optLow: 40, optHigh: 70, overheat: 80 } }
const getTyreColor = (temp, compound) => { if (!temp || temp === 0) return 'var(--sector-neutral)'; const w = TYRE_WINDOWS[compound] || TYRE_WINDOWS.MEDIUM; if (temp < w.cold) return '#3b82f6'; if (temp < w.optLow) return '#22d3ee'; if (temp <= w.optHigh) return '#00c853'; if (temp <= w.overheat) return '#fbbf24'; return '#ef4444' }
const getCompoundColor = (c) => { switch ((c||'').toUpperCase()) { case 'SOFT': return '#ef4444'; case 'MEDIUM': return '#fbbf24'; case 'HARD': return '#f0f0f0'; case 'INTERMEDIATE': return '#22c55e'; case 'WET': return '#3b82f6'; default: return '#6b7280' } }
const getCompoundTextColor = (c) => { switch ((c||'').toUpperCase()) { case 'HARD': case 'MEDIUM': return '#1a1d23'; default: return 'white' } }

// ===========================================================================
// MAIN PAGE — switches between Selector and Dashboard
// ===========================================================================
function TelemetryPage() {
  const [sessionActive, setSessionActive] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(true)

  // On mount, check if there's already an active session
  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/session-info')
      .then(res => {
        if (res.data?.circuit && res.data.circuit !== 'Unknown' && res.data.circuit !== 'Simulation / Error') {
          setSessionActive(true)
        }
      })
      .catch(() => {})
      .finally(() => setCheckingExisting(false))
  }, [])

  if (checkingExisting) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100">
        <div className="spinner-border" style={{ color: 'var(--f1-red)' }}></div>
      </div>
    )
  }

  if (!sessionActive) {
    return <SessionSelector onSessionLoaded={() => setSessionActive(true)} />
  }

  return <ReplayDashboard onBack={() => setSessionActive(false)} />
}

// ===========================================================================
// REPLAY DASHBOARD (the existing telemetry UI + a back button)
// ===========================================================================
function ReplayDashboard({ onBack }) {
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
  const [positionChanges, setPositionChanges] = useState({})

  const prevTelRef = useRef(null)
  const prevPositionsRef = useRef({})

  const addCompletedLap = (completedLap) => {
    if (!completedLap || !completedLap.lap) return
    setLapHistory(h => { if (h.some(l => l.lap === completedLap.lap)) return h; return [{ lap: completedLap.lap, sector_1: completedLap.sector_1||0, sector_2: completedLap.sector_2||0, sector_3: completedLap.sector_3||0, lap_time: completedLap.lap_time||0, sector_1_color: completedLap.sector_1_color, sector_2_color: completedLap.sector_2_color, sector_3_color: completedLap.sector_3_color }, ...h].slice(0,30) })
  }

  const handleDriverClick = async (driverNumber) => {
    if (switchingDriver || driverNumber === telemetry?.driver_number) return
    setSwitchingDriver(true)
    try { const res = await axios.post('http://127.0.0.1:5000/api/switch-driver', { driver_number: driverNumber }); if (res.data.success) { setLapHistory([]); prevTelRef.current = null } }
    catch (err) { console.error(err) } finally { setSwitchingDriver(false) }
  }

  const fetchTelemetry = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/telemetry')
      const data = response.data
      if (data.x !== undefined && data.y !== undefined) {
        const prev = prevTelRef.current
        if (data.completed_lap) addCompletedLap(data.completed_lap)
        else if (prev && data.lap !== prev.lap && prev.lap != null && data.driver_number === prev.driver_number) {
          const fallbackS3 = prev.sector_3 || (prev.lap_time > 0 && prev.sector_1 > 0 && prev.sector_2 > 0 ? Math.max(0, prev.lap_time - prev.sector_1 - prev.sector_2) : 0)
          addCompletedLap({ lap: prev.lap, sector_1: prev.sector_1||0, sector_2: prev.sector_2||0, sector_3: fallbackS3, lap_time: prev.lap_time||0, sector_1_color: prev.sector_1_color, sector_2_color: prev.sector_2_color, sector_3_color: prev.sector_3_color })
        }
        prevTelRef.current = data; setTelemetry(data); setError(null)
      }
      setLoading(false)
    } catch { setError("Connection lost"); setLoading(false) }
  }

  const fetchPositions = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/race-positions')
      if (!Array.isArray(res.data)) return
      const newPos = res.data; const prev = prevPositionsRef.current; const changes = {}
      if (Object.keys(prev).length > 0) newPos.forEach(d => { const old = prev[d.driver_number]; if (old !== undefined && old !== d.position) changes[d.driver_number] = old - d.position })
      const cur = {}; newPos.forEach(d => { cur[d.driver_number] = d.position }); prevPositionsRef.current = cur
      if (Object.keys(changes).length > 0) { setPositionChanges(p => ({...p, ...changes})); setTimeout(() => { setPositionChanges(p => { const u = {...p}; Object.keys(changes).forEach(k => delete u[k]); return u }) }, 8000) }
      setRacePositions(newPos)
    } catch {}
  }

  const fetchRaceEvents = async () => { try { const res = await axios.get('http://127.0.0.1:5000/api/race-events'); if (res.data?.events) setRaceEvents(res.data.events) } catch {} }

  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/session-info').then(res => { if (res.data) setSessionInfo({ name: res.data.circuit || "?", type: res.data.session_type || "?" }) }).catch(() => {})
    axios.get('http://127.0.0.1:5000/api/track-layout').then(res => { if (res.data?.points) setTrackPoints(res.data.points); if (res.data?.rotation !== undefined) setTrackRotation(res.data.rotation) }).catch(() => {})
    fetchTelemetry(); fetchPositions(); fetchRaceEvents()
    const t1 = setInterval(fetchTelemetry, 100), t2 = setInterval(fetchPositions, 4000), t3 = setInterval(fetchRaceEvents, 3000)
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3) }
  }, [])

  const safeNum = (v, d=1) => (v === undefined || v === null) ? "0" : Number(v).toFixed(d)
  const formatTime = (s) => { if (!s || s===0) return "0:00.000"; const m=Math.floor(s/60); const sec=s%60; return `${m}:${sec.toFixed(3).padStart(6,'0')}` }
  const formatSector = (v) => { if (!v || v===0) return "--"; const m=Math.floor(v/60); const s=v%60; return m>0 ? `${m}:${s.toFixed(3).padStart(6,'0')}` : s.toFixed(3) }

  const currentSector = telemetry?.current_sector ?? 1
  const getSectorDisplay = (n) => { if (!telemetry) return {value:null,state:'waiting',color:null}; const val=telemetry[`sector_${n}`]; const col=telemetry[`sector_${n}_color`]; if (val&&val>0) return {value:val,state:'done',color:col}; if (n===currentSector) return {value:null,state:'running',color:null}; return {value:null,state:'waiting',color:null} }
  const sectorColorHex = (c,st='done') => { if (st==='running') return 'var(--accent-green)'; if (c==='purple') return 'var(--sector-purple)'; if (c==='green') return 'var(--sector-green)'; if (c==='yellow') return 'var(--sector-yellow)'; return 'var(--sector-neutral)' }
  const sectorTextStyle = (d) => { if (!d) return {}; if (d.state==='running') return {color:'var(--accent-green)',fontWeight:700}; if (d.state==='done') return {color:sectorColorHex(d.color),fontWeight:700}; return {color:'var(--text-muted)'} }
  const historySectorStyle = (c) => ({color: sectorColorHex(c), fontWeight: 700})

  const drsActive = (telemetry?.drs||0) >= 10
  const raceControl = telemetry?.race_control || {label:'GREEN FLAG',type:'green'}
  const weather = telemetry?.weather || null
  const driverAcronym = telemetry?.driver_acronym || 'DRV'
  const driverTeamColour = telemetry?.driver_team_colour || 'FFFFFF'
  const trackedDriverNum = telemetry?.driver_number || 0
  const teamColorBar = (hex) => <span style={{display:'inline-block',width:3,height:14,borderRadius:2,background:`#${hex||'FFF'}`,marginRight:6,flexShrink:0}}/>
  const steerVal = telemetry?.steering||0; const steerPercent = Math.max(0,Math.min(100,50+(steerVal/8)))

  if (loading) return (<div className="d-flex align-items-center justify-content-center h-100"><div className="text-center"><div className="spinner-border mb-3" style={{color:'var(--f1-red)'}}></div><h5 style={{color:'var(--text-secondary)'}}>Loading Telemetry...</h5></div></div>)

  const t_fl=telemetry?.tire_fl||0; const t_fr=telemetry?.tire_fr||0; const t_rl=telemetry?.tire_rl||0; const t_rr=telemetry?.tire_rr||0
  const s1=getSectorDisplay(1); const s2=getSectorDisplay(2); const s3=getSectorDisplay(3)
  const SVG_SIZE=1000; const cx=500; const cy=500
  const localTime = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})
  const trackTime = telemetry?.date ? new Date(telemetry.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '--:--:--'

  return (
    <div className="d-flex flex-column h-100 gap-2" style={{minHeight:0,overflow:'hidden'}}>
      {/* HEADER */}
      <div className="panel" style={{flexShrink:0}}>
        <div style={{padding:'8px 14px'}}>
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              {/* Back button */}
              <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center',color:'var(--text-muted)'}} title="Change session">
                <span className="material-symbols-outlined" style={{fontSize:'18px'}}>arrow_back</span>
              </button>
              <h5 style={{margin:0,fontWeight:700,fontSize:'14px',color:'var(--text-heading)'}}>{sessionInfo.name}</h5>
              <span style={{color:'var(--text-muted)',fontSize:'12px'}}>{sessionInfo.type}</span>
              <span style={{fontSize:'10px',padding:'2px 6px',borderRadius:'3px',fontWeight:700,fontFamily:'var(--font-data)',background:`#${driverTeamColour}22`,color:`#${driverTeamColour}`,border:`1px solid #${driverTeamColour}44`}}>{driverAcronym} #{trackedDriverNum}</span>
              {switchingDriver && <span style={{fontSize:'10px',color:'var(--text-muted)',fontStyle:'italic'}}>switching...</span>}
            </div>
            <div className="d-flex align-items-center gap-3">
              <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',lineHeight:1.1}}>
                  <span style={{fontFamily:'var(--font-data)',color:'var(--text-primary)',fontSize:'11px',fontWeight:600}}>{trackTime}</span>
                  <span style={{fontSize:'8px',color:'var(--text-muted)',textTransform:'uppercase'}}>Track</span>
                </div>
                <div style={{width:'1px',height:'20px',background:'var(--border-default)'}}/>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',lineHeight:1.1}}>
                  <span style={{fontFamily:'var(--font-data)',color:'var(--text-secondary)',fontSize:'11px'}}>{localTime}</span>
                  <span style={{fontSize:'8px',color:'var(--text-muted)',textTransform:'uppercase'}}>Local</span>
                </div>
              </div>
              {error ? <span className="badge-error">{error}</span> : <span className="badge-live">LIVE</span>}
            </div>
          </div>
          {weather && weather.air_temperature != null && <div style={{marginTop:'6px',borderTop:'1px solid var(--border-subtle)',paddingTop:'6px'}}><WeatherBar weather={weather}/></div>}
        </div>
      </div>

      <div className="d-flex flex-row flex-grow-1 gap-2" style={{minHeight:0,overflow:'hidden'}}>
        {/* LEFT */}
        <div className="panel flex-grow-1 d-flex flex-row" style={{minHeight:0,overflow:'hidden'}}>
          {/* Standings */}
          <div className="d-flex flex-column overflow-hidden" style={{width:'220px',minWidth:'220px',borderRight:'1px solid var(--border-subtle)'}}>
            <div style={{padding:'8px 12px',fontSize:'10px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',color:'var(--text-muted)',borderBottom:'1px solid var(--border-subtle)',fontFamily:'var(--font-ui)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Standings</span>
              <span style={{fontFamily:'var(--font-data)',color:'var(--text-primary)',fontWeight:700}}>{telemetry?.lap||'-'}/{telemetry?.total_laps||'-'}</span>
            </div>
            <FlagBanner raceControl={raceControl}/>
            <div style={{overflowY:'auto',flex:1}}>
              {racePositions.length===0 ? <div style={{padding:'12px',fontSize:'11px',color:'var(--text-muted)'}}>Loading...</div>
              : racePositions.slice(0,20).map(driver => {
                const isTracked = driver.driver_number===trackedDriverNum; const delta=positionChanges[driver.driver_number]||0
                return (<div key={driver.driver_number} onClick={()=>handleDriverClick(driver.driver_number)} style={{display:'flex',alignItems:'center',padding:'5px 12px',gap:6,borderBottom:'1px solid var(--border-subtle)',cursor:'pointer',background:isTracked?`#${driverTeamColour}15`:'transparent',borderLeft:isTracked?`3px solid #${driverTeamColour}`:'3px solid transparent',transition:'background 0.15s'}} onMouseEnter={e=>{if(!isTracked)e.currentTarget.style.background='var(--standings-row-hover)'}} onMouseLeave={e=>{e.currentTarget.style.background=isTracked?`#${driverTeamColour}15`:'transparent'}}>
                  <span style={{fontSize:'11px',fontFamily:'var(--font-data)',color:'var(--text-muted)',width:'18px',textAlign:'right'}}>{driver.position}</span>
                  {delta!==0 ? <span className="material-symbols-outlined" style={{fontSize:'12px',width:'12px',flexShrink:0,color:delta>0?'#00c853':'#ef4444'}}>{delta>0?'arrow_upward':'arrow_downward'}</span> : <span style={{width:'12px',flexShrink:0}}/>}
                  {teamColorBar(driver.team_colour)}
                  <span style={{fontSize:'11px',fontWeight:isTracked?700:600,flexGrow:1,color:isTracked?`#${driver.team_colour}`:'var(--text-primary)',fontFamily:'var(--font-data)'}}>{driver.acronym}</span>
                  <span style={{fontSize:'10px',fontFamily:'var(--font-data)',color:driver.gap==='LEAD'?'var(--accent-yellow)':'var(--text-secondary)'}}>{driver.gap==='LEAD'?'LEAD':driver.gap}</span>
                </div>)
              })}
            </div>
          </div>
          {/* Map + Events */}
          <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{flex:'1 1 50%',minHeight:0,overflow:'hidden',display:'flex'}}>
              {trackPoints ? <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} style={{flex:1}}><g transform={`rotate(${-trackRotation},${cx},${cy})`}><polyline points={trackPoints} fill="none" stroke="var(--track-stroke)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>{telemetry&&<g transform={`translate(${telemetry.x},${telemetry.y})`}><circle r="6" fill={`#${driverTeamColour}`} stroke={`#${driverTeamColour}66`} strokeWidth="4"/><text x="14" y="5" fontSize="20" fontWeight="700" fontFamily="var(--font-data)" fill="var(--text-heading)" style={{textShadow:'0 1px 4px rgba(0,0,0,0.9)'}}>{driverAcronym}</text></g>}</g>{trackRotation!==0&&<g transform={`translate(${SVG_SIZE-50},40)`}><circle r="16" fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="1"/><text x="0" y="-3" textAnchor="middle" fontSize="8" fill="var(--text-secondary)" fontWeight="700">N</text><polygon points="0,-12 3,-4 0,-6 -3,-4" fill="var(--text-secondary)"/></g>}</svg> : <span style={{margin:'auto',color:'var(--text-muted)'}}>Loading Map...</span>}
            </div>
            <div style={{flex:'1 1 50%',minHeight:0,display:'flex',flexDirection:'column',borderTop:'1px solid var(--border-subtle)'}}>
              <div style={{padding:'6px 12px',fontSize:'10px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.8px',color:'var(--text-muted)',borderBottom:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',gap:'6px',flexShrink:0}}>
                <span className="material-symbols-outlined" style={{fontSize:'13px'}}>notifications</span>Race Control
                <span style={{marginLeft:'auto',fontSize:'9px',color:'var(--text-muted)',fontFamily:'var(--font-data)'}}>{raceEvents.length}</span>
              </div>
              <RaceEventTimeline events={raceEvents}/>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="d-flex flex-column gap-2" style={{width:'45%',minWidth:'380px',minHeight:0,overflow:'hidden'}}>
          {/* Speed + DRS + Gear */}
          <div className="panel" style={{flexShrink:0}}>
            <div className="d-flex justify-content-between align-items-center" style={{padding:'14px 18px'}}>
              <div><div className="data-label">Speed</div><div className="data-value" style={{fontSize:'2.4rem',lineHeight:1}}>{safeNum(telemetry?.speed,0)}<span className="data-unit">km/h</span></div></div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
                <div style={{padding:'4px 10px',borderRadius:'4px',fontSize:'11px',fontWeight:800,fontFamily:'var(--font-data)',letterSpacing:'1px',background:drsActive?'rgba(0,200,83,0.15)':'var(--bg-elevated)',color:drsActive?'#00c853':'var(--text-muted)',border:`1.5px solid ${drsActive?'#00c853':'var(--border-default)'}`,boxShadow:drsActive?'0 0 8px rgba(0,200,83,0.3)':'none',transition:'all 0.2s'}}>DRS</div>
                <span style={{fontSize:'8px',color:drsActive?'#00c853':'var(--text-muted)',fontWeight:600,textTransform:'uppercase'}}>{drsActive?'OPEN':'CLOSED'}</span>
              </div>
              <div style={{textAlign:'right'}}><div className="data-label">Gear</div><div className="data-value" style={{fontSize:'2.4rem',lineHeight:1,color:'var(--accent-yellow)'}}>{safeNum(telemetry?.gear,0)}</div></div>
            </div>
          </div>

          {/* Tyres + Controls */}
          <div className="panel" style={{flexShrink:0}}>
            <div style={{padding:'14px 18px',display:'flex',flexDirection:'column',gap:'14px'}}>
              <div className="d-flex align-items-center gap-4">
                <div style={{position:'relative'}}>
                  <svg width="120" height="110" viewBox="0 0 120 110">
                    <rect x="38" y="12" width="44" height="86" rx="10" fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="1"/>
                    <rect x="6" y="10" width="28" height="38" rx="6" fill={getTyreColor(t_fl,telemetry?.tyre_compound)} stroke="var(--border-strong)" strokeWidth="1.5"/><text x="20" y="33" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">{Math.round(t_fl)}°</text>
                    <rect x="86" y="10" width="28" height="38" rx="6" fill={getTyreColor(t_fr,telemetry?.tyre_compound)} stroke="var(--border-strong)" strokeWidth="1.5"/><text x="100" y="33" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">{Math.round(t_fr)}°</text>
                    <rect x="6" y="62" width="28" height="38" rx="6" fill={getTyreColor(t_rl,telemetry?.tyre_compound)} stroke="var(--border-strong)" strokeWidth="1.5"/><text x="20" y="85" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">{Math.round(t_rl)}°</text>
                    <rect x="86" y="62" width="28" height="38" rx="6" fill={getTyreColor(t_rr,telemetry?.tyre_compound)} stroke="var(--border-strong)" strokeWidth="1.5"/><text x="100" y="85" textAnchor="middle" fontSize="10" fill="white" fontWeight="700">{Math.round(t_rr)}°</text>
                  </svg>
                  <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',padding:'2px 5px',borderRadius:'3px',fontSize:'7px',fontWeight:700,fontFamily:'var(--font-data)',textAlign:'center',lineHeight:1.3,background:getCompoundColor(telemetry?.tyre_compound),color:getCompoundTextColor(telemetry?.tyre_compound)}}>
                    {(telemetry?.tyre_compound||'?').slice(0,3)}<br/>{telemetry?.tyre_age||0}L
                  </div>
                </div>
                <div className="flex-grow-1 d-flex flex-column justify-content-center" style={{minHeight:'80px'}}>
                  <div className="d-flex justify-content-between align-items-center mb-1"><span className="data-label">Steering</span><span style={{fontFamily:'var(--font-data)',fontSize:'11px',color:'var(--text-secondary)'}}>{safeNum(steerVal,0)}°</span></div>
                  <div className="progress-track"><div className="progress-fill progress-fill--steering" style={{width:`${steerPercent}%`}}/></div>
                  <div className="d-flex justify-content-between mt-1" style={{fontSize:'9px',color:'var(--text-muted)'}}><span>L</span><span>R</span></div>
                </div>
              </div>
              <div><div className="d-flex justify-content-between align-items-center mb-1"><span className="data-label">Throttle</span><span style={{fontFamily:'var(--font-data)',fontSize:'11px',color:'var(--accent-green)'}}>{safeNum(telemetry?.throttle,0)}%</span></div><div className="progress-track" style={{height:'8px'}}><div className="progress-fill progress-fill--throttle" style={{width:`${telemetry?.throttle||0}%`}}/></div></div>
              <div><div className="d-flex justify-content-between align-items-center mb-1"><span className="data-label">Brake</span><span style={{fontFamily:'var(--font-data)',fontSize:'11px',color:'var(--status-danger)'}}>{safeNum(telemetry?.brake,0)}%</span></div><div className="progress-track" style={{height:'8px'}}><div className="progress-fill progress-fill--brake" style={{width:`${telemetry?.brake||0}%`}}/></div></div>
            </div>
          </div>

          {/* Laps */}
          <div className="panel flex-grow-1 d-flex flex-column" style={{minHeight:0,overflow:'hidden'}}>
            <div className="d-flex flex-column" style={{minHeight:0,overflow:'hidden',padding:'14px 18px',gap:'12px',flex:1}}>
              <div className="d-flex justify-content-between align-items-end gap-4" style={{flexShrink:0}}>
                <div><div className="data-label">Lap</div><div className="data-value" style={{fontSize:'1.8rem'}}>{telemetry?.lap||1}</div></div>
                <div className="d-flex flex-column gap-1 flex-grow-1">
                  {[{l:'S1',d:s1},{l:'S2',d:s2},{l:'S3',d:s3}].map(({l,d})=>(<div key={l} className="d-flex justify-content-between align-items-center"><div className="d-flex align-items-center gap-2"><span style={{width:7,height:7,borderRadius:'50%',display:'inline-block',flexShrink:0,background:d.state==='done'?sectorColorHex(d.color):d.state==='running'?'var(--accent-green)':'var(--text-muted)',boxShadow:d.state==='running'?'0 0 6px var(--accent-green)':d.color==='purple'?'0 0 8px var(--sector-purple)':'none'}}/><span className="data-label">{l}</span></div><span style={{fontFamily:'var(--font-data)',fontSize:'13px',...sectorTextStyle(d)}}>{d.value!=null?formatSector(d.value):'--'}</span></div>))}
                </div>
                <div style={{textAlign:'right'}}><div className="data-label">Time</div><div className="data-value" style={{fontSize:'1.4rem'}}>{formatTime(telemetry?.lap_time)}</div></div>
              </div>
              <div className="flex-grow-1" style={{minHeight:0,overflowY:'auto',borderTop:'1px solid var(--border-subtle)',paddingTop:'8px'}}>
                <table className="data-table"><thead><tr><th>Lap</th><th>S1</th><th>S2</th><th>S3</th><th style={{textAlign:'right'}}>Total</th></tr></thead><tbody>
                  {lapHistory.length===0 ? <tr><td colSpan="5" style={{textAlign:'center',color:'var(--text-muted)',fontSize:'11px',padding:'16px'}}>Waiting for first lap...</td></tr>
                  : lapHistory.map(lap=>(<tr key={lap.lap}><td style={{fontWeight:700}}>{lap.lap}</td><td style={historySectorStyle(lap.sector_1_color)}>{formatSector(lap.sector_1)}</td><td style={historySectorStyle(lap.sector_2_color)}>{formatSector(lap.sector_2)}</td><td style={historySectorStyle(lap.sector_3_color)}>{formatSector(lap.sector_3)}</td><td style={{fontWeight:700,textAlign:'right'}}>{formatTime(lap.lap_time)}</td></tr>))}
                </tbody></table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TelemetryPage