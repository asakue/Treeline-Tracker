import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ProfilePage } from '@/views/profile-page';
import type { AppUserProfile } from '@/entities/app';

// Mock dependencies
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));

vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/core/security/identity-manager', () => ({
  getOrCreateLocalIdentity: vi.fn().mockResolvedValue({
    userId: 'usr-sar-777',
    publicKey: 'ed25519_pk_mock_key_1234567890',
    privateKey: 'mock_sk',
    displayName: 'Алексей Смирнов',
    createdAt: 1710000000000,
  }),
  rotateLocalIdentity: vi.fn().mockResolvedValue({
    userId: 'usr-sar-777',
    publicKey: 'ed25519_pk_mock_key_rotated',
    privateKey: 'mock_sk_rotated',
    displayName: 'Алексей Смирнов',
    createdAt: 1710000000000,
  }),
}));

vi.mock('@/core/repositories', () => ({
  routeRepository: {
    getRoutes: vi.fn().mockResolvedValue([
      {
        id: 'route-1',
        name: 'Тропа на перевал Дятлова',
        distance: '14.5 км',
        path: [[55.75, 37.61], [55.76, 37.62]],
      },
    ]),
  },
}));

describe('ProfilePage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUserProfile: AppUserProfile = {
    displayName: 'Алексей Смирнов',
    email: 'alexey.smirnov@treeline.org',
    phone: '+7 (999) 765-43-21',
    emergencyContact: '+7 (999) 111-22-33',
    experienceLevel: 'Expert',
    bio: 'Инструктор по спортивному туризму и радиосвязи в горах.',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
  };

  it('renders profile data correctly when provided', () => {
    render(<ProfilePage profile={mockUserProfile} />);

    // 1. Check user display name
    expect(screen.getByText('Алексей Смирнов')).toBeInTheDocument();

    // 2. Check email address
    expect(screen.getByText('alexey.smirnov@treeline.org')).toBeInTheDocument();

    // 3. Check phone number
    expect(screen.getByText('+7 (999) 765-43-21')).toBeInTheDocument();

    // 4. Check biography text
    expect(
      screen.getByText('«Инструктор по спортивному туризму и радиосвязи в горах.»')
    ).toBeInTheDocument();

    // 5. Check avatar image has the right alt text and src
    const avatarImg = screen.getByAltText('Алексей Смирнов');
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute('src', mockUserProfile.avatarUrl);
  });

  it('renders default fallback labels when profile data is empty or omitted', () => {
    render(<ProfilePage profile={{ displayName: '', email: '', phone: '', bio: '' }} />);

    // Fallbacks
    expect(screen.getByText('Мой профиль')).toBeInTheDocument();
    expect(screen.getByText('Email не указан')).toBeInTheDocument();
  });

  it('renders profile completion status checklist accurately', () => {
    render(<ProfilePage profile={mockUserProfile} />);

    expect(screen.getByText('Заполненность профиля')).toBeInTheDocument();
    expect(screen.getByText('Фото профиля')).toBeInTheDocument();
    expect(screen.getByText('Имя профиля')).toBeInTheDocument();
    expect(screen.getByText('Email контакт')).toBeInTheDocument();
    expect(screen.getByText('Телефон')).toBeInTheDocument();
    expect(screen.getByText('SOS контакт')).toBeInTheDocument();
  });

  it('renders tab triggers for Profile and Security sections', () => {
    render(<ProfilePage profile={mockUserProfile} />);

    expect(screen.getByRole('tab', { name: /профиль/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /безопасность/i })).toBeInTheDocument();
  });

  it('opens edit profile modal with current profile data when Edit button is clicked', async () => {
    render(<ProfilePage profile={mockUserProfile} />);

    const editButton = screen.getByRole('button', { name: /редактировать/i });
    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    // Check that the dialog opened
    expect(screen.getByText('Редактирование профиля')).toBeInTheDocument();

    // Check that the input fields contain the provided profile data
    const nameInput = screen.getByLabelText(/имя \/ позывной/i) as HTMLInputElement;
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    const phoneInput = screen.getByLabelText(/телефон/i) as HTMLInputElement;
    const emergencyInput = screen.getByLabelText(/sos контакт/i) as HTMLInputElement;
    const bioInput = screen.getByLabelText(/о себе/i) as HTMLTextAreaElement;

    expect(nameInput.value).toBe('Алексей Смирнов');
    expect(emailInput.value).toBe('alexey.smirnov@treeline.org');
    expect(phoneInput.value).toBe('+7 (999) 765-43-21');
    expect(emergencyInput.value).toBe('+7 (999) 111-22-33');
    expect(bioInput.value).toBe('Инструктор по спортивному туризму и радиосвязи в горах.');
  });

  it('calls onUpdateProfile callback when saving changes in edit modal', async () => {
    const handleUpdate = vi.fn();
    render(<ProfilePage profile={mockUserProfile} onUpdateProfile={handleUpdate} />);

    // Open edit dialog
    fireEvent.click(screen.getByRole('button', { name: /редактировать/i }));

    // Modify name input
    const nameInput = screen.getByLabelText(/имя \/ позывной/i);
    fireEvent.change(nameInput, { target: { value: 'Алексей Обновленный' } });

    // Click Save
    const saveButton = screen.getByRole('button', { name: /сохранить/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Алексей Обновленный',
        })
      );
    });
  });
});
