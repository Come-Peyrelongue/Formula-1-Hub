import { Link } from 'react-router-dom'
import f1Logo from '../assets/img/formula-1-logo.png'

function Home() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center h-100 gap-3">
      <img src={f1Logo} alt="F1 Logo" width="150" style={{ opacity: 0.9 }} />
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Welcome to your</p>
      <h1 style={{
        fontFamily: 'var(--font-ui)',
        fontWeight: 700,
        fontSize: '2.8rem',
        color: 'var(--text-heading)',
        letterSpacing: '-1px',
        textAlign: 'center',
      }}>
        Formula 1® Hub
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '-8px' }}>
        Training & Analysis Dashboard
      </p>
    </div>
  )
}

export default Home