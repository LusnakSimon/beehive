import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';
import * as AuthContext from '../contexts/AuthContext';

// Mock the AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

// Mock window.location
const mockLocation = {
  href: ''
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

describe('Login', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
  });

  it('should show loading spinner when loading', () => {
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: false,
      login: mockLogin,
      loading: true
    });

    render(<Login />);
    
    expect(document.querySelector('.spinner')).toBeInTheDocument();
  });

  it('should render login page when not authenticated', () => {
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: false,
      login: mockLogin,
      loading: false
    });

    render(<Login />);
    
    expect(screen.getByText('eBeeHive')).toBeInTheDocument();
    expect(screen.getByText('Inteligentný systém monitorovania úľov')).toBeInTheDocument();
    expect(screen.getByText('Prihlásenie')).toBeInTheDocument();
  });

  it('should render Google and GitHub login buttons', () => {
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: false,
      login: mockLogin,
      loading: false
    });

    render(<Login />);
    
    expect(screen.getByText('Pokračovať s Google')).toBeInTheDocument();
    expect(screen.getByText('Pokračovať s GitHub')).toBeInTheDocument();
  });

  it('should call login with google when Google button is clicked', async () => {
    mockLogin.mockResolvedValue();
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: false,
      login: mockLogin,
      loading: false
    });

    render(<Login />);
    
    const googleButton = screen.getByText('Pokračovať s Google');
    fireEvent.click(googleButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('google');
    });
  });

  it('should call login with github when GitHub button is clicked', async () => {
    mockLogin.mockResolvedValue();
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: false,
      login: mockLogin,
      loading: false
    });

    render(<Login />);
    
    const githubButton = screen.getByText('Pokračovať s GitHub');
    fireEvent.click(githubButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('github');
    });
  });

  it('should redirect to home when already authenticated', async () => {
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: true,
      login: mockLogin,
      loading: false
    });

    render(<Login />);
    
    await waitFor(() => {
      expect(mockLocation.href).toBe('/');
    });
  });

  it('should show info about why account is needed', () => {
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: false,
      login: mockLogin,
      loading: false
    });

    render(<Login />);
    
    expect(screen.getByText('Prečo potrebujem účet?')).toBeInTheDocument();
    expect(screen.getByText(/Zabezpečené uloženie/)).toBeInTheDocument();
    expect(screen.getByText(/Prístup z viacerých zariadení/)).toBeInTheDocument();
    expect(screen.getByText(/Personalizované notifikácie/)).toBeInTheDocument();
    expect(screen.getByText(/Správa tvojich úľov/)).toBeInTheDocument();
  });

  it('should display privacy link', () => {
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: false,
      login: mockLogin,
      loading: false
    });

    render(<Login />);
    
    const privacyLink = screen.getByRole('link', { name: /zásadami ochrany osobných údajov/i });
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('should display bee emoji as login icon', () => {
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: false,
      login: mockLogin,
      loading: false
    });

    render(<Login />);
    
    // Multiple bee emojis exist (header and list item), check at least one exists
    const beeEmojis = screen.getAllByText('🐝');
    expect(beeEmojis.length).toBeGreaterThan(0);
  });

  it('should show alert when login fails', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockLogin.mockRejectedValue(new Error('Login failed'));
    AuthContext.useAuth.mockReturnValue({
      isAuthenticated: false,
      login: mockLogin,
      loading: false
    });

    render(<Login />);
    
    const googleButton = screen.getByText('Pokračovať s Google');
    fireEvent.click(googleButton);
    
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('Prihlásenie zlyhalo. Skús to prosím znova.');
    });
    
    alertMock.mockRestore();
  });
});
