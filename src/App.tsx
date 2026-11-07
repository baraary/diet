import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppState,
  ColorKey,
  DayLog,
  DesignStyle,
  HealthyRecipe,
  MealCategory,
  MealItem,
  OfflineQueueItem,
  RoutineItem,
  UserProfile,
} from './types';
import {
  COLOR_PALETTES,
  addDaysStr,
  createEmptyProfile,
  formatJalaliFull,
  getSmartDefaultMealCat,
  getTodayStr,
} from './data/recipesAndRoutines';
import { usePWAInstall, useOnlineStatus } from './hooks/usePWAInstall';
import {
  playSoftTap,
  playSuccessChime,
} from './utils/feedback';
import { DashboardTab } from './components/DashboardTab';
import { KitchenTab } from './components/KitchenTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { ProfileTab } from './components/ProfileTab';
import {
  MealEditModal,
  ExerciseModal,
  WhatToEatModal,
  OnboardingModal,
  PWAGuideModal,
  ShareDailyCardModal,
} from './components/Modals';
import {
  LayoutDashboard,
  ChefHat,
  BarChart3,
  UserCheck,
  Sun,
  Moon,
  Download,
  ChevronRight,
  ChevronLeft,
  Flame,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react';

const STORAGE_KEY = 'hootan_fatemeh_nutrition_v3';

type ActiveTab = 'dashboard' | 'kitchen' | 'analytics' | 'profile';

// Safe client-side merge that strictly respects deletedIds tombstones and waterUpdatedAt
function mergeProfilesSafeClient(
  localProfiles: Record<string, UserProfile>,
  serverProfiles: Record<string, UserProfile>
): Record<string, UserProfile> {
  const result: Record<string, UserProfile> = { ...localProfiles };

  for (const profKey of Object.keys(serverProfiles)) {
    const locProf = result[profKey];
    const srvProf = serverProfiles[profKey];
    if (!locProf) {
      result[profKey] = srvProf;
      continue;
    }

    const mergedDays: Record<string, DayLog> = { ...(locProf.days || {}) };
    const srvDays = srvProf.days || {};

    for (const dateKey of Object.keys(srvDays)) {
      const lDay = mergedDays[dateKey] || { water: 0, meals: [], exercises: [], deletedIds: [] };
      const sDay = srvDays[dateKey] || { water: 0, meals: [], exercises: [], deletedIds: [] };

      const deletedSet = new Set<string>([
        ...(Array.isArray(lDay.deletedIds) ? lDay.deletedIds : []),
        ...(Array.isArray(sDay.deletedIds) ? sDay.deletedIds : []),
      ]);

      const mealMap = new Map<string, MealItem>();
      for (const m of sDay.meals || []) {
        if (m && m.id && !deletedSet.has(m.id) && !m._deleted) {
          mealMap.set(m.id, m);
        }
      }
      for (const m of lDay.meals || []) {
        if (m && m.id && !deletedSet.has(m.id) && !m._deleted) {
          const prev = mealMap.get(m.id);
          if (!prev || (m.updatedAt || 0) >= (prev.updatedAt || 0)) {
            mealMap.set(m.id, m);
          }
        }
      }

      const exMap = new Map<string, any>();
      for (const e of sDay.exercises || []) {
        if (e && e.id && !deletedSet.has(e.id) && !e._deleted) {
          exMap.set(e.id, e);
        }
      }
      for (const e of lDay.exercises || []) {
        if (e && e.id && !deletedSet.has(e.id) && !e._deleted) {
          exMap.set(e.id, e);
        }
      }

      const lWaterTime = Number(lDay.waterUpdatedAt || 0);
      const sWaterTime = Number(sDay.waterUpdatedAt || 0);
      const mergedWater =
        lWaterTime >= sWaterTime ? Number(lDay.water ?? 0) : Number(sDay.water ?? 0);

      mergedDays[dateKey] = {
        water: mergedWater,
        waterUpdatedAt: Math.max(lWaterTime, sWaterTime),
        meals: Array.from(mealMap.values()),
        exercises: Array.from(exMap.values()),
        deletedIds: Array.from(deletedSet),
      };
    }

    result[profKey] = {
      ...srvProf,
      ...locProf,
      days: mergedDays,
    };
  }

  return result;
}

function getInitialState(): AppState {
  const today = getTodayStr();
  const defaultState: AppState = {
    activeProfile: 'hootan',
    lockedProfile: null,
    currentDate: today,
    darkMode: false,
    soundEnabled: true,
    designStyle: 'glass',
    config: {
      githubToken: '',
      gistId: '',
    },
    offlineQueue: [],
    profiles: {
      hootan: createEmptyProfile('هوتن', 'male', {
        avatar: '👨🏻',
        color: 'indigo',
        partnerId: 'fatemeh',
      }),
      fatemeh: createEmptyProfile('فاطمه', 'female', {
        avatar: '👩🏻',
        color: 'rose',
        partnerId: 'hootan',
      }),
    },
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.profiles) {
        const mergedProfiles: Record<string, UserProfile> = {};
        for (const k of Object.keys(parsed.profiles)) {
          const p = parsed.profiles[k];
          const base = createEmptyProfile(p.name || k, p.gender || 'male', {
            avatar: p.avatar,
            color: p.color,
            partnerId: p.partnerId,
          });
          mergedProfiles[k] = {
            ...base,
            ...p,
            stats: { ...base.stats, ...(p.stats || {}) },
            targets: { ...base.targets, ...(p.targets || {}) },
            favoriteRecipeIds: Array.isArray(p.favoriteRecipeIds)
              ? p.favoriteRecipeIds
              : base.favoriteRecipeIds,
            customRecipes: Array.isArray(p.customRecipes) ? p.customRecipes : [],
            days: p.days || {},
          };
        }
        return {
          activeProfile: parsed.activeProfile || 'hootan',
          lockedProfile: parsed.lockedProfile || null,
          currentDate: today,
          darkMode: Boolean(parsed.darkMode),
          soundEnabled: parsed.soundEnabled !== undefined ? Boolean(parsed.soundEnabled) : true,
          designStyle: parsed.designStyle || 'glass',
          config: {
            githubToken: parsed.config?.githubToken || '',
            gistId: parsed.config?.gistId || '',
          },
          offlineQueue: Array.isArray(parsed.offlineQueue) ? parsed.offlineQueue : [],
          profiles: mergedProfiles,
        };
      }
    }
  } catch {
    // Fallback to default state
  }

  // Support legacy #magic=... hash or ?user=... query parameter on load
  if (typeof window !== 'undefined') {
    if (window.location.hash && window.location.hash.startsWith('#magic=')) {
      try {
        const b64 = window.location.hash.slice('#magic='.length).split('&')[0];
        let decoded: any;
        try {
          decoded = JSON.parse(decodeURIComponent(escape(atob(b64))));
        } catch {
          decoded = JSON.parse(atob(b64));
        }
        if (decoded) {
          if (decoded.githubToken) defaultState.config!.githubToken = decoded.githubToken;
          if (decoded.gistId) defaultState.config!.gistId = decoded.gistId;
          if (decoded.profile) {
            const pKey = decoded.profile;
            if (!defaultState.profiles[pKey]) {
              defaultState.profiles[pKey] = createEmptyProfile(
                decoded.profileName || pKey,
                decoded.gender || 'female',
                {
                  avatar: decoded.avatar || '👤',
                  color: decoded.color || 'rose',
                  partnerId: decoded.partnerId || '',
                }
              );
            }
            defaultState.activeProfile = pKey;
          }
        }
      } catch {
        // Ignore invalid magic hash
      }
    }

    const params = new URLSearchParams(window.location.search);
    const invitedUser = params.get('user');
    if (invitedUser) {
      const uKey = invitedUser.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (uKey && !defaultState.profiles[uKey]) {
        defaultState.profiles[uKey] = createEmptyProfile(
          params.get('name') || uKey,
          (params.get('gender') as 'male' | 'female') || 'female',
          {
            avatar: params.get('avatar') || '👤',
            color: (params.get('color') as ColorKey) || 'rose',
          }
        );
      }
      if (uKey && defaultState.profiles[uKey]) {
        defaultState.activeProfile = uKey;
      }
    }
  }

  return defaultState;
}

