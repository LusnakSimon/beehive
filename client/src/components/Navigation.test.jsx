import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Navigation from './Navigation'

// Mock the AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
    logout: vi.fn(),
  })),
  AuthProvider: ({ children }) => children,
}))


// Get the mock
import { useAuth } from '../contexts/AuthContext'

const renderNavigation = () => {
  return render(
    <BrowserRouter>
      <Navigation />
    </BrowserRouter>
  )
}

describe('Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    }))
  })

  it('should render login link when not authenticated', () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      logout: vi.fn(),
    })
    
    renderNavigation()
    
    // Component shows "Prihlásenie" (not "Prihlásiť sa")
    expect(screen.getByText('Prihlásenie')).toBeInTheDocument()
  })

  it('should show navigation links when authenticated', () => {
    useAuth.mockReturnValue({
      user: { name: 'Test User', email: 'test@test.com' },
      isAuthenticated: true,
      logout: vi.fn(),
    })
    
    renderNavigation()
    
    // Desktop nav shows at least Dashboard; mobile nav shows Domov, História, Moje úle
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Domov')).toBeInTheDocument()
    expect(screen.getByText('História')).toBeInTheDocument()
  })

  it('should show user name when authenticated', () => {
    useAuth.mockReturnValue({
      user: { name: 'John Doe', email: 'john@test.com' },
      isAuthenticated: true,
      logout: vi.fn(),
    })
    
    renderNavigation()
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('should show mobile navigation with Viac button', () => {
    useAuth.mockReturnValue({
      user: { name: 'Test User', email: 'test@test.com' },
      isAuthenticated: true,
      logout: vi.fn(),
    })
    
    renderNavigation()
    
    // Mobile nav has "Viac" button for menu expansion
    const viacButtons = screen.getAllByText('Viac')
    expect(viacButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('should have logout button when authenticated', () => {
    const mockLogout = vi.fn()
    useAuth.mockReturnValue({
      user: { name: 'Test User', email: 'test@test.com' },
      isAuthenticated: true,
      logout: mockLogout,
    })
    
    renderNavigation()
    
    // Logout button has aria-label "Odhlásiť sa"
    const logoutButton = screen.getByRole('button', { name: 'Odhlásiť sa' })
    expect(logoutButton).toBeInTheDocument()
  })
})
