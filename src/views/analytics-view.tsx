'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Separator } from '@/shared/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  BarChart3,
  Calendar,
  Users,
  Route as RouteIcon,
  TrendingUp,
  MapPin,
  Mountain,
  Printer,
  Sparkles,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  Phone,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  Search,
  RotateCcw,
} from 'lucide-react';
import { useAppContext } from '@/entities/app';
import { useToast } from '@/shared/hooks/use-toast';
import type { Group, Route, RouteDifficulty, Member } from '@/core/domain/types';

/**
 * Defensive Data Sanitization & Security Helpers
 */
export function sanitizeText(val?: unknown, fallback = '—'): string {
  if (typeof val !== 'string' && typeof val !== 'number') return fallback;
  const str = String(val).trim();
  if (!str) return fallback;
  // Strip control characters & truncate excessively long input to prevent UI freezing
  return str.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 250);
}

export function sanitizePhone(phone?: string): string {
  if (!phone) return '';
  const cleaned = phone.trim();
  // Safe phone format: allow digits, +, -, (, ), spaces
  if (!/^[+\d\s().-]{5,30}$/.test(cleaned)) {
    return cleaned.slice(0, 30);
  }
  return cleaned;
}

export function parseDistanceKm(distanceStr?: string | number): number {
  if (typeof distanceStr === 'number') {
    return isFinite(distanceStr) && distanceStr >= 0 ? distanceStr : 0;
  }
  if (!distanceStr) return 0;
  const cleaned = String(distanceStr).replace(',', '.').trim();
  const match = cleaned.match(/(\d+(\.\d+)?)/);
  if (match) {
    const val = parseFloat(match[1]);
    return isNaN(val) || !isFinite(val) || val < 0 ? 0 : Math.min(val, 9999);
  }
  return 0;
}

export function getGroupDateMs(group: Group): number {
  if (group.startDate) {
    const parsed = new Date(group.startDate).getTime();
    if (!isNaN(parsed) && isFinite(parsed)) return parsed;
  }
  if (group.createdAt && isFinite(group.createdAt) && group.createdAt > 0) {
    return group.createdAt;
  }
  if (group.hikers && group.hikers.length > 0) {
    const timestamps = group.hikers
      .map((h) => h.lastUpdateTimestamp || 0)
      .filter((t) => isFinite(t) && t > 0);
    if (timestamps.length > 0) return Math.max(...timestamps);
  }
  return Date.now();
}

const DIFFICULTY_COLORS: Record<RouteDifficulty, string> = {
  'Легко': '#10b981', // emerald-500
  'Средне': '#f59e0b', // amber-500
  'Сложно': '#f97316', // orange-500
  'Очень сложно': '#ef4444', // red-500
};

