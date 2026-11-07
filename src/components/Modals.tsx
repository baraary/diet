import React, { useState, useEffect, useRef } from 'react';
import { MealCategory, MealItem, UserProfile } from '../types';
import { COLOR_PALETTES, formatJalaliFull } from '../data/recipesAndRoutines';
import { X, Loader2, Plus, Download, Share2 } from 'lucide-react';

// 1. Meal Edit / Manual Add / Routine Add Modal with Portion Multiplier Buttons
interface MealEditModalProps {
  isOpen: boolean;
  mode: 'meal' | 'routine_only';
  initialMeal: MealItem | null;
  defaultCategory: MealCategory;
  accentHex: string;
  onClose: () => void;
  onSave: (
    item: Omit<MealItem, 'id' | 'time'>,
    existingId: string | null,
    mode: 'meal' | 'routine_only',
    alsoSaveRoutine: boolean
  ) => void;
}

export const MealEditModal: React.FC<MealEditModalProps> = ({
  isOpen,
  mode,
  initialMeal,
  defaultCategory,
  accentHex,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MealCategory>(defaultCategory);
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [fiber, setFiber] = useState(0);
  const [sugar, setSugar] = useState(0);
  const [sodium, setSodium] = useState(0);
  const [alsoSaveRoutine, setAlsoSaveRoutine] = useState(false);

  const [baseStats, setBaseStats] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  });

  useEffect(() => {
    if (initialMeal) {
      setTitle(initialMeal.title);
      setCategory(initialMeal.category);
      setCalories(initialMeal.calories);
      setProtein(initialMeal.protein);
      setCarbs(initialMeal.carbs);
      setFat(initialMeal.fat);
      setFiber(initialMeal.fiber || 0);
      setSugar(initialMeal.sugar || 0);
      setSodium(initialMeal.sodium || 0);
      setBaseStats({
        calories: initialMeal.calories,
        protein: initialMeal.protein,
        carbs: initialMeal.carbs,
        fat: initialMeal.fat,
        fiber: initialMeal.fiber || 0,
        sugar: initialMeal.sugar || 0,
        sodium: initialMeal.sodium || 0,
      });
    } else {
      setTitle('');
      setCategory(defaultCategory);
      setCalories(0);
      setProtein(0);
      setCarbs(0);
      setFat(0);
      setFiber(0);
      setSugar(0);
      setSodium(0);
      setBaseStats({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
      });
    }
    setAlsoSaveRoutine(false);
  }, [initialMeal, defaultCategory, isOpen]);

  if (!isOpen) return null;

  const applyPortionMultiplier = (mult: number) => {
    const src = baseStats.calories > 0 ? baseStats : { calories, protein, carbs, fat, fiber, sugar, sodium };
    if (baseStats.calories === 0 && calories > 0) {
      setBaseStats({ calories, protein, carbs, fat, fiber, sugar, sodium });
    }
    setCalories(Math.round(src.calories * mult));
    setProtein(Math.round(src.protein * mult * 10) / 10);
    setCarbs(Math.round(src.carbs * mult * 10) / 10);
    setFat(Math.round(src.fat * mult * 10) / 10);
    setFiber(Math.round(src.fiber * mult * 10) / 10);
    setSugar(Math.round(src.sugar * mult * 10) / 10);
    setSodium(Math.round(src.sodium * mult));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(
      {
        title: title.trim() || 'وعده غذایی',
        category,
        calories: Number(calories) || 0,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        fiber: Number(fiber) || 0,
        sugar: Number(sugar) || 0,
        sodium: Number(sodium) || 0,
      },
      initialMeal ? initialMeal.id : null,
      mode,
      alsoSaveRoutine
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            {mode === 'routine_only'
              ? 'افزودن غذای ثابت به روتین'
              : initialMeal
              ? 'ویرایش وعده و تنظیم ضریب سهم'
              : 'ثبت دستی وعده غذایی'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 space-y-1.5">
          <div className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
            ضریب سریع تغییر اندازه سهم (محاسبه خودکار همه مقادیر):
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: '½ سهم', mult: 0.5 },
              { label: '۱ برابر', mult: 1 },
              { label: '۱.۵ برابر', mult: 1.5 },
              { label: '۲ برابر', mult: 2 },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => applyPortionMultiplier(b.mult)}
                className="min-h-[36px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-800 dark:text-slate-200 hover:border-indigo-500 transition cursor-pointer"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2">
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                نام غذا و مقدار
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: ۲ کف دست سنگک و نیمرو"
                className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                دسته وعده
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MealCategory)}
                className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-bold text-slate-900 dark:text-white"
              >
                <option value="صبحانه">صبحانه</option>
                <option value="ناهار">ناهار</option>
                <option value="شام">شام</option>
                <option value="میان‌وعده">میان‌وعده</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                کالری (kcal)
              </label>
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 text-slate-900 dark:text-white tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                پروتئین (گرم)
              </label>
              <input
                type="number"
                step="0.1"
                value={protein}
                onChange={(e) => setProtein(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 text-slate-900 dark:text-white tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                کربوهیدرات (گرم)
              </label>
              <input
                type="number"
                step="0.1"
                value={carbs}
                onChange={(e) => setCarbs(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 text-slate-900 dark:text-white tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                چربی (گرم)
              </label>
              <input
                type="number"
                step="0.1"
                value={fat}
                onChange={(e) => setFat(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 text-slate-900 dark:text-white tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                فیبر (گرم)
              </label>
              <input
                type="number"
                step="0.1"
                value={fiber}
                onChange={(e) => setFiber(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 text-slate-900 dark:text-white tabular-nums"
              />
            </div>
          </div>

          {mode === 'meal' && (
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300 pt-1">
              <input
                type="checkbox"
                checked={alsoSaveRoutine}
                onChange={(e) => setAlsoSaveRoutine(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600"
              />
              <span>این غذا به لیست روتین‌های همین وعده هم اضافه شود</span>
            </label>
          )}

          <button
            type="submit"
            style={{ backgroundColor: accentHex }}
            className="w-full min-h-[46px] rounded-2xl text-white font-extrabold text-sm shadow-md hover:opacity-95 transition cursor-pointer"
          >
            ذخیره تغییرات
          </button>
        </form>
      </div>
    </div>
  );
};

// 2. Exercise Modal (with AI Burned Calorie Calculation)
interface ExerciseModalProps {
  isOpen: boolean;
  userWeight: number;
  accentHex: string;
  onClose: () => void;
  onAddExercise: (title: string, caloriesBurned: number) => void;
  showToast: (msg: string) => void;
}

export const ExerciseModal: React.FC<ExerciseModalProps> = ({
  isOpen,
  userWeight,
  accentHex,
  onClose,
  onAddExercise,
  showToast,
}) => {
  const [text, setText] = useState('');
  const [manualCal, setManualCal] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    if (manualCal && Number(manualCal) > 0) {
      onAddExercise(text.trim(), Math.round(Number(manualCal)));
      setText('');
      setManualCal('');
      onClose();
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/gemini/analyze-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), weight: userWeight }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در محاسبه کالری ورزش');
      onAddExercise(data.title || text.trim(), Math.round(Number(data.caloriesBurned) || 150));
      setText('');
      setManualCal('');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'خطا در محاسبه ورزش');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            ثبت فعالیت ورزشی امروز
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
              چه ورزشی و چه مدت انجام دادی؟
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="مثلاً: ۴۵ دقیقه پیاده‌روی تند یا ۳۰ دقیقه بدنسازی"
              className="w-full min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3.5 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
              کالری سوزانده‌شده (اختیاری - اگر خالی بگذارید هوش مصنوعی حساب می‌کند)
            </label>
            <input
              type="number"
              value={manualCal}
              onChange={(e) => setManualCal(e.target.value)}
              placeholder="مثلاً: 220"
              className="w-full min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3.5 text-slate-900 dark:text-white tabular-nums"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{ backgroundColor: accentHex }}
            className="w-full min-h-[46px] rounded-2xl text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 hover:opacity-95 transition cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>در حال محاسبه کالری ورزش...</span>
              </>
            ) : (
              <span>ثبت ورزش</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// 3. What To Eat Smart Suggestion Modal
interface WhatToEatModalProps {
  isOpen: boolean;
  isLoading: boolean;
  data: {
    summaryAdvice: string;
    suggestions: Array<{
      title: string;
      category: MealCategory;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
      reason: string;
    }>;
  } | null;
  accentHex: string;
  onClose: () => void;
  onQuickLogSuggestion: (sug: {
    title: string;
    category: MealCategory;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }) => void;
}

export const WhatToEatModal: React.FC<WhatToEatModalProps> = ({
  isOpen,
  isLoading,
  data,
  accentHex,
  onClose,
  onQuickLogSuggestion,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            پیشنهاد هوشمند برای ادامه امروز شما
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
            <span>در حال بررسی بودجه کالری و ماکروهای باقی‌مانده امروز شما...</span>
          </div>
        ) : data ? (
          <div className="space-y-4 text-xs leading-relaxed">
            <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/70 text-slate-800 dark:text-slate-200 font-medium">
              {data.summaryAdvice}
            </div>

            <div className="space-y-3">
              {(data.suggestions || []).map((s, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {s.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                        <span>{s.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {s.calories} kcal
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>پروتئین {s.protein}g</span>
                        <span aria-hidden="true">·</span>
                        <span>کربو {s.carbs}g</span>
                        <span aria-hidden="true">·</span>
                        <span>چربی {s.fat}g</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onQuickLogSuggestion(s)}
                      style={{ backgroundColor: accentHex }}
                      className="min-h-[36px] px-3 rounded-xl text-white text-xs font-extrabold flex items-center gap-1 shrink-0 hover:opacity-95 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>ثبت این وعده</span>
                    </button>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-xs">{s.reason}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// 4. Onboarding / TDEE Goal Calculator Wizard Modal
interface OnboardingModalProps {
  isOpen: boolean;
  profile: UserProfile;
  accentHex: string;
  onClose: () => void;
  onSaveWizard: (stats: UserProfile['stats'], targets: UserProfile['targets'], gender: 'male' | 'female') => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  profile,
  accentHex,
  onClose,
  onSaveWizard,
}) => {
  const [gender, setGender] = useState<'male' | 'female'>(profile.gender);
  const [age, setAge] = useState(profile.stats.age);
  const [height, setHeight] = useState(profile.stats.height);
  const [weight, setWeight] = useState(profile.stats.weight);
  const [targetWeight, setTargetWeight] = useState(profile.stats.targetWeight);
  const [activity, setActivity] = useState(profile.stats.activity);
  const [goal, setGoal] = useState<UserProfile['stats']['goal']>(profile.stats.goal);

  useEffect(() => {
    setGender(profile.gender);
    setAge(profile.stats.age);
    setHeight(profile.stats.height);
    setWeight(profile.stats.weight);
    setTargetWeight(profile.stats.targetWeight);
    setActivity(profile.stats.activity);
    setGoal(profile.stats.goal);
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const bmr =
      gender === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;
    const tdee = bmr * activity;

    let targetCal = tdee;
    let proteinPerKg = 1.6;
    if (goal === 'lose_fast') {
      targetCal = tdee - 500;
      proteinPerKg = 1.8;
    } else if (goal === 'lose_mild') {
      targetCal = tdee - 350;
      proteinPerKg = 1.7;
    } else if (goal === 'recomp') {
      targetCal = tdee - 150;
      proteinPerKg = 2.0;
    } else if (goal === 'gain') {
      targetCal = tdee + 300;
      proteinPerKg = 1.8;
    }

    targetCal = Math.max(gender === 'male' ? 1400 : 1200, Math.round(targetCal));
    const proteinG = Math.round(weight * proteinPerKg);
    const fatG = Math.round((targetCal * 0.27) / 9);
    const carbsG = Math.max(50, Math.round((targetCal - proteinG * 4 - fatG * 9) / 4));
    const waterGlasses = Math.max(6, Math.round((weight * 0.033) / 0.25));

    onSaveWizard(
      {
        age,
        height,
        weight,
        startWeight: profile.stats.startWeight || weight,
        targetWeight,
        activity,
        goal,
      },
      {
        calories: targetCal,
        protein: proteinG,
        carbs: carbsG,
        fat: fatG,
        fiber: gender === 'male' ? 30 : 25,
        sugar: 30,
        sodium: 2300,
        water: waterGlasses,
      },
      gender
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            تنظیم مشخصات و محاسبه هوشمند کالری ({profile.name})
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCalculate} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">جنسیت</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-bold text-slate-900 dark:text-white"
              >
                <option value="male">مرد</option>
                <option value="female">زن</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">سن (سال)</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-bold text-slate-900 dark:text-white tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                قد (سانتی‌متر)
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-bold text-slate-900 dark:text-white tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                وزن فعلی (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-bold text-slate-900 dark:text-white tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
              وزن هدف (کیلوگرم)
            </label>
            <input
              type="number"
              step="0.1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(Number(e.target.value))}
              className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-bold text-slate-900 dark:text-white tabular-nums"
            />
          </div>

          <div>
            <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
              میزان فعالیت روزانه
            </label>
            <select
              value={activity}
              onChange={(e) => setActivity(Number(e.target.value))}
              className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-bold text-slate-900 dark:text-white"
            >
              <option value={1.2}>کم‌تحرک (بدون ورزش)</option>
              <option value={1.375}>تحرک سبک (۱ تا ۳ روز در هفته)</option>
              <option value={1.55}>تحرک متوسط (۳ تا ۵ روز در هفته)</option>
              <option value={1.725}>پرتحرک (۶ تا ۷ روز ورزش سنگین)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
              هدف شما چیست؟
            </label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as UserProfile['stats']['goal'])}
              className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-bold text-slate-900 dark:text-white"
            >
              <option value="lose_fast">کاهش وزن سریع (۵۰۰- کالری)</option>
              <option value="lose_mild">کاهش وزن ملایم و اصولی (۳۵۰- کالری)</option>
              <option value="maintain">تثبیت وزن فعلی</option>
              <option value="recomp">عضله‌سازی و چربی‌سوزی هم‌زمان</option>
              <option value="gain">افزایش وزن و عضله‌سازی (+۳۰۰ کالری)</option>
            </select>
          </div>

          <button
            type="submit"
            style={{ backgroundColor: accentHex }}
            className="w-full min-h-[46px] rounded-2xl text-white font-extrabold text-sm shadow-md hover:opacity-95 transition cursor-pointer"
          >
            محاسبه هوشمند و ذخیره برنامه
          </button>
        </form>
      </div>
    </div>
  );
};

// 5. iOS / Android PWA Install Guide Modal
interface PWAGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  accentHex: string;
}

export const PWAGuideModal: React.FC<PWAGuideModalProps> = ({ isOpen, onClose, accentHex }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            نصب وب‌اپلیکیشن روی صفحه اصلی گوشی
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-1">
            <div className="font-extrabold text-slate-900 dark:text-white">
              نصب در آیفون و آیپد (Safari):
            </div>
            <p>
              ۱. دکمه <b>Share</b> در نوار پایین مرورگر سافاری را لمس کنید.
              <br />
              ۲. گزینه <b>Add to Home Screen</b> را انتخاب نمایید تا با آیکون اختصاصی تمام‌صفحه نصب شود.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-1">
            <div className="font-extrabold text-slate-900 dark:text-white">
              نصب در اندروید و دسکتاپ (Chrome):
            </div>
            <p>
              روی منوی سه نقطه بالای مرورگر بزنید و گزینه <b>Install app</b> یا{' '}
              <b>Add to Home screen</b> را انتخاب کنید.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{ backgroundColor: accentHex }}
          className="w-full min-h-[44px] rounded-2xl text-white font-extrabold text-xs cursor-pointer"
        >
          متوجه شدم
        </button>
      </div>
    </div>
  );
};

// 6. Shareable Daily Summary Card Modal (Suggestion #3)
interface ShareDailyCardModalProps {
  isOpen: boolean;
  profile: UserProfile;
  currentDate: string;
  streakCount: number;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const ShareDailyCardModal: React.FC<ShareDailyCardModalProps> = ({
  isOpen,
  profile,
  currentDate,
  streakCount,
  onClose,
  showToast,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pal = COLOR_PALETTES[profile.color] || COLOR_PALETTES.indigo;
  const dayObj = profile.days[currentDate] || { water: 0, meals: [], exercises: [] };

  const meals = dayObj.meals || [];
  const exercises = dayObj.exercises || [];
  const eatenCal = Math.round(meals.reduce((s, m) => s + Number(m.calories || 0), 0));
  const burnedCal = Math.round(exercises.reduce((s, e) => s + Number(e.caloriesBurned || 0), 0));
  const targetCal = profile.targets.calories || 2000;
  const totalP = Math.round(meals.reduce((s, m) => s + Number(m.protein || 0), 0));
  const totalC = Math.round(meals.reduce((s, m) => s + Number(m.carbs || 0), 0));
  const totalF = Math.round(meals.reduce((s, m) => s + Number(m.fat || 0), 0));
  const waterCount = dayObj.water || 0;

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 720;
    const H = 900;
    canvas.width = W;
    canvas.height = H;

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e293b');
    grad.addColorStop(1, pal.hex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle Card Container
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(45, 45, W - 90, H - 90, 36);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText(`کارنامه تغذیه روزانه ${profile.name}`, W / 2, 130);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '22px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText(formatJalaliFull(currentDate), W / 2, 175);

    // Center Calorie Circle
    const cx = W / 2;
    const cy = 350;
    const radius = 115;

    ctx.lineWidth = 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    const ratio = Math.min(1, Math.max(0.05, (eatenCal - burnedCal) / Math.max(1, targetCal)));
    ctx.strokeStyle = '#10b981';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText(`${eatenCal}`, cx, cy + 10);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 20px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText(`از ${targetCal} کالری هدف`, cx, cy + 48);

    // 3 Macro Boxes
    const boxY = 530;
    const boxW = 180;
    const boxH = 115;
    const macros = [
      { label: 'پروتئین', val: `${totalP}g`, max: `${profile.targets.protein}g`, color: '#f43f5e', x: 90 },
      { label: 'کربوهیدرات', val: `${totalC}g`, max: `${profile.targets.carbs}g`, color: '#f59e0b', x: 270 },
      { label: 'چربی', val: `${totalF}g`, max: `${profile.targets.fat}g`, color: '#10b981', x: 450 },
    ];

    macros.forEach((m) => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.beginPath();
      ctx.roundRect(m.x, boxY, boxW, boxH, 22);
      ctx.fill();

      ctx.fillStyle = m.color;
      ctx.font = 'bold 20px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText(m.label, m.x + boxW / 2, boxY + 38);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 28px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText(m.val, m.x + boxW / 2, boxY + 76);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '15px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText(`هدف: ${m.max}`, m.x + boxW / 2, boxY + 100);
    });

    // Bottom Strip: Water, Exercise, Streak
    const botY = 690;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(90, botY, W - 180, 90, 22);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText(
      `💧 آب: ${waterCount} لیوان   |   🏃 ورزش: ${burnedCal} کالری   |   🔥 ${streakCount} روز پیوسته`,
      W / 2,
      botY + 54
    );

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '16px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText('دستیار هوشمند تغذیه', W / 2, 825);
  }, [isOpen, profile, currentDate, eatenCal, burnedCal, targetCal, totalP, totalC, totalF, waterCount, streakCount, pal.hex]);

  if (!isOpen) return null;

  const handleDownloadImage = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `daily_summary_${currentDate}.png`;
    a.click();
    showToast('تصویر خلاصه امروز دانلود شد!');
  };

  const handleShareText = () => {
    const text = [
      `📊 گزارش تغذیه امروز (${profile.name} - ${formatJalaliFull(currentDate)}):`,
      `🎯 کالری دریافتی: ${eatenCal} از ${targetCal} kcal`,
      `🥩 پروتئین: ${totalP}g | 🍞 کربو: ${totalC}g | 🥑 چربی: ${totalF}g`,
      `💧 آب: ${waterCount} از ${profile.targets.water} لیوان`,
      `🏃 ورزش: -${burnedCal} kcal | 🔥 ${streakCount} روز پیوسته`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    showToast('متن خلاصه امروز در کلیپ‌بورد کپی شد!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            کارت تصویری خلاصه امروز
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md">
          <canvas ref={canvasRef} className="w-full h-auto block" />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleDownloadImage}
            style={{ backgroundColor: pal.hex }}
            className="min-h-[44px] rounded-xl text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>دانلود تصویر PNG</span>
          </button>
          <button
            type="button"
            onClick={handleShareText}
            className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-slate-200 transition cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>کپی متن برای تلگرام</span>
          </button>
        </div>
      </div>
    </div>
  );
};
