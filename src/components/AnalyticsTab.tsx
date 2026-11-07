import React, { useEffect, useRef } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  DoughnutController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { UserProfile } from '../types';
import { COLOR_PALETTES, addDaysStr, formatJalaliShortDay, getTodayStr } from '../data/recipesAndRoutines';
import { Download, TrendingDown, Award, Flame, Scale, Utensils } from 'lucide-react';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  DoughnutController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

interface AnalyticsTabProps {
  profile: UserProfile;
  currentDate: string;
  darkMode: boolean;
  onExportCSV: () => void;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  profile,
  currentDate,
  darkMode,
  onExportCSV,
}) => {
  const weeklyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const macrosCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const weightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const pal = COLOR_PALETTES[profile.color] || COLOR_PALETTES.indigo;

  // Calculate 7-day summary stats
  let totalWeekCal = 0;
  let totalWeekBurned = 0;
  let activeDaysCount = 0;
  for (let i = 6; i >= 0; i--) {
    const ds = addDaysStr(currentDate, -i);
    const dayObj = profile.days[ds];
    if (dayObj) {
      const dayMealCal = (dayObj.meals || []).reduce((acc, m) => acc + Number(m.calories || 0), 0);
      const dayExCal = (dayObj.exercises || []).reduce((acc, e) => acc + Number(e.caloriesBurned || 0), 0);
      if (dayMealCal > 0) activeDaysCount++;
      totalWeekCal += dayMealCal;
      totalWeekBurned += dayExCal;
    }
  }
  const avgDailyCal = activeDaysCount > 0 ? Math.round(totalWeekCal / activeDaysCount) : 0;

  // Today's macros & fiber for Visual Plate Breakdown
  const todayObj = profile.days[currentDate] || { water: 0, meals: [], exercises: [] };
  let todayP = 0;
  let todayC = 0;
  let todayF = 0;
  let todayFiber = 0;
  (todayObj.meals || []).forEach((m) => {
    todayP += Number(m.protein || 0);
    todayC += Number(m.carbs || 0);
    todayF += Number(m.fat || 0);
    todayFiber += Number(m.fiber || 0);
  });

  const totalGrams = Math.max(1, todayP + todayC + todayF + todayFiber);
  const plateProteinPct = todayP + todayC + todayF > 0 ? Math.round((todayP / totalGrams) * 100) : 30;
  const plateCarbsPct = todayP + todayC + todayF > 0 ? Math.round((todayC / totalGrams) * 100) : 35;
  const plateVegFiberPct =
    todayP + todayC + todayF > 0
      ? Math.max(10, 100 - plateProteinPct - plateCarbsPct)
      : 35;

  useEffect(() => {
    const textColor = darkMode ? '#cbd5e1' : '#334155';
    const gridColor = darkMode ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.08)';

    Chart.defaults.font.family = "'Vazirmatn', system-ui, Tahoma, sans-serif";
    Chart.defaults.color = textColor;

    // 1. Weekly Calories Bar Chart
    const labels: string[] = [];
    const netCals: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const ds = addDaysStr(currentDate, -i);
      const { weekday, dayNum } = formatJalaliShortDay(ds);
      labels.push(`${weekday} ${dayNum}`);
      const dayObj = profile.days[ds];
      let c = 0;
      if (dayObj) {
        (dayObj.meals || []).forEach((m) => {
          c += Number(m.calories || 0);
        });
        (dayObj.exercises || []).forEach((e) => {
          c -= Number(e.caloriesBurned || 0);
        });
      }
      netCals.push(Math.max(0, Math.round(c)));
    }

    let chartWeekly: Chart | null = null;
    if (weeklyCanvasRef.current) {
      chartWeekly = new Chart(weeklyCanvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'کالری خالص دریافتی',
              data: netCals,
              backgroundColor: pal.hex,
              borderRadius: 10,
              maxBarThickness: 32,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { weight: 'bold', size: 11 } },
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { color: textColor, font: { size: 11 } },
            },
          },
        },
      });
    }

    // 2. Today Macros Doughnut Chart
    let chartMacros: Chart | null = null;
    if (macrosCanvasRef.current) {
      const hasData = todayP + todayC + todayF > 0;
      chartMacros = new Chart(macrosCanvasRef.current, {
        type: 'doughnut',
        data: {
          labels: ['پروتئین (گرم)', 'کربوهیدرات (گرم)', 'چربی (گرم)'],
          datasets: [
            {
              data: hasData ? [Math.round(todayP), Math.round(todayC), Math.round(todayF)] : [30, 45, 25],
              backgroundColor: ['#f43f5e', '#f59e0b', '#10b981'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: textColor, padding: 14, font: { size: 11, weight: 'bold' } },
            },
          },
        },
      });
    }

    // 3. Weight Trend Line Chart
    const wh = (profile.weightHistory || []).slice(-10);
    const weightItems = wh.length > 0 ? wh : [{ date: getTodayStr(), weight: profile.stats.weight }];
    let chartWeight: Chart | null = null;
    if (weightCanvasRef.current) {
      chartWeight = new Chart(weightCanvasRef.current, {
        type: 'line',
        data: {
          labels: weightItems.map((x) => {
            const { weekday, dayNum } = formatJalaliShortDay(x.date);
            return `${weekday} ${dayNum}`;
          }),
          datasets: [
            {
              label: 'وزن (کیلوگرم)',
              data: weightItems.map((x) => x.weight),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.14)',
              borderWidth: 3,
              pointRadius: 4,
              pointBackgroundColor: '#10b981',
              tension: 0.35,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { size: 11 } },
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { size: 11 } },
            },
          },
        },
      });
    }

    return () => {
      if (chartWeekly) chartWeekly.destroy();
      if (chartMacros) chartMacros.destroy();
      if (chartWeight) chartWeight.destroy();
    };
  }, [profile, currentDate, darkMode, pal.hex, todayP, todayC, todayF]);

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>میانگین روزانه (۷ روز)</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{avgDailyCal}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">kcal</span>
          </div>
        </div>

        <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>کالری سوزانده‌شده (هفته)</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{totalWeekBurned}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">kcal</span>
          </div>
        </div>

        <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>وزن فعلی به هدف</span>
            <Scale className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{profile.stats.weight}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              از {profile.stats.targetWeight} kg
            </span>
          </div>
        </div>

        <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>خروجی اکسل تغذیه</span>
            <TrendingDown className="w-4 h-4 text-indigo-500" />
          </div>
          <button
            type="button"
            onClick={onExportCSV}
            className="mt-2 w-full min-h-[40px] rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:opacity-90 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>دانلود گزارش CSV</span>
          </button>
        </div>
      </div>

      {/* Visual Healthy Plate Breakdown + Macros Doughnut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Visual Plate Breakdown (Suggestion #2) */}
        <div className="lg:col-span-6 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-500" />
                <span>الگوی بصری بشقاب سالم امروز</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                مقایسه تعادل بشقاب شما با استاندارد بشقاب سالم (نصف سبزیجات/فیبر، یک‌چهارم پروتئین، یک‌چهارم غلات)
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-auto py-2">
            {/* Interactive SVG Healthy Plate Graphic */}
            <div className="relative w-44 h-44 rounded-full p-2.5 bg-slate-100 dark:bg-slate-800 shadow-inner flex items-center justify-center shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full rounded-full overflow-hidden -rotate-90">
                {/* Half Plate: Vegetables & Fiber */}
                <circle
                  cx="50"
                  cy="50"
                  r="25"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="50"
                  strokeDasharray={`${plateVegFiberPct * 1.57} 157`}
                  strokeDashoffset="0"
                />
                {/* Quarter Plate: Protein */}
                <circle
                  cx="50"
                  cy="50"
                  r="25"
                  fill="transparent"
                  stroke="#f43f5e"
                  strokeWidth="50"
                  strokeDasharray={`${plateProteinPct * 1.57} 157`}
                  strokeDashoffset={`-${plateVegFiberPct * 1.57}`}
                />
                {/* Quarter Plate: Carbs / Grains */}
                <circle
                  cx="50"
                  cy="50"
                  r="25"
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="50"
                  strokeDasharray={`${plateCarbsPct * 1.57} 157`}
                  strokeDashoffset={`-${(plateVegFiberPct + plateProteinPct) * 1.57}`}
                />
                <line x1="0" y1="50" x2="100" y2="50" stroke="white" strokeWidth="1.5" opacity="0.7" />
                <line x1="50" y1="50" x2="50" y2="100" stroke="white" strokeWidth="1.5" opacity="0.7" />
              </svg>
              <div className="absolute w-14 h-14 rounded-full bg-white dark:bg-slate-900 shadow flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-400">تعادل</span>
                <span className="text-xs font-black text-slate-900 dark:text-white">بشقاب</span>
              </div>
            </div>

            <div className="flex-1 space-y-3 text-xs w-full tabular-nums">
              <div className="p-2.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/50 flex items-center justify-between">
                <span className="font-extrabold text-rose-700 dark:text-rose-300">بخش پروتئین و عضله‌ساز</span>
                <span className="font-black text-rose-600 dark:text-rose-400">
                  {Math.round(todayP)}g ({plateProteinPct}%)
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 flex items-center justify-between">
                <span className="font-extrabold text-amber-700 dark:text-amber-300">بخش کربوهیدرات پیچیده</span>
                <span className="font-black text-amber-600 dark:text-amber-400">
                  {Math.round(todayC)}g ({plateCarbsPct}%)
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-between">
                <span className="font-extrabold text-emerald-700 dark:text-emerald-300">بخش چربی مفید و فیبر</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {Math.round(todayF + todayFiber)}g ({plateVegFiberPct}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Macros Doughnut Chart */}
        <div className="lg:col-span-6 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              ترکیب درشت‌مغذی‌های امروز (گرم)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              نسبت دقیق پروتئین، کربوهیدرات و چربی مصرف‌شده در روز انتخابی
            </p>
          </div>
          <div className="h-56 w-full">
            <canvas ref={macrosCanvasRef} />
          </div>
        </div>
      </div>

      {/* Weekly Calories & Weight Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                روند کالری خالص ۷ روز اخیر
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                کالری دریافتی منهای کالری سوزانده‌شده در ورزش (هدف روزانه: {profile.targets.calories} kcal)
              </p>
            </div>
          </div>
          <div className="h-60 w-full">
            <canvas ref={weeklyCanvasRef} />
          </div>
        </div>

        <div className="lg:col-span-6 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                نمودار تغییرات وزن
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                روند کاهش یا تثبیت وزن بر اساس ثبت‌های دوره‌ای شما
              </p>
            </div>
          </div>
          <div className="h-60 w-full">
            <canvas ref={weightCanvasRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