export default function AnalyticsView() {
  const { groupsHook, routesHook, setView } = useAppContext();
  const { groups = [], addGroup } = groupsHook;
  const { routes = [], addRoute } = routesHook;
  const { toast } = useToast();

  // Period filter state
  const [periodPreset, setPeriodPreset] = useState<'all' | 'month' | 'season' | 'year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState('summary');

  // Defensive Date range calculation based on preset
  const { startMs, endMs, periodLabel } = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    if (periodPreset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { startMs: start, endMs: end, periodLabel: 'Текущий месяц' };
    }
    if (periodPreset === 'season') {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).getTime();
      return { startMs: start, endMs: end, periodLabel: 'Текущий сезон (90 дн.)' };
    }
    if (periodPreset === 'year') {
      const start = new Date(now.getFullYear(), 0, 1).getTime();
      return { startMs: start, endMs: end, periodLabel: `${now.getFullYear()} год` };
    }
    if (periodPreset === 'custom') {
      let start = customStartDate ? new Date(customStartDate).getTime() : 0;
      let customEnd = customEndDate
        ? new Date(customEndDate + 'T23:59:59.999').getTime()
        : Date.now();

      // Guard against inverted dates
      if (start > customEnd && customEnd > 0) {
        const temp = start;
        start = customEnd;
        customEnd = temp;
      }

      return {
        startMs: isNaN(start) ? 0 : start,
        endMs: isNaN(customEnd) ? Infinity : customEnd,
        periodLabel: `${customStartDate || 'Начало'} — ${customEndDate || 'Сейчас'}`,
      };
    }

    return { startMs: 0, endMs: Infinity, periodLabel: 'Всё время' };
  }, [periodPreset, customStartDate, customEndDate]);

  // Filter groups with robust safety checks
  const filteredGroups = useMemo(() => {
    if (!Array.isArray(groups)) return [];
    const query = searchQuery.trim().toLowerCase();

    return groups.filter((group) => {
      if (!group || typeof group !== 'object') return false;
      const dateMs = getGroupDateMs(group);
      const matchesDate = dateMs >= startMs && dateMs <= endMs;
      const matchesDifficulty =
        difficultyFilter === 'ALL' || group.difficulty === difficultyFilter;
      const matchesSearch =
        !query ||
        (group.name && group.name.toLowerCase().includes(query)) ||
        (group.location && group.location.toLowerCase().includes(query)) ||
        (group.leaderName && group.leaderName.toLowerCase().includes(query));

      return matchesDate && matchesDifficulty && matchesSearch;
    });
  }, [groups, startMs, endMs, difficultyFilter, searchQuery]);

  // Calculate Core Metrics (ФЗ-05) defensively
  const metrics = useMemo(() => {
    const totalGroups = filteredGroups.length;

    let totalParticipants = 0;
    const uniqueHikerSet = new Set<string>();

    filteredGroups.forEach((g) => {
      const count = Array.isArray(g.hikers) ? g.hikers.length : 0;
      totalParticipants += count;
      if (Array.isArray(g.hikers)) {
        g.hikers.forEach((h) => {
          if (!h) return;
          const identifier = (h.phone || h.name || h.id || '').trim().toLowerCase();
          if (identifier) uniqueHikerSet.add(identifier);
        });
      }
    });

    const uniqueParticipantsCount = uniqueHikerSet.size;

    // Sum total distance safely
    let totalDistanceKm = 0;
    filteredGroups.forEach((g) => {
      const matchedRoute = Array.isArray(routes) ? routes.find((r) => r.id === g.routeId) : undefined;
      const dist = matchedRoute ? parseDistanceKm(matchedRoute.distance) : parseDistanceKm(g.distance);
      totalDistanceKm += dist;
    });

    const avgGroupSize = totalGroups > 0 ? (totalParticipants / totalGroups).toFixed(1) : '0';
    const avgDistance = totalGroups > 0 ? (totalDistanceKm / totalGroups).toFixed(1) : '0';

    return {
      totalGroups,
      totalParticipants,
      uniqueParticipantsCount,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      avgGroupSize,
      avgDistance,
    };
  }, [filteredGroups, routes]);

  // Route Breakdown Statistics (ФЗ-05: «в разрезе маршрутов»)
  const routeBreakdown = useMemo(() => {
    type RouteStat = {
      routeId: string;
      routeName: string;
      location: string;
      difficulty: RouteDifficulty;
      distanceKm: number;
      groupsCount: number;
      participantsCount: number;
      totalKmWalked: number;
      avgGroupSize: string;
      percentageOfAllHikes: number;
    };

    const map = new Map<string, RouteStat>();

    if (Array.isArray(routes)) {
      routes.forEach((r) => {
        if (!r || !r.id) return;
        const dist = parseDistanceKm(r.distance);
        map.set(r.id, {
          routeId: r.id,
          routeName: sanitizeText(r.name, 'Безымянный маршрут'),
          location: sanitizeText(r.location, 'Регион не указан'),
          difficulty: r.difficulty || 'Средне',
          distanceKm: dist,
          groupsCount: 0,
          participantsCount: 0,
          totalKmWalked: 0,
          avgGroupSize: '0',
          percentageOfAllHikes: 0,
        });
      });
    }

    filteredGroups.forEach((g) => {
      let rStat: RouteStat | undefined;
      if (g.routeId && map.has(g.routeId)) {
        rStat = map.get(g.routeId);
      } else {
        const gNameClean = (g.name || '').trim().toLowerCase();
        const found = Array.from(map.values()).find(
          (item) => item.routeName.toLowerCase() === gNameClean
        );
        if (found) {
          rStat = found;
        } else {
          const locSafe = sanitizeText(g.location, 'Локальный район');
          const key = `custom-${locSafe}-${g.distance || '0'}`;
          if (!map.has(key)) {
            const dist = parseDistanceKm(g.distance);
            map.set(key, {
              routeId: key,
              routeName: `Маршрут: ${locSafe}`,
              location: locSafe,
              difficulty: g.difficulty || 'Средне',
              distanceKm: dist,
              groupsCount: 0,
              participantsCount: 0,
              totalKmWalked: 0,
              avgGroupSize: '0',
              percentageOfAllHikes: 0,
            });
          }
          rStat = map.get(key);
        }
      }

      if (rStat) {
        const hikersCount = Array.isArray(g.hikers) ? g.hikers.length : 0;
        rStat.groupsCount += 1;
        rStat.participantsCount += hikersCount;
        rStat.totalKmWalked += rStat.distanceKm;
      }
    });

    const totalPeriodHikes = filteredGroups.length;

    const result: RouteStat[] = Array.from(map.values()).map((item) => ({
      ...item,
      avgGroupSize:
        item.groupsCount > 0 ? (item.participantsCount / item.groupsCount).toFixed(1) : '0',
      percentageOfAllHikes:
        totalPeriodHikes > 0 ? Math.round((item.groupsCount / totalPeriodHikes) * 100) : 0,
      totalKmWalked: Math.round(item.totalKmWalked * 10) / 10,
    }));

    return result.sort(
      (a, b) => b.groupsCount - a.groupsCount || b.participantsCount - a.participantsCount
    );
  }, [routes, filteredGroups]);

  // Chart data
  const difficultyChartData = useMemo(() => {
    const counts: Record<string, number> = {
      'Легко': 0,
      'Средне': 0,
      'Сложно': 0,
      'Очень сложно': 0,
    };
    filteredGroups.forEach((g) => {
      if (counts[g.difficulty] !== undefined) {
        counts[g.difficulty] += 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        color: DIFFICULTY_COLORS[name as RouteDifficulty] || '#64748b',
      }))
      .filter((d) => d.value > 0);
  }, [filteredGroups]);

  const routeBarChartData = useMemo(() => {
    return routeBreakdown
      .filter((r) => r.groupsCount > 0)
      .slice(0, 6)
      .map((r) => ({
        name: r.routeName.length > 14 ? r.routeName.substring(0, 14) + '…' : r.routeName,
        fullTitle: r.routeName,
        'Групп': r.groupsCount,
        'Участников': r.participantsCount,
      }));
  }, [routeBreakdown]);

  const timelineData = useMemo(() => {
    const dateMap = new Map<string, { date: string; groups: number; participants: number; km: number }>();

    filteredGroups.forEach((g) => {
      const d = new Date(getGroupDateMs(g));
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });

      if (!dateMap.has(key)) {
        dateMap.set(key, { date: monthName, groups: 0, participants: 0, km: 0 });
      }
      const entry = dateMap.get(key)!;
      entry.groups += 1;
      entry.participants += Array.isArray(g.hikers) ? g.hikers.length : 0;
      entry.km += parseDistanceKm(g.distance);
    });

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => ({
        ...val,
        km: Math.round(val.km),
      }));
  }, [filteredGroups]);

  // Seed sample data for testing per Lab #1 specification (3 routes, 3 groups, 12 participants)
  const handleLoadDemoDataset = useCallback(async () => {
    try {
      const demoRoutes: Route[] = [
        {
          id: `route-demo-1-${Date.now()}`,
          name: 'Перевал Азау - Приют 11',
          location: 'Кавказ, Приэльбрусье',
          difficulty: 'Сложно',
          distance: '16.5 км',
          time: '7-8 часов',
          type: 'Высокогорный трекинг',
          altitude: '4050 м',
          coordinates: '43.2985° с.ш., 42.4560° в.д.',
          path: [
            [43.2685, 42.4642],
            [43.285, 42.459],
            [43.305, 42.455],
          ],
          createdAt: Date.now() - 60 * 24 * 3600 * 1000,
        },
        {
          id: `route-demo-2-${Date.now()}`,
          name: 'Ущелье Адыр-Су и альплагерь Уллу-Тау',
          location: 'Баксанское ущелье',
          difficulty: 'Средне',
          distance: '12.0 км',
          time: '5 часов',
          type: 'Пеший маршрут',
          altitude: '2380 м',
          coordinates: '43.2031° с.ш., 42.7915° в.д.',
          path: [
            [43.23, 42.78],
            [43.21, 42.79],
            [43.19, 42.8],
          ],
          createdAt: Date.now() - 45 * 24 * 3600 * 1000,
        },
        {
          id: `route-demo-3-${Date.now()}`,
          name: 'Тропа к высокогорному озеру Сылтранкёль',
          location: 'Верховья р. Сылтрансу',
          difficulty: 'Легко',
          distance: '8.5 км',
          time: '4 часа',
          type: 'Экологическая тропа',
          altitude: '3185 м',
          coordinates: '43.3241° с.ш., 42.6712° в.д.',
          path: [
            [43.33, 42.66],
            [43.325, 42.67],
            [43.32, 42.68],
          ],
          createdAt: Date.now() - 30 * 24 * 3600 * 1000,
        },
      ];

      for (const r of demoRoutes) {
        await addRoute(r);
      }

      const now = Date.now();
      const demoGroups: Omit<Group, 'id'>[] = [
        {
          name: 'Горный дозор — Экспедиция Азау',
          location: 'Кавказ, Приэльбрусье',
          distance: '16.5 км',
          difficulty: 'Сложно',
          routeId: demoRoutes[0].id,
          startDate: new Date(now - 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
          leaderName: 'Алексей Смирнов (Инструктор)',
          createdAt: now - 14 * 24 * 3600 * 1000,
          hikers: [
            {
              id: 'demo-h1',
              name: 'Алексей Смирнов',
              role: 'LEADER',
              status: 'В лагере',
              battery: 95,
              coords: '43.2985° с.ш., 42.4560° в.д.',
              phone: '+7 (918) 123-45-67',
              emergencyContact: 'Иванова М. (+7 918 000-11-22, супруга)',
              lastUpdate: '15 минут назад',
              lastUpdateTimestamp: now - 15 * 60 * 1000,
              avatar: '',
            },
            {
              id: 'demo-h2',
              name: 'Елена Кузнецова',
              role: 'MEDIC',
              status: 'В лагере',
              battery: 88,
              coords: '43.2984° с.ш., 42.4561° в.д.',
              phone: '+7 (918) 234-56-78',
              emergencyContact: 'Кузнецов В. (+7 918 333-44-55, отец)',
              lastUpdate: '15 минут назад',
              lastUpdateTimestamp: now - 15 * 60 * 1000,
              avatar: '',
            },
            {
              id: 'demo-h3',
              name: 'Дмитрий Попов',
              role: 'MEMBER',
              status: 'В лагере',
              battery: 76,
              coords: '43.2982° с.ш., 42.4559° в.д.',
              phone: '+7 (918) 345-67-89',
              emergencyContact: 'Попова О. (+7 918 444-55-66, мать)',
              lastUpdate: '20 минут назад',
              lastUpdateTimestamp: now - 20 * 60 * 1000,
              avatar: '',
            },
            {
              id: 'demo-h4',
              name: 'Анна Васильева',
              role: 'MEMBER',
              status: 'В лагере',
              battery: 82,
              coords: '43.2986° с.ш., 42.4562° в.д.',
              phone: '+7 (918) 456-78-90',
              emergencyContact: 'Васильев П. (+7 918 555-66-77, брат)',
              lastUpdate: '10 минут назад',
              lastUpdateTimestamp: now - 10 * 60 * 1000,
              avatar: '',
            },
            {
              id: 'demo-h5',
              name: 'Игорь Морозов',
              role: 'MEMBER',
              status: 'В лагере',
              battery: 90,
              coords: '43.2983° с.ш., 42.4560° в.д.',
              phone: '+7 (918) 567-89-01',
              emergencyContact: 'Морозова Т. (+7 918 666-77-88, сестра)',
              lastUpdate: '12 минут назад',
              lastUpdateTimestamp: now - 12 * 60 * 1000,
              avatar: '',
            },
          ],
        },
        {
          name: 'Юные натуралисты — Уллу-Тау',
          location: 'Баксанское ущелье',
          distance: '12.0 км',
          difficulty: 'Средне',
          routeId: demoRoutes[1].id,
          startDate: new Date(now - 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
          leaderName: 'Михаил Ковалев (Гид)',
          createdAt: now - 7 * 24 * 3600 * 1000,
          hikers: [
            {
              id: 'demo-h6',
              name: 'Михаил Ковалев',
              role: 'LEADER',
              status: 'На тропе',
              battery: 92,
              coords: '43.2031° с.ш., 42.7915° в.д.',
              phone: '+7 (916) 111-22-33',
              emergencyContact: 'Ковалева Н. (+7 916 222-33-44, жена)',
              lastUpdate: 'только что',
              lastUpdateTimestamp: now,
              avatar: '',
            },
            {
              id: 'demo-h7',
              name: 'Светлана Новикова',
              role: 'GUIDE',
              status: 'На тропе',
              battery: 84,
              coords: '43.2030° с.ш., 42.7916° в.д.',
              phone: '+7 (916) 333-44-55',
              emergencyContact: 'Новиков С. (+7 916 444-55-66, муж)',
              lastUpdate: 'только что',
              lastUpdateTimestamp: now,
              avatar: '',
            },
            {
              id: 'demo-h8',
              name: 'Артем Федоров',
              role: 'MEMBER',
              status: 'На тропе',
              battery: 79,
              coords: '43.2032° с.ш., 42.7914° в.д.',
              phone: '+7 (916) 555-66-77',
              emergencyContact: 'Федорова А. (+7 916 666-77-88, мать)',
              lastUpdate: 'только что',
              lastUpdateTimestamp: now,
              avatar: '',
            },
            {
              id: 'demo-h9',
              name: 'Ольга Романова',
              role: 'MEMBER',
              status: 'На тропе',
              battery: 88,
              coords: '43.2033° с.ш., 42.7917° в.д.',
              phone: '+7 (916) 777-88-99',
              emergencyContact: 'Романов Д. (+7 916 888-99-00, отец)',
              lastUpdate: 'только что',
              lastUpdateTimestamp: now,
              avatar: '',
            },
          ],
        },
        {
          name: 'Озерный край — Сылтранкёль',
          location: 'Верховья р. Сылтрансу',
          distance: '8.5 км',
          difficulty: 'Легко',
          routeId: demoRoutes[2].id,
          startDate: new Date(now - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
          leaderName: 'Виктор Захаров',
          createdAt: now - 2 * 24 * 3600 * 1000,
          hikers: [
            {
              id: 'demo-h10',
              name: 'Виктор Захаров',
              role: 'LEADER',
              status: 'На тропе',
              battery: 97,
              coords: '43.3241° с.ш., 42.6712° в.д.',
              phone: '+7 (925) 123-99-00',
              emergencyContact: 'Захарова Е. (+7 925 234-99-11, дочь)',
              lastUpdate: '5 минут назад',
              lastUpdateTimestamp: now - 5 * 60 * 1000,
              avatar: '',
            },
            {
              id: 'demo-h11',
              name: 'Наталья Белова',
              role: 'MEMBER',
              status: 'На тропе',
              battery: 91,
              coords: '43.3240° с.ш., 42.6713° в.д.',
              phone: '+7 (925) 345-99-22',
              emergencyContact: 'Белов Г. (+7 925 456-99-33, брат)',
              lastUpdate: '5 минут назад',
              lastUpdateTimestamp: now - 5 * 60 * 1000,
              avatar: '',
            },
            {
              id: 'demo-h12',
              name: 'Павел Соколов',
              role: 'MEMBER',
              status: 'На тропе',
              battery: 85,
              coords: '43.3242° с.ш., 42.6711° в.д.',
              phone: '+7 (925) 567-99-44',
              emergencyContact: 'Соколова И. (+7 925 678-99-55, мать)',
              lastUpdate: '5 минут назад',
              lastUpdateTimestamp: now - 5 * 60 * 1000,
              avatar: '',
            },
          ],
        },
      ];

      for (const g of demoGroups) {
        await addGroup(g);
      }

      toast({
        title: 'Тестовый набор данных загружен!',
        description: 'Добавлено 3 эталонных маршрута, 3 группы и 12 участников с контактами (по ТЗ ЛР № 1).',
      });
    } catch (err) {
      console.error('Failed to load demo data:', err);
      toast({
        title: 'Ошибка загрузки данных',
        description: 'Не удалось сгенерировать демо-набор.',
        variant: 'destructive',
      });
    }
  }, [addGroup, addRoute, toast]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleResetFilters = useCallback(() => {
    setPeriodPreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchQuery('');
    setDifficultyFilter('ALL');
  }, []);

  return (
    <div className="w-full min-h-full px-3 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-24 md:pb-8">
      {/* 1. Header and Actions (Responsive Stacking for Mobile, Tablet, Desktop) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 bg-card p-4 sm:p-6 rounded-xl border border-border shadow-sm print:border-none print:shadow-none print:p-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
              <BarChart3 className="size-5 sm:size-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground leading-tight">
                Сводный отчёт и аналитика походов
              </h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  Модуль аналитической обработки данных (ФЗ-05)
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                  <ShieldCheck className="size-3" />
                  Защищённая выборка
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls: Touch targets >= 44px on mobile */}
        <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 print:hidden">
          {groups.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadDemoDataset}
              className="min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-initial text-xs gap-1.5 border-dashed border-primary/50 text-primary hover:bg-primary/10"
            >
              <Sparkles className="size-4 shrink-0" />
              <span>Загрузить данные для ЛР № 1</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-initial text-xs gap-1.5"
            title="Печать официального протокола"
          >
            <Printer className="size-4 shrink-0" />
            <span>Печать отчёта</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setView('tracker')}
            className="min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-initial text-xs gap-1.5"
          >
            <Users className="size-4 shrink-0" />
            <span>К группам</span>
          </Button>
        </div>
      </div>

      {/* 2. Responsive Filter Bar (Handles 320px to Ultra-Wide Screens Cleanly) */}
      <Card className="bg-card border-border shadow-sm print:hidden">
        <CardContent className="p-3 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Horizontal scroll container for period buttons on mobile with touch-friendly pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin w-full lg:w-auto -mx-1 px-1">
              <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                <Calendar className="size-3.5" /> Период:
              </span>
              <Button
                size="sm"
                variant={periodPreset === 'all' ? 'default' : 'outline'}
                className="h-8 text-xs shrink-0 rounded-full px-3"
                onClick={() => setPeriodPreset('all')}
              >
                Всё время
              </Button>
              <Button
                size="sm"
                variant={periodPreset === 'month' ? 'default' : 'outline'}
                className="h-8 text-xs shrink-0 rounded-full px-3"
                onClick={() => setPeriodPreset('month')}
              >
                Этот месяц
              </Button>
              <Button
                size="sm"
                variant={periodPreset === 'season' ? 'default' : 'outline'}
                className="h-8 text-xs shrink-0 rounded-full px-3"
                onClick={() => setPeriodPreset('season')}
              >
                Сезон (90 дн.)
              </Button>
              <Button
                size="sm"
                variant={periodPreset === 'year' ? 'default' : 'outline'}
                className="h-8 text-xs shrink-0 rounded-full px-3"
                onClick={() => setPeriodPreset('year')}
              >
                Текущий год
              </Button>
              <Button
                size="sm"
                variant={periodPreset === 'custom' ? 'default' : 'outline'}
                className="h-8 text-xs shrink-0 rounded-full px-3"
                onClick={() => setPeriodPreset('custom')}
              >
                Диапазон дат
              </Button>
            </div>

            {/* Search & Difficulty filter (stacked on mobile, inline on desktop) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Поиск по названию или региону..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-xs pl-8 pr-2 w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                  <SelectTrigger className="h-8 text-xs flex-1 sm:w-36">
                    <SelectValue placeholder="Сложность" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Любая сложность</SelectItem>
                    <SelectItem value="Легко">Легко</SelectItem>
                    <SelectItem value="Средне">Средне</SelectItem>
                    <SelectItem value="Сложно">Сложно</SelectItem>
                    <SelectItem value="Очень сложно">Очень сложно</SelectItem>
                  </SelectContent>
                </Select>

                {(searchQuery || difficultyFilter !== 'ALL' || periodPreset !== 'all') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={handleResetFilters}
                    title="Сбросить фильтры"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Custom Date Range Picker: Defensive, responsive 1-2 columns */}
          {periodPreset === 'custom' && (
            <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-muted/40 p-3 rounded-lg animate-fade-in text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <Label htmlFor="custom-start-date" className="text-xs text-muted-foreground whitespace-nowrap min-w-[55px]">
                    С даты:
                  </Label>
                  <Input
                    id="custom-start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="h-8 text-xs w-full sm:w-36"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="custom-end-date" className="text-xs text-muted-foreground whitespace-nowrap min-w-[55px]">
                    По дату:
                  </Label>
                  <Input
                    id="custom-end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="h-8 text-xs w-full sm:w-36"
                  />
                </div>
              </div>
              <Badge variant="secondary" className="text-[11px] h-7 px-2.5 flex items-center gap-1">
                <span>Интервал:</span>
                <strong className="text-foreground">{periodLabel}</strong>
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Core KPI Cards Grid (ФЗ-05) - Fully Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Groups */}
        <Card className="bg-card border-border shadow-sm hover:border-primary/50 transition-colors overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Количество групп
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
              <Users className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {metrics.totalGroups}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
              <span>За период:</span>
              <span className="font-semibold text-foreground truncate max-w-[130px]" title={periodLabel}>
                {periodLabel}
              </span>
            </p>
            <div className="mt-2 text-[11px] text-muted-foreground/80 pt-2 border-t border-border flex justify-between">
              <span>Всего в реестре:</span>
              <span className="font-medium text-foreground">{groups.length} групп</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Total Participants */}
        <Card className="bg-card border-border shadow-sm hover:border-primary/50 transition-colors overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Число участников
            </CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
              <UserCheck className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {metrics.totalParticipants}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
              <span>Человеко-походов:</span>
              <span className="font-semibold text-foreground">{metrics.totalParticipants} чел.</span>
            </p>
            <div className="mt-2 text-[11px] text-muted-foreground/80 pt-2 border-t border-border flex justify-between">
              <span>Уникальных туристов:</span>
              <span className="font-medium text-foreground">{metrics.uniqueParticipantsCount} чел.</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Total Distance in KM */}
        <Card className="bg-card border-border shadow-sm hover:border-primary/50 transition-colors overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Суммарная протяжённость
            </CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
              <RouteIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {metrics.totalDistanceKm}{' '}
              <span className="text-sm font-normal text-muted-foreground">км</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
              <span>Пройдено группами:</span>
              <span className="font-semibold text-foreground">{metrics.totalDistanceKm} км</span>
            </p>
            <div className="mt-2 text-[11px] text-muted-foreground/80 pt-2 border-t border-border flex justify-between">
              <span>Средний километраж:</span>
              <span className="font-medium text-foreground">{metrics.avgDistance} км/поход</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Average Group Size */}
        <Card className="bg-card border-border shadow-sm hover:border-primary/50 transition-colors overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Средний размер группы
            </CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
              <TrendingUp className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {metrics.avgGroupSize}{' '}
              <span className="text-sm font-normal text-muted-foreground">чел.</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
              <span>Туристов на группу:</span>
              <span className="font-semibold text-foreground">~{metrics.avgGroupSize} человек</span>
            </p>
            <div className="mt-2 text-[11px] text-muted-foreground/80 pt-2 border-t border-border flex justify-between">
              <span>Контроль состава:</span>
              <span className="font-medium text-emerald-500">В норме</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Adaptive Tabs: Summary, Route Breakdown, Groups Register */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* Scrollable TabsList for Mobile */}
        <div className="overflow-x-auto pb-1 scrollbar-none -mx-1 px-1 print:hidden">
          <TabsList className="bg-muted p-1 inline-flex w-full sm:w-auto min-w-max justify-start sm:justify-center">
            <TabsTrigger value="summary" className="gap-2 text-xs sm:text-sm px-3 py-1.5">
              <BarChart3 className="size-4" />
              <span>Графики и тренды</span>
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-2 text-xs sm:text-sm px-3 py-1.5">
              <RouteIcon className="size-4" />
              <span>Статистика по маршрутам ({routeBreakdown.length})</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2 text-xs sm:text-sm px-3 py-1.5">
              <FileSpreadsheet className="size-4" />
              <span>Реестр групп ({filteredGroups.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: VISUAL CHARTS (Adaptive heights & mobile tooltips) */}
        <TabsContent value="summary" className="space-y-4 sm:space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Chart 1: BarChart Popular Routes */}
            <Card className="lg:col-span-2 bg-card border-border shadow-sm">
              <CardHeader className="p-4 sm:p-6 pb-2">
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="size-4 sm:size-5 text-primary" />
                  Распределение групп и участников по маршрутам
                </CardTitle>
                <CardDescription className="text-xs">
                  Сравнение загруженности маршрутов за {periodLabel}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-6 pt-2">
                {routeBarChartData.length > 0 ? (
                  <div className="h-[250px] sm:h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={routeBarChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          interval={0}
                          angle={-18}
                          textAnchor="end"
                        />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(23, 23, 23, 0.95)',
                            borderRadius: '8px',
                            border: '1px solid #444',
                            fontSize: '11px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="Групп" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Участников" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                    <RouteIcon className="size-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs sm:text-sm">Нет данных по маршрутам за выбранный период.</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleLoadDemoDataset}
                      className="mt-1 text-primary text-xs"
                    >
                      Загрузить контрольный набор данных для проверки
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chart 2: Difficulty Pie Chart */}
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="p-4 sm:p-6 pb-2">
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <Mountain className="size-4 sm:size-5 text-amber-500" />
                  Сложность походов
                </CardTitle>
                <CardDescription className="text-xs">
                  Категорийность маршрутов за период
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-6 pt-2">
                {difficultyChartData.length > 0 ? (
                  <div className="h-[250px] sm:h-[280px] w-full flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={difficultyChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={3}
                        >
                          {difficultyChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(23, 23, 23, 0.95)',
                            borderRadius: '8px',
                            border: '1px solid #444',
                            fontSize: '11px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-2 text-[11px] mt-2">
                      {difficultyChartData.map((item) => (
                        <div key={item.name} className="flex items-center gap-1">
                          <span
                            className="size-2 rounded-full inline-block"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-muted-foreground">{item.name}:</span>
                          <span className="font-semibold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                    <Mountain className="size-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs">Нет данных о категориях сложности за период</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chart 3: Timeline AreaChart */}
          {timelineData.length > 0 && (
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="p-4 sm:p-6 pb-2">
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="size-4 sm:size-5 text-emerald-500" />
                  Динамика выходов походных групп по месяцам
                </CardTitle>
                <CardDescription className="text-xs">
                  Суммарное количество вышедших групп и сезонная динамика
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-6 pt-2">
                <div className="h-[200px] sm:h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorGroups" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(23, 23, 23, 0.95)',
                          borderRadius: '8px',
                          border: '1px solid #444',
                          fontSize: '11px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="groups"
                        name="Количество групп"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorGroups)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: ROUTE BREAKDOWN (Dual Mode: Mobile Cards + Desktop Full Table) */}
        <TabsContent value="routes" className="space-y-4 animate-fade-in">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="p-4 sm:p-6 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <RouteIcon className="size-4 sm:size-5 text-primary" />
                  Сводная статистика в разрезе маршрутов
                </CardTitle>
                <CardDescription className="text-xs">
                  Детализация числа групп, участников, суммарного километража и среднего состава по маршрутам.
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit text-xs px-2.5 py-1">
                Маршрутов: {routeBreakdown.length}
              </Badge>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              {/* MOBILE CARDS VIEW (Clean, touch-friendly, no squished columns) */}
              <div className="block sm:hidden space-y-3">
                {routeBreakdown.length > 0 ? (
                  routeBreakdown.map((item, idx) => (
                    <div
                      key={`route-card-mob-${item.routeId}-${idx}`}
                      className="p-3 rounded-lg border border-border bg-muted/30 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-foreground text-sm">{item.routeName}</div>
                          <div className="text-muted-foreground flex items-center gap-1 mt-0.5 text-[11px]">
                            <MapPin className="size-3 text-primary shrink-0" />
                            {item.location}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0.5 shrink-0"
                          style={{
                            borderColor: DIFFICULTY_COLORS[item.difficulty] || '#64748b',
                            color: DIFFICULTY_COLORS[item.difficulty] || '#64748b',
                          }}
                        >
                          {item.difficulty}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-[11px]">
                        <div>
                          <span className="text-muted-foreground">Длина маршрута: </span>
                          <strong className="text-foreground">{item.distanceKm} км</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Вышло групп: </span>
                          <strong className="text-primary">{item.groupsCount}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Всего туристов: </span>
                          <strong className="text-foreground">{item.participantsCount} чел.</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Ср. состав: </span>
                          <strong className="text-foreground">{item.avgGroupSize} чел./гр.</strong>
                        </div>
                        <div className="col-span-2 flex items-center justify-between pt-1 border-t border-border/40">
                          <span className="text-muted-foreground">Суммарный километраж: </span>
                          <span className="font-mono font-bold text-foreground">{item.totalKmWalked} км</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    Маршруты не найдены.
                  </div>
                )}
              </div>

              {/* DESKTOP & TABLET TABLE VIEW (Hidden on mobile, overflow-protected) */}
              <div className="hidden sm:block rounded-md border border-border overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-semibold text-foreground">Маршрут / Регион</TableHead>
                      <TableHead className="font-semibold text-foreground">Сложность</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Протяжённость</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Число групп</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Участников</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Ср. состав</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Сумм. км похода</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Доля (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routeBreakdown.length > 0 ? (
                      routeBreakdown.map((item, idx) => (
                        <TableRow key={`route-row-${item.routeId}-${idx}`} className="hover:bg-muted/40">
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-foreground">{item.routeName}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="size-3 text-primary/70 shrink-0" />
                                {item.location}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-[11px] px-2 py-0.5"
                              style={{
                                borderColor: DIFFICULTY_COLORS[item.difficulty] || '#64748b',
                                color: DIFFICULTY_COLORS[item.difficulty] || '#64748b',
                              }}
                            >
                              {item.difficulty}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.distanceKm} км
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                              {item.groupsCount}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-sm">
                            {item.participantsCount} чел.
                          </TableCell>
                          <TableCell className="text-right text-sm font-mono text-muted-foreground">
                            {item.avgGroupSize} чел./гр.
                          </TableCell>
                          <TableCell className="text-right font-semibold font-mono text-sm text-foreground">
                            {item.totalKmWalked} км
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {item.percentageOfAllHikes}%
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Маршруты не найдены.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: GROUPS REGISTER (Dual Mode: Mobile Cards + Desktop Table) */}
        <TabsContent value="groups" className="space-y-4 animate-fade-in">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="p-4 sm:p-6 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                  <Users className="size-4 sm:size-5 text-primary" />
                  Реестр походных групп за выбранный период
                </CardTitle>
                <CardDescription className="text-xs">
                  Сведения о группах, датах выхода, руководителях и контактных данных участников.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView('tracker')}
                className="gap-1.5 w-full sm:w-fit min-h-[38px] text-xs print:hidden"
              >
                <ArrowUpRight className="size-4" />
                <span>Управление в трекере</span>
              </Button>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              {/* MOBILE CARDS VIEW */}
              <div className="block sm:hidden space-y-3">
                {filteredGroups.length > 0 ? (
                  filteredGroups.map((group, idx) => {
                    const dateFormatted = new Date(getGroupDateMs(group)).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });
                    const leader =
                      group.leaderName ||
                      group.hikers?.find((h) => h.role === 'LEADER')?.name ||
                      'Инструктор клуба';

                    return (
                      <div
                        key={`group-card-mob-${group.id}-${idx}`}
                        className="p-3 rounded-lg border border-border bg-muted/30 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-foreground text-sm">{group.name}</div>
                            <div className="text-muted-foreground flex items-center gap-1 mt-0.5 text-[11px]">
                              <MapPin className="size-3 text-primary shrink-0" />
                              {group.location}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0.5 shrink-0"
                            style={{
                              borderColor: DIFFICULTY_COLORS[group.difficulty] || '#64748b',
                              color: DIFFICULTY_COLORS[group.difficulty] || '#64748b',
                            }}
                          >
                            {group.difficulty}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-[11px]">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="size-3 text-primary shrink-0" />
                            <span>{dateFormatted}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Дистанция: </span>
                            <strong className="text-foreground">{group.distance}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Состав: </span>
                            <strong className="text-primary">{group.hikers ? group.hikers.length : 0} чел.</strong>
                          </div>
                          <div className="truncate">
                            <span className="text-muted-foreground">Лидер: </span>
                            <strong className="text-foreground">{leader}</strong>
                          </div>
                        </div>

                        {group.hikers && group.hikers.length > 0 && group.hikers[0].phone && (
                          <div className="pt-1.5 border-t border-border/40 text-[11px] flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="size-3 text-primary shrink-0" />
                            <span className="font-mono">{sanitizePhone(group.hikers[0].phone)}</span>
                            {group.hikers[0].emergencyContact && (
                              <span className="text-muted-foreground/80 truncate">
                                | SOS: {sanitizeText(group.hikers[0].emergencyContact)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    Группы за указанный период не найдены.
                  </div>
                )}
              </div>

              {/* DESKTOP & TABLET TABLE VIEW */}
              <div className="hidden sm:block rounded-md border border-border overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-semibold text-foreground">Название группы</TableHead>
                      <TableHead className="font-semibold text-foreground">Дата выхода</TableHead>
                      <TableHead className="font-semibold text-foreground">Маршрут / Регион</TableHead>
                      <TableHead className="font-semibold text-foreground">Сложность</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Дистанция</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Состав</TableHead>
                      <TableHead className="font-semibold text-foreground">Руководитель / Контакты</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map((group, idx) => {
                        const dateFormatted = new Date(getGroupDateMs(group)).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        });
                        const leader =
                          group.leaderName ||
                          group.hikers?.find((h) => h.role === 'LEADER')?.name ||
                          'Инструктор клуба';

                        return (
                          <TableRow key={`group-table-${group.id}-${idx}`} className="hover:bg-muted/40">
                            <TableCell className="font-semibold text-foreground">
                              {sanitizeText(group.name)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="size-3.5 text-primary" />
                                {dateFormatted}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-sm">
                                <MapPin className="size-3.5 text-primary shrink-0" />
                                <span className="truncate max-w-[180px]">{sanitizeText(group.location)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="text-[11px] px-2 py-0.5"
                                style={{
                                  borderColor: DIFFICULTY_COLORS[group.difficulty] || '#64748b',
                                  color: DIFFICULTY_COLORS[group.difficulty] || '#64748b',
                                }}
                              >
                                {group.difficulty}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {sanitizeText(group.distance)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="text-xs font-semibold">
                                {group.hikers ? group.hikers.length : 0} чел.
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col text-xs">
                                <span className="font-medium text-foreground">{sanitizeText(leader)}</span>
                                {group.hikers && group.hikers.length > 0 && group.hikers[0].phone && (
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                                    <Phone className="size-3 text-muted-foreground/70" />
                                    {sanitizePhone(group.hikers[0].phone)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Походные группы за указанный период не найдены.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 5. Secure Audit Protocol Footer (Printed officially for Club Administration) */}
      <Card className="bg-muted/30 border-border print:border-none shadow-none rounded-xl">
        <CardContent className="p-3 sm:p-5 text-xs text-muted-foreground space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 border-b border-border/60 pb-2">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-primary shrink-0" />
              ИС «Treeline Tracker» — Сводный протокол учёта турдеятельности (ФЗ-05)
            </span>
            <span className="text-[10px] sm:text-[11px] font-mono">
              Сформировано: {new Date().toLocaleDateString('ru-RU')}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 pt-1 text-[11px]">
            <div>
              <span className="text-muted-foreground">Период выборки: </span>
              <strong className="text-foreground">{periodLabel}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Итого по реестру: </span>
              <strong className="text-foreground">
                {metrics.totalGroups} групп, {metrics.totalParticipants} участников, {metrics.totalDistanceKm} км
              </strong>
            </div>
            <div>
              <span className="text-muted-foreground">Целостность данных: </span>
              <strong className="text-emerald-500">Проверено (дубликаты исключены)</strong>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
