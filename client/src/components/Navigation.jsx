import { NavLink } from 'react-router-dom'
import './Navigation.css'

export default function Navigation() {
  return (
    <nav className="navigation">
      <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        <span className="icon">🏠</span>
        <span>Dashboard</span>
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        <span className="icon">📊</span>
        <span>História</span>
      </NavLink>
      <NavLink to="/inspection" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        <span className="icon">📋</span>
        <span>Kontrola</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        <span className="icon">⚙️</span>
        <span>Nastavenia</span>
      </NavLink>
      <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        <span className="icon">🔧</span>
        <span>Admin</span>
      </NavLink>
    </nav>
  )
}
