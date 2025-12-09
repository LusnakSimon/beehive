import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Test component to access auth context
const TestComponent = ({ onAuth }) => {
  const auth = useAuth();
  onAuth?.(auth);
  return (
    <div>
      <span data-testid="loading">{auth.loading.toString()}</span>
      <span data-testid="authenticated">{auth.isAuthenticated.toString()}</span>
      <span data-testid="user">{auth.user ? auth.user.name : 'null'}</span>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    // Suppress console error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within AuthProvider');
    
    consoleSpy.mockRestore();
  });

  it('should start with loading state', async () => {
    // Never resolve fetch to keep loading state
    global.fetch.mockImplementation(() => new Promise(() => {}));
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    expect(screen.getByTestId('loading').textContent).toBe('true');
  });

  it('should set authenticated when session exists', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        user: { id: '123', name: 'Jano', email: 'jano@test.com' }
      })
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('Jano');
  });

  it('should remain unauthenticated when no session', async () => {
    global.fetch.mockResolvedValue({
      ok: false
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('should handle session check error gracefully', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    consoleSpy.mockRestore();
  });

  it('should provide login function that redirects to OAuth', async () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };
    
    global.fetch.mockResolvedValue({ ok: false });

    let authContext;
    render(
      <AuthProvider>
        <TestComponent onAuth={(auth) => { authContext = auth; }} />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      await authContext.login('google');
    });
    
    expect(window.location.href).toBe('/api/auth/google');
    
    window.location = originalLocation;
  });

  it('should provide logout function that clears session', async () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };
    
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user: { id: '123', name: 'Jano' }
        })
      })
      .mockResolvedValueOnce({ ok: true }); // logout call

    let authContext;
    render(
      <AuthProvider>
        <TestComponent onAuth={(auth) => { authContext = auth; }} />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    await act(async () => {
      await authContext.logout();
    });
    
    expect(window.location.href).toBe('/login');
    
    window.location = originalLocation;
  });

  it('should provide refreshUser function', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        user: { id: '123', name: 'Jano', email: 'jano@test.com' }
      })
    });

    let authContext;
    render(
      <AuthProvider>
        <TestComponent onAuth={(auth) => { authContext = auth; }} />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // Update mock for refresh
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        user: { id: '123', name: 'Updated Jano', email: 'jano@test.com' }
      })
    });

    let result;
    await act(async () => {
      result = await authContext.refreshUser();
    });
    
    expect(result).toBe(true);
  });
});
