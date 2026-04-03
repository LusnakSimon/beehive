
import { NavLink } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import './Navigation.css'

export default function Navigation() {
  const { user, isAuthenticated, logout } = useAuth()
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const navDesktopRef = useRef(null)
  const [visibleCount, setVisibleCount] = useState(10)
  const [showDesktopMore, setShowDesktopMore] = useState(false)
  const desktopDropdownRef = useRef(null)

  // Adjust how many desktop nav items fit and move remainder into the 'More' dropdown
  useEffect(() => {
    const el = navDesktopRef.current
    if (!el) return

    const calculate = () => {
      const first = el.querySelector('.nav-link')
      const itemWidth = first ? Math.max(80, first.offsetWidth) : 100
      const available = Math.floor(el.clientWidth / itemWidth)
      const maxVisible = Math.max(1, Math.min(12, available))
      setVisibleCount(maxVisible)
    }

    // Initial calculation
    calculate()

    const ro = new ResizeObserver(() => calculate())
    ro.observe(el)
    window.addEventListener('resize', calculate)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', calculate)
    }
  }, [user?.role])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showDesktopMore) {
        const desktopDropdown = document.querySelector('.nav-more-desktop')
        const portalDropdown = desktopDropdownRef.current
        if (
          desktopDropdown &&
          !desktopDropdown.contains(e.target) &&
          portalDropdown &&
          !portalDropdown.contains(e.target)
        ) {
          setShowDesktopMore(false)
        }
      }
      if (showMobileMenu) {
        const mobileDropdown = document.querySelector('.nav-more')
        if (mobileDropdown && !mobileDropdown.contains(e.target)) {
          setShowMobileMenu(false)
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showDesktopMore, showMobileMenu])
  
  return (
    <nav className="navigation">
      {isAuthenticated ? (
        <>
          {/* Desktop Navigation - responsive with overflow 'More' menu */}
          <div className="nav-desktop" ref={navDesktopRef}>
            {(() => {
              const items = [
                { key: 'dashboard', to: '/', icon: '🏠', label: 'Dashboard' },
                { key: 'my-hives', to: '/my-hives', icon: '🐝', label: 'Moje úle' },
                { key: 'history', to: '/history', icon: '📊', label: 'História' },
                { key: 'inspection', to: '/inspection', icon: '📋', label: 'Kontrola' },
                { key: 'harvests', to: '/harvests', icon: '🍯', label: 'Zbery' },
                { key: 'map', to: '/map', icon: '🗺️', label: 'Mapa' },
                { key: 'settings', to: '/settings', icon: '⚙️', label: 'Nastavenia' }
              ]

              const visible = items.slice(0, visibleCount)
              const overflow = items.slice(visibleCount)

              return (
                <>
                  {visible.map(it => (
                    <NavLink key={it.key} to={it.to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                      <span className="icon">{it.icon}</span>
                      <span>{it.label}</span>
                    </NavLink>
                  ))}

                  {overflow.length > 0 && (
                    <div className="nav-more-desktop">
                      <button
                        className={`nav-link ${showDesktopMore ? 'active' : ''}`}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setShowDesktopMore(s => !s); 
                        }}
                        aria-expanded={showDesktopMore}
                        aria-haspopup="true"
                        aria-label="More navigation items"
                      >
                        <span className="icon">⋯</span>
                        <span>Viac</span>
                      </button>

                      {showDesktopMore && createPortal(
                        <div className="desktop-dropdown-portal" ref={desktopDropdownRef}>
                          {overflow.map(it => (
                            <NavLink key={it.key} to={it.to} className="desktop-dropdown-item" onClick={() => setShowDesktopMore(false)}>
                              <span className="icon">{it.icon}</span>
                              <span>{it.label}</span>
                            </NavLink>
                          ))}
                        </div>,
                        document.body
                      )}
                    </div>
                  )}
                </>
              )
            })()}
          </div>

          {/* Mobile Navigation - Core items only */}
          <div className="nav-mobile">
            <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">🏠</span>
              <span>Domov</span>
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">📜</span>
              <span>História</span>
            </NavLink>
            <NavLink to="/my-hives" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">🐝</span>
              <span>Moje úle</span>
            </NavLink>
            <NavLink to="/map" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <span className="icon">🗺️</span>
              <span>Mapa</span>
            </NavLink>
            <div className="nav-more">
              <button 
                className={`nav-link ${showMobileMenu ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setShowMobileMenu(!showMobileMenu); }}
                aria-expanded={showMobileMenu}
                aria-haspopup="true"
                aria-label="Zobraziť viac možností"
              >
                <span className="icon" aria-hidden="true">⋯</span>
                <span>Viac</span>
              </button>
              {showMobileMenu && (
                <div className="mobile-dropdown">
                  <NavLink to="/inspection" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">📋</span>
                    <span>Kontrola</span>
                  </NavLink>
                  <NavLink to="/harvests" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">🍯</span>
                    <span>Zbery</span>
                  </NavLink>
                  <NavLink to="/settings" className="mobile-dropdown-item" onClick={() => setShowMobileMenu(false)}>
                    <span className="icon">⚙️</span>
                    <span>Nastavenia</span>
                  </NavLink>
                  <button className="mobile-dropdown-item logout-item" onClick={() => { logout(); setShowMobileMenu(false); }}>
                    <span className="icon">🚪</span>
                    <span>Odhlásiť sa</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Desktop user section */}
          <div className="nav-user-section">
            <div className="nav-user-info">
              {user?.image && <img src={user.image} alt="" className="nav-avatar" aria-hidden="true" />}
              <span className="nav-username">{user?.name}</span>
            </div>
            <button onClick={logout} className="nav-logout-btn" aria-label="Odhlásiť sa">
              <span className="icon" aria-hidden="true">🚪</span>
            </button>
          </div>
        </>
      ) : (
        <NavLink to="/login" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="icon" aria-hidden="true">🔑</span>
          <span>Prihlásenie</span>
        </NavLink>
      )}
    </nav>
  )
}