export default function App() {
  const [state, setState] = useState<AppState>(getInitialState);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedMealCat, setSelectedMealCat] = useState<MealCategory>(getSmartDefaultMealCat);
  const [lastAddedMealId, setLastAddedMealId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // Modals State
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [mealModalMode, setMealModalMode] = useState<'meal' | 'routine_only'>('meal');
  const [editingMeal, setEditingMeal] = useState<MealItem | null>(null);
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [pwaGuideOpen, setPwaGuideOpen] = useState(false);
  const [shareCardModalOpen, setShareCardModalOpen] = useState(false);

  // What To Eat AI State
  const [whatToEatOpen, setWhatToEatOpen] = useState(false);
  const [whatToEatLoading, setWhatToEatLoading] = useState(false);
  const [whatToEatData, setWhatToEatData] = useState<any>(null);

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const processingQueueRef = useRef(false);

  const activeProfile =
    state.profiles[state.activeProfile] || state.profiles[Object.keys(state.profiles)[0]];
  const pal = COLOR_PALETTES[activeProfile.color] || COLOR_PALETTES.indigo;
  const soundEnabled = state.soundEnabled !== false;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  // BUG FIX #1: Reset scroll position to top when switching between tabs
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Sync dark mode class on <html> and update meta theme-color
  useEffect(() => {
    const root = document.documentElement;
    if (state.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) {
      metaTheme.setAttribute('content', state.darkMode ? '#0f172a' : pal.hex);
    }
  }, [state.darkMode, pal.hex]);

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  // Server-side smart sync (with tombstone-aware merge so deleted meals NEVER reappear)
  const syncWithServer = useCallback(
    async (
      action: 'pull' | 'push',
      profilesToPush?: Record<string, UserProfile>,
      customToken?: string,
      customGistId?: string
    ) => {
      if (!navigator.onLine) return;
      setIsSyncing(true);
      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            profiles: profilesToPush || state.profiles,
            githubToken: customToken ?? state.config?.githubToken,
            gistId: customGistId ?? state.config?.gistId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profiles && Object.keys(data.profiles).length > 0) {
            setState((prev) => ({
              ...prev,
              profiles: mergeProfilesSafeClient(prev.profiles, data.profiles),
            }));
          }
        }
      } catch {
        // Silent background sync
      } finally {
        setIsSyncing(false);
      }
    },
    [state.profiles, state.config]
  );

  useEffect(() => {
    syncWithServer('pull');
  }, []);

  // Calculate active streak
  const calculateStreak = (prof: UserProfile): number => {
    let streak = 0;
    const today = getTodayStr();
    for (let i = 0; i < 365; i++) {
      const ds = addDaysStr(today, -i);
      const dayObj = prof.days?.[ds];
      if (dayObj && dayObj.meals && dayObj.meals.length > 0) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  };

  const streakCount = calculateStreak(activeProfile);

  // Handlers for updating active profile day data (with tombstone & waterUpdatedAt support)
  const updateProfileDay = (
    profKey: string,
    dateStr: string,
    updater: (day: DayLog) => DayLog
  ) => {
    setState((prev) => {
      const prof = prev.profiles[profKey];
      if (!prof) return prev;
      const existingDay = prof.days[dateStr] || {
        water: 0,
        waterUpdatedAt: 0,
        meals: [],
        exercises: [],
        deletedIds: [],
      };
      const updatedDay = updater({
        water: existingDay.water || 0,
        waterUpdatedAt: existingDay.waterUpdatedAt || 0,
        meals: [...(existingDay.meals || [])],
        exercises: [...(existingDay.exercises || [])],
        deletedIds: [...(existingDay.deletedIds || [])],
      });
      const nextProfiles = {
        ...prev.profiles,
        [profKey]: {
          ...prof,
          updatedAt: Date.now(),
          days: {
            ...prof.days,
            [dateStr]: updatedDay,
          },
        },
      };
      syncWithServer('push', nextProfiles);
      return { ...prev, profiles: nextProfiles };
    });
  };

  const handleChangeWater = (delta: number) => {
    updateProfileDay(state.activeProfile, state.currentDate, (day) => ({
      ...day,
      water: Math.max(0, (day.water || 0) + delta),
      waterUpdatedAt: Date.now(),
    }));
  };

  const handleLogMealForProfileDate = useCallback(
    (
      targetProfileKey: string,
      targetDateStr: string,
      meal: MealItem,
      saveToRoutine: boolean,
      sharedPartnerKey: string | null,
      sharedMultiplier: number
    ) => {
      setLastAddedMealId(meal.id);

      setState((prev) => {
        const prof = prev.profiles[targetProfileKey];
        if (!prof) return prev;
        const curDay = prof.days[targetDateStr] || {
          water: 0,
          meals: [],
          exercises: [],
          deletedIds: [],
        };

        const nextRoutines = saveToRoutine
          ? [
              {
                category: meal.category,
                title: meal.title,
                calories: meal.calories,
                protein: meal.protein,
                carbs: meal.carbs,
                fat: meal.fat,
                fiber: meal.fiber,
                sugar: meal.sugar,
                sodium: meal.sodium,
              },
              ...(prof.routines || []),
            ]
          : prof.routines;

        const nextProfiles: Record<string, UserProfile> = {
          ...prev.profiles,
          [targetProfileKey]: {
            ...prof,
            routines: nextRoutines,
            updatedAt: Date.now(),
            days: {
              ...prof.days,
              [targetDateStr]: {
                ...curDay,
                meals: [meal, ...(curDay.meals || [])],
              },
            },
          },
        };

        if (sharedPartnerKey && prev.profiles[sharedPartnerKey]) {
          const partnerProf = prev.profiles[sharedPartnerKey];
          const partnerDay = partnerProf.days[targetDateStr] || {
            water: 0,
            meals: [],
            exercises: [],
            deletedIds: [],
          };
          const partnerMeal: MealItem = {
            ...meal,
            id: 'm_' + (Date.now() + Math.floor(Math.random() * 1000)),
            title: `${meal.title} (مشترک با ${prof.name} - ${Math.round(sharedMultiplier * 100)}٪)`,
            calories: Math.round(meal.calories * sharedMultiplier),
            protein: Math.round(meal.protein * sharedMultiplier * 10) / 10,
            carbs: Math.round(meal.carbs * sharedMultiplier * 10) / 10,
            fat: Math.round(meal.fat * sharedMultiplier * 10) / 10,
            fiber: Math.round(meal.fiber * sharedMultiplier * 10) / 10,
            sugar: Math.round(meal.sugar * sharedMultiplier * 10) / 10,
            sodium: Math.round(meal.sodium * sharedMultiplier),
            updatedAt: Date.now(),
          };
          nextProfiles[sharedPartnerKey] = {
            ...partnerProf,
            updatedAt: Date.now(),
            days: {
              ...partnerProf.days,
              [targetDateStr]: {
                ...partnerDay,
                meals: [partnerMeal, ...(partnerDay.meals || [])],
              },
            },
          };
        }

        syncWithServer('push', nextProfiles);
        return { ...prev, profiles: nextProfiles };
      });
    },
    [syncWithServer]
  );

  const handleLogMealFromAI = (
    meal: MealItem,
    saveToRoutine: boolean,
    sharedPartnerKey: string | null,
    sharedMultiplier: number
  ) => {
    handleLogMealForProfileDate(
      state.activeProfile,
      state.currentDate,
      meal,
      saveToRoutine,
      sharedPartnerKey,
      sharedMultiplier
    );

    if (sharedPartnerKey && state.profiles[sharedPartnerKey]) {
      showToast(
        `✅ در «${meal.category}» ثبت شد و برای «${state.profiles[sharedPartnerKey].name}» هم ارسال گردید!`
      );
    } else {
      showToast(`✅ در «${meal.category}» ثبت شد! (${meal.calories} kcal)`);
    }
  };

  // Smart Offline AI Queue Enqueue & Automatic Background Processor
  const handleEnqueueOfflineMeal = (item: Omit<OfflineQueueItem, 'id' | 'createdAt'>) => {
    const newItem: OfflineQueueItem = {
      ...item,
      id: 'oq_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      createdAt: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      offlineQueue: [...(prev.offlineQueue || []), newItem],
    }));
    showToast('📥 اینترنت قطع است؛ وعده در «صف ارسال خودکار» ذخیره شد و به محض اتصال ثبت می‌شود.');
  };

  const handleRemoveQueueItem = (id: string) => {
    setState((prev) => ({
      ...prev,
      offlineQueue: (prev.offlineQueue || []).filter((q) => q.id !== id),
    }));
    showToast('از صف انتظار حذف شد');
  };

  const processOfflineQueue = useCallback(async () => {
    const queue = state.offlineQueue || [];
    if (queue.length === 0 || processingQueueRef.current || !navigator.onLine) return;

    processingQueueRef.current = true;
    setIsProcessingQueue(true);
    let processedCount = 0;
    const remainingQueue: OfflineQueueItem[] = [];

    for (const item of queue) {
      try {
        const res = await fetch('/api/gemini/analyze-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: item.text,
            imageBase64: item.photoBase64,
            mimeType: item.photoBase64 ? 'image/jpeg' : undefined,
            category: item.category,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'خطا');

        const newMeal: MealItem = {
          id: 'm_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          time: new Date(item.createdAt).toLocaleTimeString('fa-IR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          category: item.category,
          title: data.title || item.text || 'وعده تصویری',
          calories: Math.round(Number(data.calories) || 0),
          protein: Math.round((Number(data.protein) || 0) * 10) / 10,
          carbs: Math.round((Number(data.carbs) || 0) * 10) / 10,
          fat: Math.round((Number(data.fat) || 0) * 10) / 10,
          fiber: Math.round((Number(data.fiber) || 0) * 10) / 10,
          sugar: Math.round((Number(data.sugar) || 0) * 10) / 10,
          sodium: Math.round(Number(data.sodium) || 0),
          score: Number(data.score) || 8,
          tip: data.tip || '',
          updatedAt: Date.now(),
        };

        handleLogMealForProfileDate(
          item.profileKey,
          item.dateStr,
          newMeal,
          item.saveToRoutine,
          item.sharedPartnerKey,
          item.sharedMultiplier
        );
        processedCount++;
      } catch {
        remainingQueue.push(item);
      }
    }

    setState((prev) => ({
      ...prev,
      offlineQueue: remainingQueue,
    }));

    processingQueueRef.current = false;
    setIsProcessingQueue(false);

    if (processedCount > 0) {
      playSuccessChime(soundEnabled);
      showToast(`🎉 ${processedCount} وعده از صف آفلاین با موفقیت تحلیل و ثبت شد!`);
    }
  }, [state.offlineQueue, handleLogMealForProfileDate, showToast, soundEnabled]);

  // Automatically process offline queue when connection is restored
  useEffect(() => {
    if (isOnline && (state.offlineQueue?.length || 0) > 0) {
      processOfflineQueue();
    }
  }, [isOnline, state.offlineQueue?.length, processOfflineQueue]);

  const handleQuickLogRoutine = (routine: RoutineItem) => {
    const newMeal: MealItem = {
      id: 'm_' + Date.now(),
      time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      category: routine.category || selectedMealCat,
      title: routine.title,
      calories: routine.calories,
      protein: routine.protein,
      carbs: routine.carbs,
      fat: routine.fat,
      fiber: routine.fiber || 0,
      sugar: routine.sugar || 0,
      sodium: routine.sodium || 0,
      score: 8,
      tip: 'ثبت سریع از روتین‌های منتخب',
      updatedAt: Date.now(),
    };
    setLastAddedMealId(newMeal.id);
    updateProfileDay(state.activeProfile, state.currentDate, (day) => ({
      ...day,
      meals: [newMeal, ...day.meals],
    }));
    showToast(`✅ «${routine.title}» ثبت شد!`);
  };

  const handleScaleMealPortion = (mealId: string, multiplier: number) => {
    updateProfileDay(state.activeProfile, state.currentDate, (day) => ({
      ...day,
      meals: day.meals.map((m) =>
        m.id === mealId
          ? {
              ...m,
              calories: Math.round(m.calories * multiplier),
              protein: Math.round(m.protein * multiplier * 10) / 10,
              carbs: Math.round(m.carbs * multiplier * 10) / 10,
              fat: Math.round(m.fat * multiplier * 10) / 10,
              fiber: Math.round((m.fiber || 0) * multiplier * 10) / 10,
              sugar: Math.round((m.sugar || 0) * multiplier * 10) / 10,
              sodium: Math.round((m.sodium || 0) * multiplier),
              updatedAt: Date.now(),
            }
          : m
      ),
    }));
    showToast(`اندازه سهم غذا (${multiplier} برابر) به‌روزرسانی شد`);
  };

  // BUG FIX #2: Record deleted meal ID in deletedIds tombstone array so server sync never brings it back
  const handleDeleteMeal = (mealId: string) => {
    updateProfileDay(state.activeProfile, state.currentDate, (day) => ({
      ...day,
      meals: day.meals.filter((m) => m.id !== mealId),
      deletedIds: Array.from(new Set([...(day.deletedIds || []), mealId])),
    }));
    showToast('وعده غذایی حذف شد');
  };

  const handleCopyFromYesterday = () => {
    const yesterdayStr = addDaysStr(state.currentDate, -1);
    const yDay = activeProfile.days[yesterdayStr];
    const matching = (yDay?.meals || []).filter((m) => m.category === selectedMealCat);
    if (matching.length === 0) {
      showToast(`در روز قبل وعده‌ای برای «${selectedMealCat}» ثبت نشده بود`);
      return;
    }
    const nowTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const copiedMeals: MealItem[] = matching.map((m, i) => ({
      ...m,
      id: 'm_' + (Date.now() + i),
      time: nowTime,
      updatedAt: Date.now(),
    }));
    setLastAddedMealId(copiedMeals[0].id);
    playSuccessChime(soundEnabled);
    updateProfileDay(state.activeProfile, state.currentDate, (day) => ({
      ...day,
      meals: [...copiedMeals, ...day.meals],
    }));
    showToast(`${copiedMeals.length} وعده ${selectedMealCat} از دیروز کپی شد!`);
  };

  const handleSaveEditedMeal = (
    itemData: Omit<MealItem, 'id' | 'time'>,
    existingId: string | null,
    mode: 'meal' | 'routine_only',
    alsoSaveRoutine: boolean
  ) => {
    playSuccessChime(soundEnabled);
    if (mode === 'routine_only') {
      setState((prev) => {
        const prof = prev.profiles[prev.activeProfile];
        return {
          ...prev,
          profiles: {
            ...prev.profiles,
            [prev.activeProfile]: {
              ...prof,
              routines: [{ ...itemData }, ...(prof.routines || [])],
            },
          },
        };
      });
      setSelectedMealCat(itemData.category);
      setMealModalOpen(false);
      showToast(`«${itemData.title}» به روتین‌های ${itemData.category} اضافه شد`);
      return;
    }

    if (existingId) {
      updateProfileDay(state.activeProfile, state.currentDate, (day) => ({
        ...day,
        meals: day.meals.map((m) =>
          m.id === existingId ? { ...m, ...itemData, updatedAt: Date.now() } : m
        ),
      }));
      showToast('وعده غذایی ویرایش شد');
    } else {
      const newMeal: MealItem = {
        ...itemData,
        id: 'm_' + Date.now(),
        time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        score: 8,
        tip: 'ثبت دستی',
        updatedAt: Date.now(),
      };
      setLastAddedMealId(newMeal.id);
      updateProfileDay(state.activeProfile, state.currentDate, (day) => ({
        ...day,
        meals: [newMeal, ...day.meals],
      }));
      showToast('وعده غذایی ثبت شد');
    }

    if (alsoSaveRoutine) {
      setState((prev) => {
        const prof = prev.profiles[prev.activeProfile];
        return {
          ...prev,
          profiles: {
            ...prev.profiles,
            [prev.activeProfile]: {
              ...prof,
              routines: [{ ...itemData }, ...(prof.routines || [])],
            },
          },
        };
      });
    }

    setMealModalOpen(false);
  };

  const handleAskWhatToEat = async () => {
    setWhatToEatOpen(true);
    setWhatToEatLoading(true);
    try {
      const dayObj = activeProfile.days[state.currentDate] || { water: 0, meals: [], exercises: [] };
      const eatenCal = (dayObj.meals || []).reduce((s, m) => s + Number(m.calories || 0), 0);
      const burnedCal = (dayObj.exercises || []).reduce(
        (s, e) => s + Number(e.caloriesBurned || 0),
        0
      );
      const eatenP = (dayObj.meals || []).reduce((s, m) => s + Number(m.protein || 0), 0);
      const eatenC = (dayObj.meals || []).reduce((s, m) => s + Number(m.carbs || 0), 0);
      const eatenF = (dayObj.meals || []).reduce((s, m) => s + Number(m.fat || 0), 0);

      const res = await fetch('/api/gemini/what-to-eat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remainingCalories: Math.max(0, activeProfile.targets.calories - eatenCal + burnedCal),
          remainingProtein: Math.max(0, Math.round(activeProfile.targets.protein - eatenP)),
          remainingCarbs: Math.max(0, Math.round(activeProfile.targets.carbs - eatenC)),
          remainingFat: Math.max(0, Math.round(activeProfile.targets.fat - eatenF)),
          currentHour: new Date().getHours(),
          eatenMeals: (dayObj.meals || []).map((m) => m.title),
          goal: activeProfile.stats.goal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در دریافت پیشنهاد');
      setWhatToEatData(data);
    } catch (err: any) {
      showToast(err.message || 'خطا در دریافت پیشنهاد هوشمند');
      setWhatToEatOpen(false);
    } finally {
      setWhatToEatLoading(false);
    }
  };

  const handleExportCSV = () => {
    const BOM = '\uFEFF';
    const rows: string[][] = [
      [
        'تاریخ',
        'وعده',
        'ساعت',
        'عنوان غذا',
        'کالری',
        'پروتئین (g)',
        'کربوهیدرات (g)',
        'چربی (g)',
        'فیبر (g)',
        'قند (g)',
        'سدیم (mg)',
      ],
    ];
    Object.keys(activeProfile.days)
      .sort()
      .reverse()
      .forEach((date) => {
        (activeProfile.days[date]?.meals || []).forEach((m) => {
          const cleanTitle = `"${String(m.title || '').replace(/"/g, '""')}"`;
          rows.push([
            date,
            m.category,
            m.time || '',
            cleanTitle,
            String(m.calories),
            String(m.protein),
            String(m.carbs),
            String(m.fat),
            String(m.fiber || 0),
            String(m.sugar || 0),
            String(m.sodium || 0),
          ]);
        });
      });

    const csvContent = BOM + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nutrition_${state.activeProfile}_${getTodayStr()}.csv`;
    a.click();
    showToast('فایل اکسل (CSV) با موفقیت دانلود شد');
  };

  const handleCopySafeInviteLink = (profKey: string) => {
    const p = state.profiles[profKey];
    if (!p) return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('user', profKey);
    url.searchParams.set('name', p.name);
    url.searchParams.set('gender', p.gender);
    url.searchParams.set('color', p.color);
    navigator.clipboard.writeText(url.toString());
    showToast(`لینک دعوت امن «${p.name}» (بدون افشای کلیدها) کپی شد!`);
  };

  // Distinct Surface Backgrounds for each of the 3 Design Styles
  const getCanvasStyle = (): React.CSSProperties => {
    const vars = {
      '--accent-hex': pal.hex,
      '--accent-hex2': pal.hex2,
    } as React.CSSProperties;

    if (state.designStyle === 'glass') {
      return {
        ...vars,
        background: state.darkMode
          ? `radial-gradient(circle at 88% 8%, ${pal.hex}38, transparent 45%), radial-gradient(circle at 12% 85%, ${pal.hex2}28, transparent 50%), #070b14`
          : `radial-gradient(circle at 88% 8%, ${pal.hex}26, transparent 45%), radial-gradient(circle at 12% 85%, ${pal.hex2}20, transparent 50%), #f1f5f9`,
      };
    }

    if (state.designStyle === 'material') {
      return {
        ...vars,
        backgroundColor: state.darkMode
          ? `color-mix(in srgb, ${pal.hex} 20%, #090d16)`
          : `color-mix(in srgb, ${pal.hex} 15%, #f8fafc)`,
      };
    }

    // classic (Architectural dot grid + high-contrast editorial look)
    return {
      ...vars,
      backgroundColor: state.darkMode ? '#090d16' : '#fafaf9',
      backgroundImage: state.darkMode
        ? `radial-gradient(${pal.hex}40 1.25px, transparent 1.25px)`
        : `radial-gradient(${pal.hex}35 1.25px, transparent 1.25px)`,
      backgroundSize: '20px 20px',
    };
  };

  return (
    <div
      data-theme-style={state.designStyle}
      style={getCanvasStyle()}
      className="min-h-screen text-slate-900 dark:text-slate-100 pb-28 lg:pb-12 transition-colors duration-300"
    >
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs font-extrabold py-1.5 px-4 text-center">
          حالت آفلاین فعال است — وعده‌های شما در «صف ارسال خودکار» ذخیره می‌شوند و به محض اتصال اینترنت تحلیل خواهند شد.
        </div>
      )}

      {/* Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-6">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              playSoftTap(soundEnabled);
              setActiveTab('dashboard');
            }}
            className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            دستیار هوشمند تغذیه
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-bold text-slate-600 dark:text-slate-300">
            {[
              { id: 'dashboard', label: 'داشبورد امروز' },
              { id: 'kitchen', label: 'آشپزخانه رژیمی' },
              { id: 'analytics', label: 'آمار و نمودار' },
              { id: 'profile', label: 'اهداف و پروفایل' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  playSoftTap(soundEnabled);
                  setActiveTab(item.id as ActiveTab);
                }}
                style={activeTab === item.id ? { borderColor: pal.hex } : undefined}
                className={`whitespace-nowrap shrink-0 py-1 transition cursor-pointer border-b-2 ${
                  activeTab === item.id
                    ? 'text-slate-900 dark:text-white font-extrabold'
                    : 'border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {!isInstalled && (isInstallable || isIOS) && (
              <button
                type="button"
                onClick={async () => {
                  playSoftTap(soundEnabled);
                  if (isInstallable) {
                    await install();
                  } else {
                    setPwaGuideOpen(true);
                  }
                }}
                className="min-h-[38px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-200 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">نصب اپ</span>
              </button>
            )}

            {/* Sound & Haptic Micro-Feedback Toggle */}
            <button
              type="button"
              onClick={() => {
                const nextSound = !soundEnabled;
                if (nextSound) playSoftTap(true);
                setState((prev) => ({ ...prev, soundEnabled: nextSound }));
                showToast(nextSound ? '🔊 افکت‌های صوتی ظریف فعال شد' : '🔇 افکت‌های صوتی بی‌صدا شد');
              }}
              aria-label="تغییر وضعیت افکت صوتی"
              title="افکت‌های صوتی و لرزشی"
              className="min-w-[38px] min-h-[38px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                playSoftTap(soundEnabled);
                setState((prev) => ({ ...prev, darkMode: !prev.darkMode }));
              }}
              aria-label="تغییر حالت شب و روز"
              className="min-w-[38px] min-h-[38px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              {state.darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                playSoftTap(soundEnabled);
                const keys = Object.keys(state.profiles);
                const nextIdx = (keys.indexOf(state.activeProfile) + 1) % keys.length;
                const nextKey = keys[nextIdx];
                setState((prev) => ({ ...prev, activeProfile: nextKey }));
                showToast(`پروفایل فعال: ${state.profiles[nextKey].name}`);
              }}
              style={{ backgroundColor: pal.hex }}
              className="min-h-[38px] px-3.5 rounded-xl text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition whitespace-nowrap shrink-0 cursor-pointer"
              title="لمس برای تغییر سریع پروفایل"
            >
              <span>{activeProfile.avatar || '👤'}</span>
              <span>{activeProfile.name}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-4 space-y-5">
        {/* Sub-Toolbar: Active Date Navigation, Streak & Cloud Sync */}
        <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playSoftTap(soundEnabled);
                setState((prev) => ({ ...prev, currentDate: addDaysStr(prev.currentDate, -1) }));
              }}
              aria-label="روز قبل"
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
              {formatJalaliFull(state.currentDate)}
            </div>
            <button
              type="button"
              onClick={() => {
                playSoftTap(soundEnabled);
                setState((prev) => ({ ...prev, currentDate: addDaysStr(prev.currentDate, 1) }));
              }}
              aria-label="روز بعد"
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {state.currentDate !== getTodayStr() && (
              <button
                type="button"
                onClick={() => {
                  playSoftTap(soundEnabled);
                  setState((prev) => ({ ...prev, currentDate: getTodayStr() }));
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-extrabold cursor-pointer"
              >
                برو به امروز
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400 tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>{streakCount} روز پیوسته</span>
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                playSoftTap(soundEnabled);
                syncWithServer('push');
                showToast('همگام‌سازی ابری انجام شد');
              }}
              className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-500' : ''}`} />
              <span>همگام‌سازی ابری</span>
            </button>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <DashboardTab
            profile={activeProfile}
            activeProfileKey={state.activeProfile}
            allProfiles={state.profiles}
            currentDate={state.currentDate}
            selectedMealCat={selectedMealCat}
            lastAddedMealId={lastAddedMealId}
            soundEnabled={soundEnabled}
            offlineQueue={state.offlineQueue || []}
            isProcessingQueue={isProcessingQueue}
            onSelectDate={(ds) => setState((prev) => ({ ...prev, currentDate: ds }))}
            onSelectMealCat={setSelectedMealCat}
            onChangeWater={handleChangeWater}
            onOpenExerciseModal={() => setExerciseModalOpen(true)}
            onDeleteExercise={(exId) => {
              updateProfileDay(state.activeProfile, state.currentDate, (day) => ({
                ...day,
                exercises: day.exercises.filter((e) => e.id !== exId),
                deletedIds: Array.from(new Set([...(day.deletedIds || []), exId])),
              }));
              showToast('فعالیت ورزشی حذف شد');
            }}
            onAskWhatToEat={handleAskWhatToEat}
            onOpenShareCardModal={() => setShareCardModalOpen(true)}
            onLogMealFromAI={handleLogMealFromAI}
            onEnqueueOfflineMeal={handleEnqueueOfflineMeal}
            onProcessOfflineQueue={processOfflineQueue}
            onRemoveQueueItem={handleRemoveQueueItem}
            onQuickLogRoutine={handleQuickLogRoutine}
            onRemoveRoutine={(idx) => {
              setState((prev) => {
                const prof = prev.profiles[prev.activeProfile];
                const nextRoutines = (prof.routines || []).filter((_, i) => i !== idx);
                return {
                  ...prev,
                  profiles: {
                    ...prev.profiles,
                    [prev.activeProfile]: { ...prof, routines: nextRoutines },
                  },
                };
              });
              showToast('روتین حذف شد');
            }}
            onOpenAddRoutineModal={() => {
              setEditingMeal(null);
              setMealModalMode('routine_only');
              setMealModalOpen(true);
            }}
            onOpenManualMealModal={() => {
              setEditingMeal(null);
              setMealModalMode('meal');
              setMealModalOpen(true);
            }}
            onOpenEditMealModal={(m) => {
              setEditingMeal(m);
              setMealModalMode('meal');
              setMealModalOpen(true);
            }}
            onScaleMealPortion={handleScaleMealPortion}
            onSaveMealToRoutine={(m) => {
              setState((prev) => {
                const prof = prev.profiles[prev.activeProfile];
                return {
                  ...prev,
                  profiles: {
                    ...prev.profiles,
                    [prev.activeProfile]: {
                      ...prof,
                      routines: [
                        {
                          category: m.category,
                          title: m.title,
                          calories: m.calories,
                          protein: m.protein,
                          carbs: m.carbs,
                          fat: m.fat,
                          fiber: m.fiber || 0,
                          sugar: m.sugar || 0,
                          sodium: m.sodium || 0,
                        },
                        ...(prof.routines || []),
                      ],
                    },
                  },
                };
              });
              showToast(`«${m.title}» به روتین‌های ${m.category} اضافه شد`);
            }}
            onDeleteMeal={handleDeleteMeal}
            onCopyFromYesterday={handleCopyFromYesterday}
            showToast={showToast}
          />
        )}

        {activeTab === 'kitchen' && (
          <KitchenTab
            profile={activeProfile}
            currentDate={state.currentDate}
            onLogRecipeToToday={(rec: HealthyRecipe) => {
              playSuccessChime(soundEnabled);
              const newMeal: MealItem = {
                id: 'm_' + Date.now(),
                time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
                category: rec.category,
                title: rec.title,
                calories: rec.calories,
                protein: rec.protein,
                carbs: rec.carbs,
                fat: rec.fat,
                fiber: rec.fiber || 0,
                sugar: 2,
                sodium: 250,
                score: 9,
                tip: rec.healthTip,
                updatedAt: Date.now(),
              };
              setLastAddedMealId(newMeal.id);
              updateProfileDay(state.activeProfile, state.currentDate, (day) => ({
                ...day,
                meals: [newMeal, ...day.meals],
              }));
              showToast(`✅ رسپی «${rec.title}» در وعده ${rec.category} امروز ثبت شد!`);
            }}
            onAddRecipeToRoutine={(rec: HealthyRecipe) => {
              playSuccessChime(soundEnabled);
              setState((prev) => {
                const prof = prev.profiles[prev.activeProfile];
                return {
                  ...prev,
                  profiles: {
                    ...prev.profiles,
                    [prev.activeProfile]: {
                      ...prof,
                      routines: [
                        {
                          category: rec.category,
                          title: rec.title,
                          calories: rec.calories,
                          protein: rec.protein,
                          carbs: rec.carbs,
                          fat: rec.fat,
                          fiber: rec.fiber || 0,
                          sugar: 2,
                          sodium: 250,
                        },
                        ...(prof.routines || []),
                      ],
                    },
                  },
                };
              });
              showToast(`«${rec.title}» به روتین‌های ${rec.category} اضافه شد`);
            }}
            onToggleFavoriteRecipe={(recId: string) => {
              playSoftTap(soundEnabled);
              setState((prev) => {
                const prof = prev.profiles[prev.activeProfile];
                const favs = prof.favoriteRecipeIds || [];
                const exists = favs.includes(recId);
                const nextFavs = exists ? favs.filter((id) => id !== recId) : [recId, ...favs];
                return {
                  ...prev,
                  profiles: {
                    ...prev.profiles,
                    [prev.activeProfile]: {
                      ...prof,
                      favoriteRecipeIds: nextFavs,
                    },
                  },
                };
              });
            }}
            onAddCustomRecipe={(rec: HealthyRecipe) => {
              playSuccessChime(soundEnabled);
              setState((prev) => {
                const prof = prev.profiles[prev.activeProfile];
                return {
                  ...prev,
                  profiles: {
                    ...prev.profiles,
                    [prev.activeProfile]: {
                      ...prof,
                      customRecipes: [rec, ...(prof.customRecipes || [])],
                      favoriteRecipeIds: [rec.id, ...(prof.favoriteRecipeIds || [])],
                    },
                  },
                };
              });
            }}
            showToast={showToast}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab
            profile={activeProfile}
            currentDate={state.currentDate}
            darkMode={state.darkMode}
            onExportCSV={handleExportCSV}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            profile={activeProfile}
            activeProfileKey={state.activeProfile}
            allProfiles={state.profiles}
            designStyle={state.designStyle}
            githubToken={state.config?.githubToken || ''}
            gistId={state.config?.gistId || ''}
            onLogWeight={(w) => {
              playSuccessChime(soundEnabled);
              setState((prev) => {
                const prof = prev.profiles[prev.activeProfile];
                const nextWh = [
                  ...(prof.weightHistory || []),
                  { date: prev.currentDate, weight: w },
                ];
                return {
                  ...prev,
                  profiles: {
                    ...prev.profiles,
                    [prev.activeProfile]: {
                      ...prof,
                      stats: { ...prof.stats, weight: w },
                      weightHistory: nextWh,
                    },
                  },
                };
              });
              showToast(`وزن جدید (${w} کیلوگرم) ثبت شد`);
            }}
            onOpenOnboarding={() => setOnboardingModalOpen(true)}
            onSetDesignStyle={(st: DesignStyle) => {
              playSoftTap(soundEnabled);
              setState((prev) => ({ ...prev, designStyle: st }));
              const labels: Record<DesignStyle, string> = {
                glass: 'شیشه‌ای نئونی',
                material: 'متریال پویا (Tonal)',
                classic: 'کلاسیک کنتراست بالا',
              };
              showToast(`استایل ظاهری: ${labels[st]}`);
            }}
            onSetUserColor={(ck: ColorKey) => {
              playSoftTap(soundEnabled);
              setState((prev) => ({
                ...prev,
                profiles: {
                  ...prev.profiles,
                  [prev.activeProfile]: {
                    ...prev.profiles[prev.activeProfile],
                    color: ck,
                  },
                },
              }));
            }}
            onSwitchUser={(profKey) => {
              playSoftTap(soundEnabled);
              setState((prev) => ({ ...prev, activeProfile: profKey }));
              showToast(`پروفایل فعال: ${state.profiles[profKey].name}`);
            }}
            onCreateUser={(name, rawId, gender, avatar, color, partnerId) => {
              playSuccessChime(soundEnabled);
              const cleanId =
                rawId.toLowerCase().replace(/[^a-z0-9_]/g, '') ||
                'user_' + Math.floor(1000 + Math.random() * 9000);
              if (state.profiles[cleanId]) {
                showToast('این شناسه کاربری از قبل وجود دارد');
                return;
              }
              const newProf = createEmptyProfile(name, gender, { avatar, color, partnerId });
              setState((prev) => ({
                ...prev,
                activeProfile: cleanId,
                profiles: {
                  ...prev.profiles,
                  [cleanId]: newProf,
                },
              }));
              showToast(`پروفایل «${name}» ساخته شد`);
            }}
            onDeleteUser={(profKey) => {
              setState((prev) => {
                const nextProfiles = { ...prev.profiles };
                delete nextProfiles[profKey];
                return {
                  ...prev,
                  profiles: nextProfiles,
                };
              });
              showToast('پروفایل حذف شد');
            }}
            onCopyInviteLink={handleCopySafeInviteLink}
            onSaveCloudConfig={(token, gId) => {
              playSuccessChime(soundEnabled);
              setState((prev) => ({
                ...prev,
                config: {
                  ...prev.config,
                  githubToken: token.trim(),
                  gistId: gId.trim(),
                },
              }));
              syncWithServer('push', state.profiles, token.trim(), gId.trim());
              showToast('✅ تنظیمات ابری ذخیره و همگام‌سازی شد!');
            }}
            onCreateGistAuto={async (token) => {
              if (!token.trim()) {
                showToast('لطفاً ابتدا توکن گیت‌هاب را وارد کنید');
                return;
              }
              const res = await fetch('/api/gist/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ githubToken: token.trim(), profiles: state.profiles }),
              });
              const data = await res.json();
              if (!res.ok) {
                showToast(data.error || 'خطا در ساخت Gist');
                return;
              }
              playSuccessChime(soundEnabled);
              setState((prev) => ({
                ...prev,
                config: {
                  ...prev.config,
                  githubToken: token.trim(),
                  gistId: data.gistId,
                },
              }));
              showToast(`🎉 دیتابیس ابری جدید ساخته شد: ${data.gistId}`);
            }}
            showToast={showToast}
          />
        )}
      </main>

      {/* Upgraded Mobile Floating Glass Island Dock */}
      <div
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        className="md:hidden fixed bottom-3 left-3.5 right-3.5 z-40 pointer-events-none flex justify-center"
      >
        <nav
          aria-label="ناوبری اصلی موبایل"
          style={{
            borderColor: `${pal.hex}35`,
          }}
          className="pointer-events-auto w-full max-w-[400px] rounded-[26px] bg-white/85 dark:bg-slate-900/88 backdrop-blur-2xl border shadow-[0_14px_34px_-6px_rgba(15,23,42,0.22)] dark:shadow-[0_16px_38px_-6px_rgba(0,0,0,0.65)] p-1.5"
        >
          <div className="grid grid-cols-4 items-center gap-1">
            {[
              { id: 'dashboard', label: 'امروز', icon: LayoutDashboard },
              { id: 'kitchen', label: 'آشپزخانه', icon: ChefHat },
              { id: 'analytics', label: 'نمودار', icon: BarChart3 },
              { id: 'profile', label: 'اهداف', icon: UserCheck },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    playSoftTap(soundEnabled);
                    setActiveTab(t.id as ActiveTab);
                  }}
                  style={
                    isActive
                      ? {
                          background: `linear-gradient(135deg, ${pal.hex}, ${pal.hex2})`,
                          boxShadow: `0 6px 16px -4px ${pal.hex}75`,
                        }
                      : undefined
                  }
                  className={`min-h-[48px] rounded-[20px] flex flex-col items-center justify-center gap-0.5 transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'text-white font-extrabold scale-[1.02]'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold'
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform ${isActive ? '-translate-y-0.5' : ''}`} />
                  <span className="text-[11px] tracking-tight whitespace-nowrap">{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Modals */}
      <MealEditModal
        isOpen={mealModalOpen}
        mode={mealModalMode}
        initialMeal={editingMeal}
        defaultCategory={selectedMealCat}
        accentHex={pal.hex}
        onClose={() => setMealModalOpen(false)}
        onSave={handleSaveEditedMeal}
      />

      <ExerciseModal
        isOpen={exerciseModalOpen}
        userWeight={activeProfile.stats.weight}
        accentHex={pal.hex}
        onClose={() => setExerciseModalOpen(false)}
        onAddExercise={(title, caloriesBurned) => {
          playSuccessChime(soundEnabled);
          updateProfileDay(state.activeProfile, state.currentDate, (day) => ({
            ...day,
            exercises: [
              { id: 'ex_' + Date.now(), title, caloriesBurned },
              ...day.exercises,
            ],
          }));
          showToast(`ورزش «${title}» (-${caloriesBurned} kcal) ثبت شد`);
        }}
        showToast={showToast}
      />

      <WhatToEatModal
        isOpen={whatToEatOpen}
        isLoading={whatToEatLoading}
        data={whatToEatData}
        accentHex={pal.hex}
        onClose={() => setWhatToEatOpen(false)}
        onQuickLogSuggestion={(s) => {
          playSuccessChime(soundEnabled);
          const newMeal: MealItem = {
            id: 'm_' + Date.now(),
            time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
            category: s.category || selectedMealCat,
            title: s.title,
            calories: Math.round(Number(s.calories) || 0),
            protein: Math.round((Number(s.protein) || 0) * 10) / 10,
            carbs: Math.round((Number(s.carbs) || 0) * 10) / 10,
            fat: Math.round((Number(s.fat) || 0) * 10) / 10,
            fiber: Math.round((Number(s.fiber) || 0) * 10) / 10,
            sugar: 2,
            sodium: 200,
            score: 9,
            tip: 'پیشنهاد هوشمند متناسب با بودجه باقی‌مانده روز',
            updatedAt: Date.now(),
          };
          setLastAddedMealId(newMeal.id);
          updateProfileDay(state.activeProfile, state.currentDate, (day) => ({
            ...day,
            meals: [newMeal, ...day.meals],
          }));
          setWhatToEatOpen(false);
          showToast(`✅ «${newMeal.title}» ثبت شد!`);
        }}
      />

      <OnboardingModal
        isOpen={onboardingModalOpen}
        profile={activeProfile}
        accentHex={pal.hex}
        onClose={() => setOnboardingModalOpen(false)}
        onSaveWizard={(stats, targets, gender) => {
          playSuccessChime(soundEnabled);
          setState((prev) => {
            const prof = prev.profiles[prev.activeProfile];
            return {
              ...prev,
              profiles: {
                ...prev.profiles,
                [prev.activeProfile]: {
                  ...prof,
                  gender,
                  onboarded: true,
                  stats,
                  targets,
                },
              },
            };
          });
          setOnboardingModalOpen(false);
          showToast(`برنامه اختصاصی جدید (${targets.calories} کالری) محاسبه و ذخیره شد!`);
        }}
      />

      <PWAGuideModal
        isOpen={pwaGuideOpen}
        onClose={() => setPwaGuideOpen(false)}
        accentHex={pal.hex}
      />

      <ShareDailyCardModal
        isOpen={shareCardModalOpen}
        profile={activeProfile}
        currentDate={state.currentDate}
        streakCount={streakCount}
        onClose={() => setShareCardModalOpen(false)}
        showToast={showToast}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-slate-800 text-white text-xs font-extrabold px-4 py-3 rounded-2xl shadow-xl border border-white/15 max-w-[90vw] text-center">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
