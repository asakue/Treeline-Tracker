import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ProfilePage } from '@/views/profile-page';
import type { AppUserProfile } from '@/entities/app';
import * as identityManager from '@/core/security/identity-manager';
import { routeRepository } from '@/core/repositories';

// Mock theme hook
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));

// Mock toast notifications
const mockToast = vi.fn();
vi.mock('@/shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock identity manager
vi.mock('@/core/security/identity-manager', () => ({
  getOrCreateLocalIdentity: vi.fn(),
  rotateLocalIdentity: vi.fn(),
}));

// Mock route repository
vi.mock('@/core/repositories', () => ({
  routeRepository: {
    getRoutes: vi.fn().mockResolvedValue([]),
  },
}));

describe('ProfilePage Component (src/views/profile-page)', () => {
  const defaultMockIdentity = {
    userId: 'usr-sec-999-alpha',
    publicKey: 'ed25519_pk_mock_test_public_key_abc123',
    privateKey: 'mock_sk_test_private',
    displayName: 'Дмитрий Соколов',
    createdAt: 1715000000000,
  };

  const fullUserProfile: AppUserProfile = {
    displayName: 'Дмитрий Соколов',
    email: 'dmitry.sokolov@treeline.org',
    phone: '+7 (999) 333-22-11',
    emergencyContact: '+7 (999) 777-88-99',
    experienceLevel: 'Expert',
    bio: 'Старший координатор спасательных операций и картограф.',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response);

    vi.mocked(identityManager.getOrCreateLocalIdentity).mockResolvedValue(defaultMockIdentity);
    vi.mocked(identityManager.rotateLocalIdentity).mockResolvedValue({
      ...defaultMockIdentity,
      publicKey: 'ed25519_pk_mock_rotated_new_key_xyz890',
    });
    vi.mocked(routeRepository.getRoutes).mockResolvedValue([]);
  });

  // =========================================================================
  // 1. RENDERING USER DATA
  // =========================================================================
  describe('User Data Rendering', () => {
    it('renders complete user profile information correctly', async () => {
      render(<ProfilePage profile={fullUserProfile} />);

      // Verify display name and header
      expect(screen.getByText('Личный кабинет')).toBeInTheDocument();
      expect(screen.getByText('Дмитрий Соколов')).toBeInTheDocument();

      // Verify email
      expect(screen.getByText('dmitry.sokolov@treeline.org')).toBeInTheDocument();

      // Verify phone number
      expect(screen.getByText('+7 (999) 333-22-11')).toBeInTheDocument();

      // Verify biography
      expect(
        screen.getByText('«Старший координатор спасательных операций и картограф.»')
      ).toBeInTheDocument();

      // Verify avatar image with correct src and alt
      const avatarImage = screen.getByAltText('Дмитрий Соколов');
      expect(avatarImage).toBeInTheDocument();
      expect(avatarImage).toHaveAttribute('src', fullUserProfile.avatarUrl);

      // Verify E2EE status badge
      expect(screen.getByText(/E2EE Active/i)).toBeInTheDocument();
    });

    it('renders fallback placeholders when profile data is empty or omitted', async () => {
      render(<ProfilePage profile={{ displayName: '', email: '', phone: '', bio: '', avatarUrl: '' }} />);

      // Fallbacks
      expect(screen.getByText('Мой профиль')).toBeInTheDocument();
      expect(screen.getByText('Email не указан')).toBeInTheDocument();
    });

    it('opens edit modal dialog with pre-filled profile fields and allows editing', async () => {
      const handleUpdate = vi.fn();
      render(<ProfilePage profile={fullUserProfile} onUpdateProfile={handleUpdate} />);

      // Click Edit button
      const editButton = screen.getByRole('button', { name: /редактировать/i });
      fireEvent.click(editButton);

      // Verify modal dialog opened
      expect(screen.getByText('Редактирование профиля')).toBeInTheDocument();
      expect(
        screen.getByText('Укажите ваши персональные данные и контакты для экстренной связи')
      ).toBeInTheDocument();

      // Verify inputs have pre-filled values
      const nameInput = screen.getByLabelText(/имя \/ позывной/i) as HTMLInputElement;
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
      const phoneInput = screen.getByLabelText(/телефон/i) as HTMLInputElement;
      const emergencyInput = screen.getByLabelText(/sos контакт/i) as HTMLInputElement;
      const bioInput = screen.getByLabelText(/о себе/i) as HTMLTextAreaElement;

      expect(nameInput.value).toBe('Дмитрий Соколов');
      expect(emailInput.value).toBe('dmitry.sokolov@treeline.org');
      expect(phoneInput.value).toBe('+7 (999) 333-22-11');
      expect(emergencyInput.value).toBe('+7 (999) 777-88-99');
      expect(bioInput.value).toBe('Старший координатор спасательных операций и картограф.');

      // Update name in form and save
      fireEvent.change(nameInput, { target: { value: 'Дмитрий С. (Командир)' } });

      const saveButton = screen.getByRole('button', { name: /сохранить/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(handleUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            displayName: 'Дмитрий С. (Командир)',
          })
        );
      });
    });

    it('triggers profile reset when the Reset button is clicked', async () => {
      const handleUpdate = vi.fn();
      render(<ProfilePage profile={fullUserProfile} onUpdateProfile={handleUpdate} />);

      const resetButton = screen.getByRole('button', { name: /сброс/i });
      fireEvent.click(resetButton);

      expect(handleUpdate).toHaveBeenCalledWith({
        displayName: '',
        email: '',
        avatarUrl: '',
        phone: '',
        emergencyContact: '',
        experienceLevel: 'Beginner',
        bio: '',
      });
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Сброс данных',
        })
      );
    });
  });

  // =========================================================================
  // 2. PROFILE COMPLETION PERCENTAGE CALCULATIONS
  // =========================================================================
  describe('Profile Completion Calculations', () => {
    it('calculates 100% completion when all 6 profile and cryptographic checks pass', async () => {
      render(<ProfilePage profile={fullUserProfile} />);

      // Wait for identity promise to resolve
      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });

      // Verify all checklist items exist
      expect(screen.getByText('Заполненность профиля')).toBeInTheDocument();
      expect(screen.getByText('Фото профиля')).toBeInTheDocument();
      expect(screen.getByText('Имя профиля')).toBeInTheDocument();
      expect(screen.getByText('Email контакт')).toBeInTheDocument();
      expect(screen.getByText('Телефон')).toBeInTheDocument();
      expect(screen.getByText('SOS контакт')).toBeInTheDocument();
      expect(screen.getByText('Ключ Ed25519')).toBeInTheDocument();
    });

    it('calculates 50% completion when exactly 3 out of 6 items are completed', async () => {
      // 3 items completed: name, email, and crypto key (resolved by identityManager)
      const partialProfile: Partial<AppUserProfile> = {
        displayName: 'Анна Воронова',
        email: 'anna@treeline.org',
        phone: '',
        emergencyContact: '',
        avatarUrl: '',
        bio: '',
      };

      render(<ProfilePage profile={partialProfile} />);

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });
    });

    it('calculates 67% completion when 4 out of 6 items are completed', async () => {
      // 4 items: name, email, phone, and crypto key (4 / 6 = 66.67% -> rounds to 67%)
      const partialProfile: Partial<AppUserProfile> = {
        displayName: 'Анна Воронова',
        email: 'anna@treeline.org',
        phone: '+7 (911) 222-33-44',
        emergencyContact: '',
        avatarUrl: '',
        bio: '',
      };

      render(<ProfilePage profile={partialProfile} />);

      await waitFor(() => {
        expect(screen.getByText('67%')).toBeInTheDocument();
      });
    });

    it('calculates 83% completion when 5 out of 6 items are completed', async () => {
      // 5 items: name, email, phone, emergencyContact, and crypto key (5 / 6 = 83.33% -> rounds to 83%)
      const partialProfile: Partial<AppUserProfile> = {
        displayName: 'Анна Воронова',
        email: 'anna@treeline.org',
        phone: '+7 (911) 222-33-44',
        emergencyContact: '+7 (911) 999-00-11',
        avatarUrl: '', // missing avatar
        bio: '',
      };

      render(<ProfilePage profile={partialProfile} />);

      await waitFor(() => {
        expect(screen.getByText('83%')).toBeInTheDocument();
      });
    });

    it('calculates 17% completion when only the crypto identity key is present', async () => {
      // 1 item: crypto key (1 / 6 = 16.67% -> rounds to 17%)
      // displayName is empty or "Мой профиль", which fails the name check
      const emptyProfile: Partial<AppUserProfile> = {
        displayName: '',
        email: '',
        phone: '',
        emergencyContact: '',
        avatarUrl: '',
        bio: '',
      };

      render(<ProfilePage profile={emptyProfile} />);

      await waitFor(() => {
        expect(screen.getByText('17%')).toBeInTheDocument();
      });
    });

    it('calculates 0% completion when no profile fields and no crypto key are present', async () => {
      // Identity resolves without public key
      vi.mocked(identityManager.getOrCreateLocalIdentity).mockResolvedValue({
        userId: 'temp-user',
        publicKey: '',
        privateKey: '',
        displayName: 'Мой профиль',
        createdAt: Date.now(),
      });

      const zeroProfile: Partial<AppUserProfile> = {
        displayName: 'Мой профиль', // Treated as empty/default name
        email: '',
        phone: '',
        emergencyContact: '',
        avatarUrl: '',
        bio: '',
      };

      render(<ProfilePage profile={zeroProfile} />);

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 3. KEY SECURITY UI ELEMENTS & CRYPTOGRAPHIC FEATURES
  // =========================================================================
  describe('Security UI Elements', () => {
    const switchToSecurityTab = () => {
      const securityTab = screen.getByRole('tab', { name: /безопасность/i });
      fireEvent.mouseDown(securityTab, { button: 0 });
      fireEvent.click(securityTab);
      return securityTab;
    };

    it('renders security tab trigger and switches to security panel on click', async () => {
      render(<ProfilePage profile={fullUserProfile} />);

      const securityTab = screen.getByRole('tab', { name: /безопасность/i });
      expect(securityTab).toBeInTheDocument();

      switchToSecurityTab();

      // Verify that security panel contents become visible
      await waitFor(() => {
        expect(
          screen.getByText('Криптографическая идентичность (Ed25519)')
        ).toBeInTheDocument();
      });
    });

    it('displays cryptographic identity details (User ID, Ed25519 Public Key, and Verified badge)', async () => {
      render(<ProfilePage profile={fullUserProfile} />);

      // Switch to Security tab
      switchToSecurityTab();

      // Section descriptions and title
      expect(
        screen.getByText('Криптографическая идентичность (Ed25519)')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Децентрализованная пара ключей для цифровой подписи и E2EE аутентификации')
      ).toBeInTheDocument();

      // User ID section
      expect(screen.getByText('Идентификатор пользователя (User ID)')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('usr-sec-999-alpha')).toBeInTheDocument();
      });

      // Public key section
      expect(screen.getByText('Открытый ключ подписи (Ed25519 Public Key)')).toBeInTheDocument();
      expect(screen.getByText('ed25519_pk_mock_test_public_key_abc123')).toBeInTheDocument();
    });

    it('allows copying the Ed25519 public key to clipboard', async () => {
      render(<ProfilePage profile={fullUserProfile} />);

      switchToSecurityTab();

      await waitFor(() => {
        expect(screen.getByText('ed25519_pk_mock_test_public_key_abc123')).toBeInTheDocument();
      });

      const copyButton = screen.getByRole('button', { name: /копировать/i });
      fireEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'ed25519_pk_mock_test_public_key_abc123'
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Открытый ключ скопирован',
        })
      );
    });

    it('handles cryptographic key rotation via "Сменить ключ" button', async () => {
      render(<ProfilePage profile={fullUserProfile} />);

      switchToSecurityTab();

      const rotateButton = screen.getByRole('button', { name: /сменить ключ/i });
      fireEvent.click(rotateButton);

      await waitFor(() => {
        expect(identityManager.rotateLocalIdentity).toHaveBeenCalledWith('Дмитрий Соколов');
        expect(screen.getByText('ed25519_pk_mock_rotated_new_key_xyz890')).toBeInTheDocument();
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Ключи успешно обновлены',
        })
      );
    });

    it('displays all three geodata privacy modes (NORMAL, REDUCED, STEALTH) and allows switching', async () => {
      render(<ProfilePage profile={fullUserProfile} />);

      switchToSecurityTab();

      // Verify privacy mode section title and descriptions
      expect(screen.getByText('Приватность геоданных')).toBeInTheDocument();
      expect(
        screen.getByText('Уровень детализации передачи координат в эфир')
      ).toBeInTheDocument();

      // Check all three privacy options are rendered
      expect(screen.getByText('NORMAL (Стандарт)')).toBeInTheDocument();
      expect(
        screen.getByText('Точные координаты GNSS (~5м) для проводника и группы')
      ).toBeInTheDocument();

      expect(screen.getByText('REDUCED (Огрубление)')).toBeInTheDocument();
      expect(
        screen.getByText('Сетка 200х200м без микро-траекторий и скорости')
      ).toBeInTheDocument();

      expect(screen.getByText('STEALTH (Стелс)')).toBeInTheDocument();
      expect(
        screen.getByText('Локальная запись трека, радиоэфир отключен')
      ).toBeInTheDocument();

      // Click REDUCED mode
      const reducedOption = screen.getByText('REDUCED (Огрубление)').closest('div');
      expect(reducedOption).not.toBeNull();
      fireEvent.click(reducedOption!);

      expect(localStorage.getItem('treeline_privacy_mode')).toBe('REDUCED');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Режим приватности обновлен',
          description: 'Координаты огрубляются до сетки 200х200м.',
        })
      );

      // Click STEALTH mode
      const stealthOption = screen.getByText('STEALTH (Стелс)').closest('div');
      expect(stealthOption).not.toBeNull();
      fireEvent.click(stealthOption!);

      expect(localStorage.getItem('treeline_privacy_mode')).toBe('STEALTH');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Режим приватности обновлен',
          description: 'Стелс-режим: геоданные сохраняются только локально.',
        })
      );
    });

    it('displays cryptographic protocols and zero-knowledge overview card', async () => {
      render(<ProfilePage profile={fullUserProfile} />);

      switchToSecurityTab();

      // Card Header
      expect(
        screen.getByText('Криптографическая защита и протоколы связи')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Архитектура нулевого доверия (Zero-Knowledge) для полевых и оффлайн условий')
      ).toBeInTheDocument();

      // Key cryptographic primitives
      expect(screen.getByText('Ed25519 WebCrypto')).toBeInTheDocument();
      expect(
        screen.getByText('Асимметричная цифровая подпись каждого переданного пакета телеметрии.')
      ).toBeInTheDocument();

      expect(screen.getByText('AES-256-GCM AEAD')).toBeInTheDocument();
      expect(
        screen.getByText('Сквозное шифрование координат и групповых сообщений со встроенной аутентификацией.')
      ).toBeInTheDocument();

      expect(screen.getByText('Anti-Replay & Nonce')).toBeInTheDocument();
      expect(
        screen.getByText('Защита от повтора пакетов и подмены координат со строгим временным окном свежести.')
      ).toBeInTheDocument();
    });
  });
});
