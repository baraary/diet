import React, { useState } from 'react';
import { HealthyRecipe, MealCategory, UserProfile } from '../types';
import { DEFAULT_HEALTHY_RECIPES, HEALTHY_TIPS, COLOR_PALETTES } from '../data/recipesAndRoutines';
import {
  ChefHat,
  Heart,
  Clock,
  Plus,
  BookmarkPlus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Loader2,
} from 'lucide-react';

interface KitchenTabProps {
  profile: UserProfile;
  currentDate: string;
  onLogRecipeToToday: (recipe: HealthyRecipe) => void;
  onAddRecipeToRoutine: (recipe: HealthyRecipe) => void;
  onToggleFavoriteRecipe: (recipeId: string) => void;
  onAddCustomRecipe: (recipe: HealthyRecipe) => void;
  showToast: (msg: string) => void;
}

export const KitchenTab: React.FC<KitchenTabProps> = ({
  profile,
  currentDate,
  onLogRecipeToToday,
  onAddRecipeToRoutine,
  onToggleFavoriteRecipe,
  onAddCustomRecipe,
  showToast,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'همه' | MealCategory>('همه');
  const [favCategory, setFavCategory] = useState<'همه' | MealCategory>('همه');
  const [tipIndex, setTipIndex] = useState(0);
  const [seedOffset, setSeedOffset] = useState(0);
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [expandedRecipeIds, setExpandedRecipeIds] = useState<Record<string, boolean>>({});
  const [ingredientsInput, setIngredientsInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const pal = COLOR_PALETTES[profile.color] || COLOR_PALETTES.indigo;
  const allRecipes: HealthyRecipe[] = [...(profile.customRecipes || []), ...DEFAULT_HEALTHY_RECIPES];
  const favIds = profile.favoriteRecipeIds || [];

  const getDateSeed = () => {
    const s = `${currentDate}_${seedOffset}`;
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const getDailyCurated = (): HealthyRecipe[] => {
    if (showAllRecipes) {
      return selectedCategory === 'همه'
        ? allRecipes
        : allRecipes.filter((r) => r.category === selectedCategory);
    }
    const seed = getDateSeed();
    const cats: MealCategory[] =
      selectedCategory === 'همه' ? ['صبحانه', 'ناهار', 'شام', 'میان‌وعده'] : [selectedCategory];
    const picked: HealthyRecipe[] = [];

    cats.forEach((cat, cIdx) => {
      const pool = allRecipes.filter((r) => r.category === cat);
      if (pool.length <= 2) {
        picked.push(...pool);
      } else {
        const idx1 = (seed + cIdx * 7) % pool.length;
        const idx2 = (idx1 + 1 + ((seed >> 2) % (pool.length - 1))) % pool.length;
        picked.push(pool[idx1], pool[idx2]);
      }
    });
    return picked;
  };

  const toggleExpand = (id: string) => {
    setExpandedRecipeIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGenerateAiRecipe = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/gemini/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: ingredientsInput.trim(),
          category: selectedCategory === 'همه' ? 'ناهار یا شام' : selectedCategory,
          targetCalories: Math.round((profile.targets.calories || 1800) * 0.28),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در ساخت رسپی');

      const validCats: MealCategory[] = ['صبحانه', 'ناهار', 'شام', 'میان‌وعده'];
      const cat: MealCategory = validCats.includes(data.category) ? data.category : 'ناهار';

      const newRec: HealthyRecipe = {
        id: 'custom_' + Date.now(),
        category: cat,
        title: data.title || 'رسپی ویژه سرآشپز هوشمند',
        prepTime: data.prepTime || '۲۰ دقیقه',
        calories: Math.round(Number(data.calories) || 320),
        protein: Math.round((Number(data.protein) || 25) * 10) / 10,
        carbs: Math.round((Number(data.carbs) || 30) * 10) / 10,
        fat: Math.round((Number(data.fat) || 9) * 10) / 10,
        fiber: Math.round((Number(data.fiber) || 4) * 10) / 10,
        ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        steps: Array.isArray(data.steps) ? data.steps : [],
        healthTip: data.healthTip || 'طراحی‌شده بر اساس مواد اولیه در دسترس شما.',
        isCustom: true,
      };

      onAddCustomRecipe(newRec);
      setExpandedRecipeIds((prev) => ({ ...prev, [newRec.id]: true }));
      setIngredientsInput('');
      showToast(`رسپی «${newRec.title}» ساخته شد و به علاقه‌مندی‌ها اضافه گردید!`);
    } catch (err: any) {
      showToast(err.message || 'خطا در ارتباط با سرآشپز هوشمند');
    } finally {
      setIsGenerating(false);
    }
  };

  const favoriteRecipes = allRecipes.filter(
    (r) => favIds.includes(r.id) && (favCategory === 'همه' || r.category === favCategory)
  );
  const dailyRecipes = getDailyCurated();

  const renderRecipeCard = (rec: HealthyRecipe) => {
    const isFav = favIds.includes(rec.id);
    const isOpen = !!expandedRecipeIds[rec.id];

    return (
      <div
        key={rec.id}
        className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 p-4 transition-all space-y-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 leading-snug">
              {rec.title}
            </h4>
            {/* Zero-Pill Metadata Discipline: Clean unboxed text with separators */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{rec.category}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {rec.prepTime}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-slate-900 dark:text-white">{rec.calories} kcal</span>
              <span aria-hidden="true">·</span>
              <span>پروتئین {rec.protein}g</span>
              <span aria-hidden="true">·</span>
              <span>کربوهیدرات {rec.carbs}g</span>
              <span aria-hidden="true">·</span>
              <span>چربی {rec.fat}g</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onToggleFavoriteRecipe(rec.id)}
            aria-label="نشان کردن رسپی"
            className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center border transition shrink-0 cursor-pointer ${
              isFav
                ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => toggleExpand(rec.id)}
            className="min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <span>{isOpen ? 'بستن دستور پخت' : 'مواد لازم و طرز تهیه'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAddRecipeToRoutine(rec)}
              className="min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="افزودن به روتین‌های ثابت"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>افزودن به روتین</span>
            </button>
            <button
              type="button"
              onClick={() => onLogRecipeToToday(rec)}
              style={{ backgroundColor: pal.hex }}
              className="min-h-[40px] px-3.5 rounded-xl text-white text-xs font-extrabold flex items-center gap-1 shadow-sm hover:opacity-95 active:scale-95 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت در وعده امروز</span>
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 space-y-3 text-xs leading-relaxed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-extrabold text-slate-900 dark:text-slate-100 mb-1.5">
                  مواد لازم (برای ۱ نفر):
                </div>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300 list-disc list-inside">
                  {rec.ingredients.map((ing, i) => (
                    <li key={i}>{ing}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-extrabold text-slate-900 dark:text-slate-100 mb-1.5">
                  مراحل آماده‌سازی:
                </div>
                <ol className="space-y-1.5 text-slate-600 dark:text-slate-300 list-decimal list-inside">
                  {rec.steps.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ol>
              </div>
            </div>
            {rec.healthTip && (
              <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs">
                <span className="font-extrabold ml-1">نکته تغذیه‌ای:</span>
                <span>{rec.healthTip}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Grid: Fridge AI Chef + Daily Tip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                سرآشپز هوشمند (طراحی رسپی با مواد داخل یخچال)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              مواد اولیه‌ای که در خانه دارید را بنویسید تا یک غذای سالم، کم‌روغن و دقیقاً متناسب با کالری هدف شما ساخته شود.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={ingredientsInput}
              onChange={(e) => setIngredientsInput(e.target.value)}
              placeholder="مثلاً: سینه مرغ، قارچ، کدو سبز، سیب‌زمینی... (یا خالی بگذارید)"
              className="flex-1 min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateAiRecipe}
              style={{ backgroundColor: pal.hex }}
              className="min-h-[44px] px-5 rounded-xl text-white text-xs sm:text-sm font-extrabold shadow-sm flex items-center justify-center gap-2 shrink-0 hover:opacity-95 active:scale-95 transition cursor-pointer disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال طراحی...</span>
                </>
              ) : (
                <>
                  <ChefHat className="w-4 h-4" />
                  <span>ساخت رسپی سالم</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                نکته طلایی سالم‌خوری روز
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setTipIndex((prev) => (prev + 1) % HEALTHY_TIPS.length)}
              className="min-h-[36px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              نکته بعدی
            </button>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 my-auto">
            {HEALTHY_TIPS[tipIndex]}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
            نکته {tipIndex + 1} از {HEALTHY_TIPS.length}
          </div>
        </div>
      </div>

      {/* Curated Daily Recipes */}
      <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
              {showAllRecipes ? 'بانک کامل دستور پخت‌های رژیمی (۲۴+ رسپی)' : 'پیشنهادهای منتخب امروز برای شما'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              با یک لمس می‌توانید هر رسپی را مستقیم در وعده‌های امروز ثبت کنید یا به روتین اضافه نمایید
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAllRecipes((prev) => !prev)}
              className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              {showAllRecipes ? 'نمایش منتخب روزانه (۸ مورد)' : `نمایش همه (${allRecipes.length} رسپی)`}
            </button>
            <button
              type="button"
              onClick={() => {
                setSeedOffset((prev) => prev + 1);
                showToast('پیشنهادهای روزانه جابجا شدند');
              }}
              className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تغییر پیشنهادها</span>
            </button>
          </div>
        </div>

        {/* Interactive Filter Controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
          {(['همه', 'صبحانه', 'ناهار', 'شام', 'میان‌وعده'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {dailyRecipes.map((rec) => renderRecipeCard(rec))}
        </div>
      </div>

      {/* Favorites Vault */}
      <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500 fill-current" />
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                جعبه رسپی‌های مورد علاقه من ({favIds.length} مورد)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                غذاهای سالمی که نشان کرده‌اید یا با سرآشپز هوشمند ساخته‌اید
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
            {(['همه', 'صبحانه', 'ناهار', 'شام', 'میان‌وعده'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFavCategory(cat)}
                className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                  favCategory === cat
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {favoriteRecipes.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            هنوز رسپی‌ای در این دسته نشان نکرده‌اید. روی آیکون قلب کنار هر دستور پخت بزنید تا اینجا ذخیره شود.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {favoriteRecipes.map((rec) => renderRecipeCard(rec))}
          </div>
        )}
      </div>
    </div>
  );
};
