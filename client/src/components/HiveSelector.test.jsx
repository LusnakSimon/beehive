import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HiveSelector from './HiveSelector';
import * as HiveContext from '../context/HiveContext';

// Mock the HiveContext
vi.mock('../context/HiveContext', () => ({
  useHive: vi.fn()
}));

describe('HiveSelector', () => {
  const mockSetSelectedHive = vi.fn();
  const mockHives = [
    { id: 'hive1', name: 'Úľ 1', location: 'Záhrada', color: '#FFD700' },
    { id: 'hive2', name: 'Úľ 2', location: 'Sad', color: '#32CD32' },
    { id: 'hive3', name: 'Úľ 3', location: 'Les', color: '#4169E1' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state when hives not loaded', () => {
    HiveContext.useHive.mockReturnValue({
      selectedHive: null,
      setSelectedHive: mockSetSelectedHive,
      hives: []
    });

    render(<HiveSelector />);
    
    expect(screen.getByText('Načítavam úle...')).toBeInTheDocument();
  });

  it('should render selected hive when hives are loaded', () => {
    HiveContext.useHive.mockReturnValue({
      selectedHive: 'hive1',
      setSelectedHive: mockSetSelectedHive,
      hives: mockHives
    });

    render(<HiveSelector />);
    
    expect(screen.getByText('Úľ 1')).toBeInTheDocument();
    expect(screen.getByText('Záhrada')).toBeInTheDocument();
  });

  it('should open dropdown when clicked', () => {
    HiveContext.useHive.mockReturnValue({
      selectedHive: 'hive1',
      setSelectedHive: mockSetSelectedHive,
      hives: mockHives
    });

    render(<HiveSelector />);
    
    // Dropdown should be closed initially
    expect(screen.queryByText('Sad')).not.toBeInTheDocument();
    
    // Click to open
    const button = screen.getByRole('button', { name: /Úľ 1/i });
    fireEvent.click(button);
    
    // All hives should be visible
    expect(screen.getByText('Sad')).toBeInTheDocument();
    expect(screen.getByText('Les')).toBeInTheDocument();
  });

  it('should select a different hive when clicked', () => {
    HiveContext.useHive.mockReturnValue({
      selectedHive: 'hive1',
      setSelectedHive: mockSetSelectedHive,
      hives: mockHives
    });

    render(<HiveSelector />);
    
    // Open dropdown
    const button = screen.getByRole('button', { name: /Úľ 1/i });
    fireEvent.click(button);
    
    // Click on Úľ 2
    const hive2Button = screen.getByRole('button', { name: /Úľ 2/i });
    fireEvent.click(hive2Button);
    
    expect(mockSetSelectedHive).toHaveBeenCalledWith('hive2');
  });

  it('should close dropdown when overlay is clicked', () => {
    HiveContext.useHive.mockReturnValue({
      selectedHive: 'hive1',
      setSelectedHive: mockSetSelectedHive,
      hives: mockHives
    });

    render(<HiveSelector />);
    
    // Open dropdown
    const button = screen.getByRole('button', { name: /Úľ 1/i });
    fireEvent.click(button);
    
    // Dropdown should be visible
    expect(screen.getByText('Sad')).toBeInTheDocument();
    
    // Click overlay to close
    const overlay = document.querySelector('.hive-dropdown-overlay');
    fireEvent.click(overlay);
    
    // Dropdown should be closed
    expect(screen.queryByText('Sad')).not.toBeInTheDocument();
  });

  it('should show check icon for selected hive', () => {
    HiveContext.useHive.mockReturnValue({
      selectedHive: 'hive1',
      setSelectedHive: mockSetSelectedHive,
      hives: mockHives
    });

    render(<HiveSelector />);
    
    // Open dropdown
    const button = screen.getByRole('button', { name: /Úľ 1/i });
    fireEvent.click(button);
    
    // Check icon should be visible for selected hive
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('should display bee emoji for each hive', () => {
    HiveContext.useHive.mockReturnValue({
      selectedHive: 'hive1',
      setSelectedHive: mockSetSelectedHive,
      hives: mockHives
    });

    render(<HiveSelector />);
    
    // Open dropdown
    const button = screen.getByRole('button', { name: /Úľ 1/i });
    fireEvent.click(button);
    
    // Multiple bee emojis should be visible
    const beeEmojis = screen.getAllByText('🐝');
    expect(beeEmojis.length).toBeGreaterThan(1);
  });

  it('should default to first hive if selected hive not found', () => {
    HiveContext.useHive.mockReturnValue({
      selectedHive: 'nonexistent',
      setSelectedHive: mockSetSelectedHive,
      hives: mockHives
    });

    render(<HiveSelector />);
    
    // Should show first hive
    expect(screen.getByText('Úľ 1')).toBeInTheDocument();
    expect(screen.getByText('Záhrada')).toBeInTheDocument();
  });
});
