import React, { useState, useRef } from 'react';
import {
  MealCategory,
  MealItem,
  OfflineQueueItem,
  RoutineItem,
  UserProfile,
} from '../types';
import {
  COLOR_PALETTES,
  addDaysStr,
  formatJalaliShortDay,
  getTodayStr,
} from '../data/recipesAndRoutines';
import {
  playWaterDrop,
  playSoftTap,
  playSuccessChime,
  playDeleteSound,
} from '../utils/feedback';
import {
  Camera,
  Mic,
  MicOff,
  Copy,
  Sparkles,
  Droplets,
  Dumbbell,
  Star,
  Pencil,
  Trash2,
  X,
  Loader2,
  Check,
  Users,
  Share2,
  Sunrise,
  Sun,
  Sunset,
  Coffee,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface DashboardTabProps {
  profile: UserProfile;
  activeProfileKey: string;
  allProfiles: Record<string, UserProfile>;
  currentDate: string;
  selectedMealCat: MealCategory;
  lastAddedMealId: string | null;
  soundEnabled: boolean;
  offlineQueue: OfflineQueueItem[];
  isProcessingQueue: boolean;
  onSelectDate: (dateStr: string) => void;
  onSelectMealCat: (cat: MealCategory) => void;
  onChangeWater: (delta: number) => void;
  onOpenExerciseModal: () => void;
  onDeleteExercise: (id: string) => void;
  onAskWhatToEat: () => void;
  onOpenShareCardModal: () => void;
  onLogMealFromAI: (
    meal: MealItem,
    saveToRoutine: boolean,
    sharedPartnerKey: string | null,
    sharedMultiplier: number
  ) => void;
  onEnqueueOfflineMeal: (item: Omit<OfflineQueueItem, 'id' | 'createdAt'>) => void;
  onProcessOfflineQueue: () => void;
  onRemoveQueueItem: (id: string) => void;
  onQuickLogRoutine: (routine: RoutineItem) => void;
  onRemoveRoutine: (idx: number) => void;
  onOpenAddRoutineModal: () => void;
  onOpenManualMealModal: () => void;
  onOpenEditMealModal: (meal: MealItem) => void;
  onScaleMealPortion: (mealId: string, multiplier: number) => void;
  onSaveMealToRoutine: (meal: MealItem) => void;
  onDeleteMeal: (mealId: string) => void;
  onCopyFromYesterday: () => void;
  showToast: (msg: string) => void;
}

const MEAL_TIMELINE_META: Record<
  MealCategory,
  { icon: React.FC<{ className?: string }>; colorClass: string; nodeBg: string }
> = {
  صبحانه: {
    icon: Sunrise,
    colorClass: 'text-amber-600 dark:text-amber-400',
    nodeBg: 'bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700',
  },
  ناهار: {
    icon: Sun,
    colorClass: 'text-orange-600 dark:text-orange-400',
    nodeBg: 'bg-orange-100 dark:bg-orange-950/70 border-orange-300 dark:border-orange-700',
  },
  'میان‌وعده': {
    icon: Coffee,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    nodeBg: 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700',
  },
  شام: {
    icon: Sunset,
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    nodeBg: 'bg-indigo-100 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700',
  },
};

export const DashboardTab: React.FC<DashboardTabProps> = ({
  profile,
  activeProfileKey,
  allProfiles,
  currentDate,
  selectedMealCat,
  lastAddedMealId,
  soundEnabled,
  offlineQueue,
  isProcessingQueue,
  onSelectDate,
  onSelectMealCat,
  onChangeWater,
  onOpenExerciseModal,
  onDeleteExercise,
  onAskWhatToEat,
  onOpenShareCardModal,
  onLogMealFromAI,
  onEnqueueOfflineMeal,
  onProcessOfflineQueue,
  onRemoveQueueItem,
  onQuickLogRoutine,
  onRemoveRoutine,
  onOpenAddRoutineModal,
  onOpenManualMealModal,
  onOpenEditMealModal,
  onScaleMealPortion,
  onSaveMealToRoutine,
  onDeleteMeal,
  onCopyFromYesterday,
  showToast,
}) => {
  const [foodInput, setFoodInput] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [saveRoutineChecked, setSaveRoutineChecked] = useState(false);
  const [sharedChecked, setSharedChecked] = useState(false);
  const [sharedPartnerKey, setSharedPartnerKey] = useState<string>(
    profile.partnerId ||
      Object.keys(allProfiles).find((k) => k !== activeProfileKey) ||
      ''
  );
  const [sharedMultiplier, setSharedMultiplier] = useState<number>(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const pal = COLOR_PALETTES[profile.color] || COLOR_PALETTES.indigo;
  const todayStr = getTodayStr();
  const dayObj = profile.days[currentDate] || { water: 0, meals: [], exercises: [] };

  // Totals calculation
  const meals = dayObj.meals || [];
  const exercises = dayObj.exercises || [];
  const eatenCal = Math.round(meals.reduce((s, m) => s + Number(m.calories || 0), 0));
  const burnedCal = Math.round(exercises.reduce((s, e) => s + Number(e.caloriesBurned || 0), 0));
  const targetCal = profile.targets.calories || 2000;
  const netCal = Math.max(0, eatenCal - burnedCal);
  const remainingCal = targetCal - eatenCal + burnedCal;

  const totalP = Math.round(meals.reduce((s, m) => s + Number(m.protein || 0), 0) * 10) / 10;
  const totalC = Math.round(meals.reduce((s, m) => s + Number(m.carbs || 0), 0) * 10) / 10;
  const totalF = Math.round(meals.reduce((s, m) => s + Number(m.fat || 0), 0) * 10) / 10;
  const totalFiber = Math.round(meals.reduce((s, m) => s + Number(m.fiber || 0), 0) * 10) / 10;
  const totalSugar = Math.round(meals.reduce((s, m) => s + Number(m.sugar || 0), 0) * 10) / 10;
  const totalSodium = Math.round(meals.reduce((s, m) => s + Number(m.sodium || 0), 0));

  // Gauge arc calculation (total dash = 326.7)
  const arcTotal = 326.7;
  const calRatio = Math.min(1, Math.max(0, netCal / Math.max(1, targetCal)));
  const dashOffset = arcTotal - arcTotal * calRatio;

  // Water wave calculation
  const waterCount = dayObj.water || 0;
  const waterTarget = profile.targets.water || 8;
  const waterLiters = (waterCount * 0.25).toFixed(2);
  const waterPct = Math.min(100, Math.round((waterCount / Math.max(1, waterTarget)) * 100));

  // 7-day horizontal calendar strip with Mini SVG Progress Rings
  const weekDays: string[] = [];
  for (let i = -5; i <= 1; i++) {
    weekDays.push(addDaysStr(todayStr, i));
  }
  if (!weekDays.includes(currentDate)) {
    weekDays[0] = currentDate;
  }

  // Handle Photo Selection & Client-side Canvas Resize
  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 900 / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setPhotoPreviewUrl(dataUrl);
        setPhotoBase64(dataUrl.split(',')[1]);
      };
      img.src = String(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoBase64(null);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Persian Speech-to-Text Voice Logging
  const toggleVoiceInput = () => {
    playSoftTap(soundEnabled);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('مرورگر شما از تایپ صوتی پشتیبانی نمی‌کند');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fa-IR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        showToast('🎙️ در حال شنیدن... بگویید چه خورده‌اید');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setFoodInput((prev) => (prev ? `${prev}، ${transcript}` : transcript));
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Submit AI Food Analysis (with automatic Offline Queue fallback)
  const handleAnalyzeFood = async () => {
    if (!foodInput.trim() && !photoBase64) {
      showToast('لطفاً توضیح غذا را بنویسید، با میکروفون بگویید یا عکس بگیرید');
      return;
    }

    // If currently offline, immediately enqueue to Smart Offline Queue
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      onEnqueueOfflineMeal({
        profileKey: activeProfileKey,
        dateStr: currentDate,
        category: selectedMealCat,
        text: foodInput.trim(),
        photoBase64,
        saveToRoutine: saveRoutineChecked,
        sharedPartnerKey: sharedChecked ? sharedPartnerKey : null,
        sharedMultiplier,
      });
      playSoftTap(soundEnabled);
      setFoodInput('');
      clearPhoto();
      setSaveRoutineChecked(false);
      setSharedChecked(false);
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/gemini/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: foodInput.trim(),
          imageBase64: photoBase64,
          mimeType: photoBase64 ? 'image/jpeg' : undefined,
          category: selectedMealCat,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در تحلیل هوشمند غذا');

      const nowTime = new Date().toLocaleTimeString('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const newMeal: MealItem = {
        id: 'm_' + Date.now(),
        time: nowTime,
        category: selectedMealCat,
        title: data.title || foodInput.trim() || 'وعده تصویری',
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

      playSuccessChime(soundEnabled);
      onLogMealFromAI(
        newMeal,
        saveRoutineChecked,
        sharedChecked ? sharedPartnerKey : null,
        sharedMultiplier
      );

      setFoodInput('');
      clearPhoto();
      setSaveRoutineChecked(false);
      setSharedChecked(false);
    } catch (err: any) {
      // If network failed or timed out, offer seamless queueing
      const isNetworkErr =
        !navigator.onLine ||
        err?.name === 'TypeError' ||
        String(err?.message || '').toLowerCase().includes('fetch');

      if (isNetworkErr) {
        onEnqueueOfflineMeal({
          profileKey: activeProfileKey,
          dateStr: currentDate,
          category: selectedMealCat,
          text: foodInput.trim(),
          photoBase64,
          saveToRoutine: saveRoutineChecked,
          sharedPartnerKey: sharedChecked ? sharedPartnerKey : null,
          sharedMultiplier,
        });
        setFoodInput('');
        clearPhoto();
        setSaveRoutineChecked(false);
        setSharedChecked(false);
      } else {
        showToast(err.message || 'خطا در ارتباط با هوش مصنوعی');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredRoutines = (profile.routines || [])
    .map((r, idx) => ({ r, idx }))
    .filter((item) => item.r.category === selectedMealCat);

  const otherProfileKeys = Object.keys(allProfiles).filter((k) => k !== activeProfileKey);

  return (
    <div className="space-y-5">
      {/* 1. 7-Day Interactive Persian Calendar Strip with Mini SVG Progress Rings */}
      <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-3 shadow-sm">
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((ds) => {
            const { weekday, dayNum } = formatJalaliShortDay(ds);
            const isSelected = ds === currentDate;
            const isToday = ds === todayStr;
            const dLog = profile.days[ds];
            const dCal = dLog
              ? (dLog.meals || []).reduce((acc, m) => acc + Number(m.calories || 0), 0)
              : 0;
            const dBurned = dLog
              ? (dLog.exercises || []).reduce((acc, e) => acc + Number(e.caloriesBurned || 0), 0)
              : 0;
            const dNet = Math.max(0, dCal - dBurned);
            const pct = Math.min(1, dNet / Math.max(1, targetCal));
            const miniCircumference = 88; // 2 * pi * 14
            const miniDashOffset = miniCircumference - miniCircumference * pct;
            const isOverTarget = dNet > targetCal * 1.08;

            return (
              <button
                key={ds}
                type="button"
                onClick={() => {
                  playSoftTap(soundEnabled);
                  onSelectDate(ds);
                }}
                style={isSelected ? { backgroundColor: pal.hex } : undefined}
                className={`min-h-[68px] rounded-2xl py-2 px-1 flex flex-col items-center justify-between transition cursor-pointer ${
                  isSelected
                    ? 'text-white shadow-md scale-[1.02]'
                    : 'bg-slate-50/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-[11px] font-bold opacity-85 truncate max-w-full">
                  {isToday ? 'امروز' : weekday}
                </span>

                {/* Mini Circular Progress Ring around Day Number */}
                <div className="relative w-9 h-9 flex items-center justify-center my-0.5">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className={
                        isSelected
                          ? 'text-white/25'
                          : 'text-slate-200 dark:text-slate-700'
                      }
                    />
                    {dNet > 0 && (
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke={
                          isSelected
                            ? '#ffffff'
                            : isOverTarget
                            ? '#f43f5e'
                            : '#10b981'
                        }
                        strokeWidth="3"
                        strokeDasharray={miniCircumference}
                        strokeDashoffset={miniDashOffset}
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                  <span className="absolute text-xs font-black tabular-nums">{dayNum}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop 12-Col Responsive Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Column 1 (5 cols on Desktop): Calorie Ring + Bento Grid (Water, Exercise, Macros) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Focal Anchor: Calorie Arc Gauge */}
          <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 py-5 px-4 shadow-sm flex flex-col items-center justify-center">
            <div className="relative w-60 h-44 flex flex-col items-center justify-center">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 200 150">
                <defs>
                  <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={pal.hex} />
                    <stop offset="50%" stopColor={pal.hex2} />
                    <stop offset="100%" stopColor={pal.hex3} />
                  </linearGradient>
                </defs>
                <path
                  d="M 30.7 132 A 78 78 0 1 1 169.3 132"
                  fill="none"
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
                <path
                  d="M 30.7 132 A 78 78 0 1 1 169.3 132"
                  fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth="14"
                  strokeDasharray={arcTotal}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-5 text-center">
                <div className="flex items-baseline gap-1 tabular-nums">
                  <span
                    className={`text-4xl font-black tracking-tight ${
                      remainingCal < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {Math.abs(remainingCal)}
                  </span>
                  <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                    kcal
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {remainingCal < 0 ? 'مازاد بر هدف' : 'کالری باقی‌مانده'}
                </span>
              </div>
            </div>

            {/* Unboxed Metadata Line */}
            <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400 tabular-nums -mt-1">
              <span>
                هدف: <b className="text-slate-900 dark:text-white">{targetCal}</b>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                دریافتی: <b className="text-slate-900 dark:text-white">{eatenCal}</b>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                ورزش: <b className="text-emerald-600 dark:text-emerald-400">{burnedCal}</b>
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  playSoftTap(soundEnabled);
                  onAskWhatToEat();
                }}
                className="min-h-[42px] px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>الان چی بخورم؟</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playSoftTap(soundEnabled);
                  onOpenShareCardModal();
                }}
                className="min-h-[42px] px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                title="ساخت کارت تصویری خلاصه امروز برای اشتراک‌گذاری"
              >
                <Share2 className="w-4 h-4 text-emerald-500" />
                <span>کارت اشتراک روز</span>
              </button>
            </div>
          </div>

          {/* Bento Grid: Clean Hydration Tracker + Exercise + Macros */}
          <div className="grid grid-cols-12 gap-3.5">
            {/* Clean Hydration Tracker (No Wave — Smooth Level + Interactive Cup Grid) */}
            <div className="col-span-5 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 relative overflow-hidden p-4 flex flex-col justify-between min-h-[220px] shadow-sm">
              {/* Smooth Rising Level Indicator (No Wave) */}
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-sky-500/25 via-cyan-400/15 to-transparent dark:from-sky-500/20 dark:via-cyan-500/10 transition-all duration-500 ease-out border-t border-sky-400/35"
                style={{ height: `${waterPct}%` }}
              />

              <div className="relative z-10 flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <Droplets className="w-4 h-4 text-sky-500 shrink-0" />
                  <span>
                    {waterCount}/{waterTarget}
                  </span>
                </span>
                <span className="text-[11px] font-black text-sky-600 dark:text-sky-400">
                  {waterPct}%
                </span>
              </div>

              <div className="relative z-10 text-center my-auto py-1.5 tabular-nums space-y-2">
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {waterLiters}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    لیتر آب امروز
                  </div>
                </div>

                {/* Mini Visual Cup Indicators */}
                <div className="flex flex-wrap items-center justify-center gap-1 px-1">
                  {Array.from({ length: Math.min(12, Math.max(8, waterTarget)) }).map((_, idx) => {
                    const filled = idx < waterCount;
                    return (
                      <span
                        key={idx}
                        className={`w-2.5 h-3.5 rounded-[4px] transition-all duration-300 ${
                          filled
                            ? 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.45)] scale-105'
                            : 'bg-slate-200/80 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="relative z-10 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    playSoftTap(soundEnabled);
                    onChangeWater(-1);
                  }}
                  aria-label="کاهش یک لیوان آب"
                  className="min-w-[40px] min-h-[40px] rounded-xl bg-white/85 dark:bg-slate-800/90 backdrop-blur-xs font-black text-sm text-slate-800 dark:text-slate-200 flex items-center justify-center active:scale-90 transition cursor-pointer shadow-xs"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playWaterDrop(soundEnabled);
                    onChangeWater(1);
                  }}
                  className="flex-1 min-h-[40px] bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-extrabold text-xs shadow-md active:scale-95 transition cursor-pointer"
                >
                  + لیوان 💧
                </button>
              </div>
            </div>

            {/* Exercise + Macros */}
            <div className="col-span-7 flex flex-col gap-3.5">
              {/* Exercise Card */}
              <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4 text-emerald-500" />
                    <span>ورزش امروز</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playSoftTap(soundEnabled);
                      onOpenExerciseModal();
                    }}
                    className="min-h-[34px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-extrabold text-slate-800 dark:text-slate-200 hover:bg-slate-200 transition cursor-pointer"
                  >
                    + ثبت ورزش
                  </button>
                </div>

                <div className="flex items-baseline justify-between mt-2 tabular-nums">
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
                    -{burnedCal} <span className="text-xs font-bold">kcal</span>
                  </div>
                  {exercises.length > 0 && (
                    <div className="flex items-center gap-1 max-w-[130px] overflow-x-auto no-scrollbar">
                      {exercises.map((ex) => (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => {
                            playDeleteSound(soundEnabled);
                            onDeleteExercise(ex.id);
                          }}
                          title="حذف این ورزش"
                          className="text-[11px] text-slate-500 hover:text-rose-500 truncate cursor-pointer"
                        >
                          {ex.title} ×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Macros Progress Bars */}
              <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-2.5 flex-1 flex flex-col justify-center tabular-nums">
                <div>
                  <div className="flex justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
                    <span>پروتئین</span>
                    <span dir="ltr">
                      <b>{totalP}</b>/{profile.targets.protein}g
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (totalP / Math.max(1, profile.targets.protein)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
                    <span>کربوهیدرات</span>
                    <span dir="ltr">
                      <b>{totalC}</b>/{profile.targets.carbs}g
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (totalC / Math.max(1, profile.targets.carbs)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-1">
                    <span>چربی</span>
                    <span dir="ltr">
                      <b>{totalF}</b>/{profile.targets.fat}g
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (totalF / Math.max(1, profile.targets.fat)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2 (7 cols on Desktop): Smart Food Logger + Offline Queue + Vertical Daily Meal Timeline */}
        <div className="lg:col-span-7 space-y-4">
          {/* Smart Food Logging Card */}
          <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
            {/* 1. Meal Category Selector */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-extrabold">
              {(['صبحانه', 'ناهار', 'شام', 'میان‌وعده'] as MealCategory[]).map((cat) => {
                const isSelected = selectedMealCat === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      playSoftTap(soundEnabled);
                      onSelectMealCat(cat);
                    }}
                    style={isSelected ? { backgroundColor: pal.hex } : undefined}
                    className={`min-h-[42px] py-2 rounded-xl transition flex items-center justify-center whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>

            {/* 2. Quick Routines for Selected Category */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-700 dark:text-slate-300">
                  ثبت یک‌ضرب روتین‌های {selectedMealCat}:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    playSoftTap(soundEnabled);
                    onOpenAddRoutineModal();
                  }}
                  className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  + تعریف روتین جدید
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {filteredRoutines.map(({ r, idx }) => (
                  <div
                    key={idx}
                    className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        playSuccessChime(soundEnabled);
                        onQuickLogRoutine(r);
                      }}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>+ {r.title}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        ({r.calories})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playDeleteSound(soundEnabled);
                        onRemoveRoutine(idx);
                      }}
                      aria-label="حذف روتین"
                      className="px-2 py-1.5 text-slate-400 hover:text-rose-500 text-xs transition cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. AI Text + Voice + Camera Input */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="ai-food-input"
                  className="text-xs font-extrabold text-slate-800 dark:text-slate-200"
                >
                  چی خوردی؟ (با پیمانه معمولی بنویس، بگو یا عکس بگیر)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playSoftTap(soundEnabled);
                      onCopyFromYesterday();
                    }}
                    className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                    title="کپی وعده‌های همین دسته از دیروز"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>کپی از دیروز</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSoftTap(soundEnabled);
                      onOpenManualMealModal();
                    }}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    ثبت دستی ✍️
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="ai-food-input"
                  type="text"
                  value={foodInput}
                  onChange={(e) => setFoodInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAnalyzeFood();
                  }}
                  placeholder="مثلاً: ۸ قاشق برنج با ۱ سیخ کوبیده و سالاد..."
                  className="flex-1 min-h-[46px] rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {/* Voice Recognition Button */}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  aria-label="تایپ صوتی فارسی"
                  title="تایپ صوتی فارسی"
                  className={`min-w-[46px] min-h-[46px] rounded-2xl border flex items-center justify-center transition cursor-pointer ${
                    isListening
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Camera / Photo Upload Button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => {
                    playSoftTap(soundEnabled);
                    fileInputRef.current?.click();
                  }}
                  aria-label="انتخاب عکس غذا"
                  title="تحلیل از روی عکس غذا"
                  className="min-w-[46px] min-h-[46px] rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 transition cursor-pointer"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>

              {photoPreviewUrl && (
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={photoPreviewUrl}
                      alt="پیش‌نمایش عکس غذا"
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      تصویر غذا آماده تحلیل هوشمند است
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="p-2 text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Checkboxes: Save to Routine + Shared Partner Meal */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={saveRoutineChecked}
                    onChange={(e) => setSaveRoutineChecked(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-600"
                  />
                  <span>ذخیره در روتین‌های {selectedMealCat}</span>
                </label>

                {otherProfileKeys.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={sharedChecked}
                        onChange={(e) => setSharedChecked(e.target.checked)}
                        className="w-4 h-4 rounded accent-rose-600"
                      />
                      <Users className="w-3.5 h-3.5 text-rose-500" />
                      <span>وعده مشترک با:</span>
                    </label>
                    {sharedChecked && (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={sharedPartnerKey}
                          onChange={(e) => setSharedPartnerKey(e.target.value)}
                          className="rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs font-bold text-slate-900 dark:text-white"
                        >
                          {otherProfileKeys.map((k) => (
                            <option key={k} value={k}>
                              {allProfiles[k].name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={sharedMultiplier}
                          onChange={(e) => setSharedMultiplier(parseFloat(e.target.value))}
                          className="rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs font-bold text-slate-900 dark:text-white"
                        >
                          <option value={0.5}>نصف سهم من (۵۰٪)</option>
                          <option value={0.75}>۷۵٪ سهم من</option>
                          <option value={1}>هم‌اندازه من (۱۰۰٪)</option>
                          <option value={1.25}>۱.۲۵ برابر من</option>
                          <option value={1.5}>۱.۵ برابر من</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleAnalyzeFood}
                style={{ backgroundColor: pal.hex }}
                className="w-full min-h-[48px] rounded-2xl text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition cursor-pointer disabled:opacity-60"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال محاسبه کالری و درشت‌مغذی‌ها...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>ثبت و تحلیل هوشمند در «{selectedMealCat}»</span>
                  </>
                )}
              </button>

              {/* Smart Offline Queue Status Card */}
              {offlineQueue.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        صف ارسال خودکار ({offlineQueue.length} وعده در انتظار اینترنت)
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isProcessingQueue}
                      onClick={onProcessOfflineQueue}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isProcessingQueue ? 'animate-spin' : ''}`}
                      />
                      <span>{isProcessingQueue ? 'در حال تحلیل...' : 'پردازش اکنون'}</span>
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {offlineQueue.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300"
                      >
                        <span className="truncate">
                          <b>{q.category}:</b> {q.text || 'تصویر پیوست‌شده'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveQueueItem(q.id)}
                          className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                          title="حذف از صف"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Vertical Daily Meal Timeline */}
          <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  تایم‌لاین وعده‌های امروز ({meals.length} وعده)
                </h3>
                {/* Clean unboxed micronutrients summary */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  <span>
                    فیبر: <b className="text-slate-800 dark:text-slate-200">{totalFiber}</b>/{profile.targets.fiber}g
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    قند: <b className="text-slate-800 dark:text-slate-200">{totalSugar}</b>/{profile.targets.sugar}g
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    سدیم: <b className="text-slate-800 dark:text-slate-200">{totalSodium}</b>/{profile.targets.sodium}mg
                  </span>
                </div>
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                مجموع: {eatenCal} <span className="text-xs font-normal text-slate-500">kcal</span>
              </div>
            </div>

            {meals.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                <p>هنوز وعده‌ای در تایم‌لاین این روز ثبت نشده است.</p>
                <p>از روتین‌های بالا، تایپ صوتی یا کادر ثبت هوشمند استفاده کنید.</p>
              </div>
            ) : (
              <div className="relative pr-6 space-y-3.5 before:content-[''] before:absolute before:right-[13px] before:top-3 before:bottom-3 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
                {meals.map((m) => {
                  const isNew = m.id === lastAddedMealId;
                  const meta = MEAL_TIMELINE_META[m.category] || MEAL_TIMELINE_META['ناهار'];
                  const NodeIcon = meta.icon;

                  return (
                    <div key={m.id} className="relative">
                      {/* Timeline Node Icon */}
                      <div
                        className={`absolute -right-6 top-3.5 w-7 h-7 rounded-full border flex items-center justify-center shadow-xs ${meta.nodeBg}`}
                      >
                        <NodeIcon className={`w-3.5 h-3.5 ${meta.colorClass}`} />
                      </div>

                      <div
                        className={`${
                          isNew ? 'meal-new-anim ring-2 ring-indigo-500/50 ' : ''
                        }rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 p-4 space-y-2.5 transition mr-2`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                              {m.title}
                            </div>
                            {/* Zero-Pill Metadata Discipline */}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              <span className={`font-extrabold ${meta.colorClass}`}>
                                {m.category}
                              </span>
                              {m.time && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>ساعت {m.time}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className="font-black text-slate-900 dark:text-white">
                                {m.calories} kcal
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>پروتئین {m.protein}g</span>
                              <span aria-hidden="true">·</span>
                              <span>کربو {m.carbs}g</span>
                              <span aria-hidden="true">·</span>
                              <span>چربی {m.fat}g</span>
                              <span aria-hidden="true">·</span>
                              <span>فیبر {m.fiber || 0}g</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                playSuccessChime(soundEnabled);
                                onSaveMealToRoutine(m);
                              }}
                              title="افزودن به روتین"
                              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-amber-500 hover:bg-amber-50 transition cursor-pointer"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                playSoftTap(soundEnabled);
                                onOpenEditMealModal(m);
                              }}
                              title="ویرایش وعده"
                              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                playDeleteSound(soundEnabled);
                                onDeleteMeal(m.id);
                              }}
                              title="حذف وعده"
                              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Quick Portion Scale Buttons (0.5x, 1.5x, 2x) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>تنظیم سریع مقدار:</span>
                            {[
                              { label: '½ سهم', mult: 0.5 },
                              { label: '۱.۵ برابر', mult: 1.5 },
                              { label: '۲ برابر', mult: 2 },
                            ].map((btn) => (
                              <button
                                key={btn.label}
                                type="button"
                                onClick={() => {
                                  playSoftTap(soundEnabled);
                                  onScaleMealPortion(m.id, btn.mult);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition cursor-pointer"
                              >
                                {btn.label}
                              </button>
                            ))}
                          </div>

                          {m.tip && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-300">
                              <span>💡 {m.tip}</span>
                              {m.score && (
                                <span className="font-extrabold mr-2 tabular-nums">
                                  (امتیاز {m.score}/10)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
