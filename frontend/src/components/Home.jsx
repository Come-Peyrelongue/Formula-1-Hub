import { Link } from 'react-router-dom'
import f1Logo from '../assets/img/formula-1-logo.png' 

function Home() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center h-100 gap-3">
      <img src={f1Logo} alt="F1 Logo" width="150" />
      <p>Welcome to your</p>
      <h1 className="display-4">Formula 1® Hub Training App</h1>
    </div>
  )
}

export default Home