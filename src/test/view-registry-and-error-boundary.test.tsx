import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  VIEW_REGISTRY,
  getViewDefinition,
  getDesktopPrimaryNav,
  getDesktopSafetyNav,
  getMobileBottomNavItems,
  getMobileDrawerItems,
  type ViewId,
} from '@/shared/lib/view-registry';
import { ViewErrorBoundary } from '@/shared/ui/view-error-boundary';

describe('View Registry (view-registry.ts)', () => {
  it('registers all core view definitions with required attributes', () => {
    const requiredViews: ViewId[] = [
      'map',
      'tracker',
      'routes',
      'analytics',
      'chat',
      'weather',
      'search',
      'emergency',
      'profile',
      'about',
      'about-app',
    ];

    for (const viewId of requiredViews) {
      const def = VIEW_REGISTRY[viewId];
      expect(def).toBeDefined();
      expect(def.id).toBe(viewId);
      expect(def.label).toBeTruthy();
      expect(def.tooltip).toBeTruthy();
      expect(def.icon).toBeDefined();
      expect(def.category).toBeDefined();
    }
  });

  it('marks emergency view with isEmergency flag', () => {
    expect(VIEW_REGISTRY.emergency.isEmergency).toBe(true);
    expect(VIEW_REGISTRY.emergency.category).toBe('safety');
  });

  it('marks fullScreen views accurately', () => {
    expect(VIEW_REGISTRY.map.fullScreen).toBe(true);
    expect(VIEW_REGISTRY.chat.fullScreen).toBe(true);
    expect(VIEW_REGISTRY.tracker.fullScreen).toBeFalsy();
  });

  it('returns correctly grouped desktop primary nav items', () => {
    const primaryNav = getDesktopPrimaryNav();
    const ids = primaryNav.map((item) => item.id);
    expect(ids).toEqual(['map', 'tracker', 'routes', 'analytics', 'chat', 'weather']);
  });

  it('returns correctly grouped desktop safety items', () => {
    const safetyNav = getDesktopSafetyNav();
    const ids = safetyNav.map((item) => item.id);
    expect(ids).toEqual(['search', 'emergency']);
  });

  it('returns mobile bottom nav items with emergency included', () => {
    const mobileNav = getMobileBottomNavItems();
    const ids = mobileNav.map((item) => item.id);
    expect(ids).toEqual(['map', 'tracker', 'routes', 'emergency']);
  });

  it('returns mobile drawer items covering secondary views', () => {
    const drawerItems = getMobileDrawerItems();
    const ids = drawerItems.map((item) => item.id);
    expect(ids).toContain('chat');
    expect(ids).toContain('analytics');
    expect(ids).toContain('weather');
    expect(ids).toContain('search');
    expect(ids).toContain('about');
    expect(ids).toContain('about-app');
  });

  it('falls back to map definition when an unknown view id is requested', () => {
    // @ts-expect-error test invalid viewId
    const fallback = getViewDefinition('unknown-random-view');
    expect(fallback).toBeDefined();
    expect(fallback.id).toBe('map');
  });
});

describe('ViewErrorBoundary Component', () => {
  beforeEach(() => {
    // Suppress console.error in tests for expected thrown errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const HealthyComponent = () => <div>Компонент успешно отрендерен</div>;

  const CrashingComponent = () => {
    throw new Error('Test crash in navigation view');
  };

  it('renders children smoothly when no render error occurs', () => {
    render(
      <ViewErrorBoundary viewName="Тестовый раздел">
        <HealthyComponent />
      </ViewErrorBoundary>
    );

    expect(screen.getByText('Компонент успешно отрендерен')).toBeInTheDocument();
  });

  it('catches render errors and displays localized fallback card with view name', () => {
    render(
      <ViewErrorBoundary viewName="Трекер группы">
        <CrashingComponent />
      </ViewErrorBoundary>
    );

    expect(screen.getByText('Сбой отображения раздела')).toBeInTheDocument();
    expect(screen.getByText(/«Трекер группы»/)).toBeInTheDocument();
    expect(screen.getByText('Test crash in navigation view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Повторить попытку/i })).toBeInTheDocument();
  });

  it('navigates back to map when "На карту" button is clicked', () => {
    const onGoToMap = vi.fn();

    render(
      <ViewErrorBoundary viewName="Аналитика" onGoToMap={onGoToMap}>
        <CrashingComponent />
      </ViewErrorBoundary>
    );

    const mapButton = screen.getByRole('button', { name: /На карту/i });
    expect(mapButton).toBeInTheDocument();

    fireEvent.click(mapButton);
    expect(onGoToMap).toHaveBeenCalledTimes(1);
  });
});
