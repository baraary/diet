import React, { useState } from 'react';
import { ColorKey, DesignStyle, UserProfile } from '../types';
import { COLOR_PALETTES } from '../data/recipesAndRoutines';
import {
  Scale,
  Target,
  Palette,
  Users,
  UserPlus,
  Link2,
  Trash2,
  Calculator,
  Cloud,
  KeyRound,
  ExternalLink,
  Copy,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface ProfileTabProps {
  profile: UserProfile;
  activeProfileKey: string;
  allProfiles: Record<string, UserProfile>;
  designStyle: DesignStyle;
  githubToken: string;
  gistId: string;
  onLogWeight: (weight: number) => void;
  onOpenOnboarding: () => void;
  onSetDesignStyle: (style: DesignStyle) => void;
  onSetUserColor: (color: ColorKey) => void;
  onSwitchUser: (profKey: string) => void;
  onCreateUser: (
    name: string,
    id: string,
    gender: 'male' | 'female',
    avatar: string,
    color: ColorKey,
    partnerId: string
  ) => void;
  onDeleteUser: (profKey: string) => void;
  onCopyInviteLink: (profKey: string) => void;
  onSaveCloudConfig: (token: string, gistId: string) => void;
  onCreateGistAuto: (token: string) => Promise<void>;
  showToast: (msg: string) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  activeProfileKey,
  allProfiles,
  designStyle,
  githubToken,
  gistId,
  onLogWeight,
  onOpenOnboarding,
  onSetDesignStyle,
  onSetUserColor,
  onSwitchUser,
  onCreateUser,
  onDeleteUser,
  onCopyInviteLink,
  onSaveCloudConfig,
  onCreateGistAuto,
  showToast,
}) => {
  const [newWeight, setNewWeight] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newUserGender, setNewUserGender] = useState<'male' | 'female'>('female');
  const [newUserAvatar, setNewUserAvatar] = useState('👩🏻');
  const [newUserColor, setNewUserColor] = useState<ColorKey>('emerald');
  const [newUserPartner, setNewUserPartner] = useState(activeProfileKey);

  // Cloud Sync & Token Recovery State
  const [localGithubToken, setLocalGithubToken] = useState(githubToken);
  const [localGistId, setLocalGistId] = useState(gistId);
  const [magicLinkToDecode, setMagicLinkToDecode] = useState('');
  const [recoveredKeys, setRecoveredKeys] = useState<{
    githubToken?: string;
    gistId?: string;
    geminiKey?: string;
  } | null>(null);
  const [isCreatingGist, setIsCreatingGist] = useState(false);

  const pal = COLOR_PALETTES[profile.color] || COLOR_PALETTES.indigo;

  const heightMeters = (profile.stats.height || 170) / 100;
  const bmi = Number((profile.stats.weight / (heightMeters * heightMeters)).toFixed(1));
  let bmiStatus = 'نرمال';
  if (bmi < 18.5) bmiStatus = 'کم‌وزن';
  else if (bmi >= 25 && bmi < 30) bmiStatus = 'اضافه‌وزن';
  else if (bmi >= 30) bmiStatus = 'چاقی';

  const startW = profile.stats.startWeight || profile.stats.weight;
  const targetW = profile.stats.targetWeight;
  const totalDiff = Math.abs(startW - targetW);
  const doneDiff = Math.abs(startW - profile.stats.weight);
  const progressPct = totalDiff > 0 ? Math.min(100, Math.round((doneDiff / totalDiff) * 100)) : 100;

  const handleWeightSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newWeight);
    if (!val || val < 25 || val > 260) return;
    onLogWeight(val);
    setNewWeight('');
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    onCreateUser(
      newUserName.trim(),
      newUserId.trim(),
      newUserGender,
      newUserAvatar.trim() || (newUserGender === 'male' ? '👨🏻' : '👩🏻'),
      newUserColor,
      newUserPartner
    );
    setNewUserName('');
    setNewUserId('');
  };

  // Decode old #magic=... link or scan localStorage to recover lost tokens
  const handleRecoverToken = () => {
    // 1. Check if user pasted a #magic=... link
    if (magicLinkToDecode.trim()) {
      try {
        const raw = magicLinkToDecode.trim();
        const idx = raw.indexOf('#magic=');
        const b64 = idx !== -1 ? raw.slice(idx + 7).split('&')[0] : raw;
        let decoded: any;
        try {
          decoded = JSON.parse(decodeURIComponent(escape(atob(b64))));
        } catch {
          decoded = JSON.parse(atob(b64));
        }
        if (decoded && (decoded.githubToken || decoded.gistId || decoded.geminiKey)) {
          setRecoveredKeys(decoded);
          if (decoded.githubToken) setLocalGithubToken(decoded.githubToken);
          if (decoded.gistId) setLocalGistId(decoded.gistId);
          onSaveCloudConfig(decoded.githubToken || localGithubToken, decoded.gistId || localGistId);
          showToast('🎉 توکن و شناسه دیتابیس از لینک دعوت قدیمی استخراج و ذخیره شد!');
          return;
        }
      } catch {
        showToast('فرمت لینک دعوت واردشده معتبر نبود');
        return;
      }
    }

    // 2. Scan browser localStorage for previous saved state
    try {
      const saved = localStorage.getItem('hootan_fatemeh_nutrition_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.config && (parsed.config.githubToken || parsed.config.gistId || parsed.config.geminiKey)) {
          setRecoveredKeys(parsed.config);
          if (parsed.config.githubToken) setLocalGithubToken(parsed.config.githubToken);
          if (parsed.config.gistId) setLocalGistId(parsed.config.gistId);
          onSaveCloudConfig(
            parsed.config.githubToken || localGithubToken,
            parsed.config.gistId || localGistId
          );
          showToast('🎉 کلیدهای ذخیره‌شده در حافظه مرورگر پیدا و بازیابی شدند!');
          return;
        }
      }
      showToast('در حافظه این مرورگر توکن قبلی یافت نشد؛ لینک دعوت قدیمی را در کادر بالا Paste کنید.');
    } catch {
      showToast('خطا در بررسی حافظه مرورگر');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Right Column: Weight Progress, Targets & Cloud Token Helper */}
      <div className="lg:col-span-6 space-y-5">
        <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-500" />
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                  مدیریت وزن و شاخص توده بدنی
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  BMI: {bmi} · وضعیت: {bmiStatus} · قد: {profile.stats.height} سانتی‌متر
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>محاسبه مجدد اهداف</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200/60 dark:border-slate-700/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">وزن شروع</div>
              <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums mt-1">
                {startW} <span className="text-xs font-normal">kg</span>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200/60 dark:border-slate-700/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">وزن فعلی</div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                {profile.stats.weight} <span className="text-xs font-normal">kg</span>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200/60 dark:border-slate-700/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">وزن هدف</div>
              <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums mt-1">
                {targetW} <span className="text-xs font-normal">kg</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              <span>پیشرفت به سمت وزن هدف</span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleWeightSubmit} className="flex gap-2 pt-1">
            <input
              type="number"
              step="0.1"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="ثبت وزن جدید (مثلاً 76.5)..."
              className="flex-1 min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3.5 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
            />
            <button
              type="button"
              onClick={handleWeightSubmit}
              style={{ backgroundColor: pal.hex }}
              className="min-h-[44px] px-5 rounded-xl text-white text-xs font-extrabold shadow-sm hover:opacity-95 transition cursor-pointer"
            >
              ثبت وزن جدید
            </button>
          </form>
        </div>

        {/* Daily Targets Summary */}
        <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-500" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
              بودجه تغذیه‌ای روزانه ({profile.name})
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center tabular-nums">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">کالری هدف</div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                {profile.targets.calories}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">پروتئین</div>
              <div className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {profile.targets.protein}g
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">کربوهیدرات</div>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {profile.targets.carbs}g
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">چربی</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {profile.targets.fat}g
              </div>
            </div>
          </div>
        </div>

        {/* Cloud Sync (GitHub Gist) & Token Recovery Assistant */}
        <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                دیتابیس ابری گیت‌هاب و بازیابی توکن فراموش‌شده
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                اتصال به GitHub Gist یا استخراج توکن از لینک‌های دعوت قدیمی (`#magic=...`)
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 space-y-2.5 text-xs">
            <div className="font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" />
              <span>توکن گیت‌هاب یا Gist ID خود را فراموش کرده‌اید؟</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              اگر قبلاً لینک دعوت (`#magic=...`) را برای کسی در تلگرام/واتساپ فرستاده‌اید، آن لینک را در کادر زیر Paste کنید تا توکن و Gist ID شما فوراً رمزگشایی و بازیابی شود:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                dir="ltr"
                value={magicLinkToDecode}
                onChange={(e) => setMagicLinkToDecode(e.target.value)}
                placeholder="https://diet-gold.vercel.app/#magic=ey..."
                className="flex-1 min-h-[40px] rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 text-xs font-mono text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleRecoverToken}
                className="min-h-[40px] px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shrink-0 transition cursor-pointer"
              >
                استخراج توکن
              </button>
            </div>

            {recoveredKeys && (
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 space-y-1.5 font-mono text-[11px]" dir="ltr">
                <div className="text-emerald-600 dark:text-emerald-400 font-sans font-bold" dir="rtl">
                  ✅ اطلاعات استخراج‌شده شما:
                </div>
                {recoveredKeys.githubToken && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">GitHub Token: {recoveredKeys.githubToken}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(recoveredKeys.githubToken || '');
                        showToast('توکن گیت‌هاب کپی شد');
                      }}
                      className="p-1 text-indigo-500 hover:text-indigo-600 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {recoveredKeys.gistId && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">Gist ID: {recoveredKeys.gistId}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(recoveredKeys.gistId || '');
                        showToast('شناسه Gist کپی شد');
                      }}
                      className="p-1 text-indigo-500 hover:text-indigo-600 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
              <a
                href="https://github.com/settings/tokens/new?description=DietApp&scopes=gist"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                <span>ساخت توکن جدید در گیت‌هاب (فقط تیک gist)</span>
              </a>
              <span>·</span>
              <a
                href="https://gist.github.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                <span>مشاهده لیست Gistهای من</span>
              </a>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                توکن گیت‌هاب (GitHub Personal Access Token - ghp_...)
              </label>
              <input
                type="password"
                dir="ltr"
                value={localGithubToken}
                onChange={(e) => setLocalGithubToken(e.target.value)}
                placeholder="ghp_..."
                className="w-full min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-mono text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-slate-700 dark:text-slate-300">
                شناسه دیتابیس ابری (Gist ID)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={localGistId}
                  onChange={(e) => setLocalGistId(e.target.value)}
                  placeholder="شناسه Gist..."
                  className="flex-1 min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-mono text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  disabled={isCreatingGist}
                  onClick={async () => {
                    setIsCreatingGist(true);
                    try {
                      await onCreateGistAuto(localGithubToken);
                    } finally {
                      setIsCreatingGist(false);
                    }
                  }}
                  className="min-h-[42px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-1.5 shrink-0 transition cursor-pointer disabled:opacity-60"
                >
                  {isCreatingGist ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>ساخت خودکار Gist</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSaveCloudConfig(localGithubToken, localGistId)}
              style={{ backgroundColor: pal.hex }}
              className="w-full min-h-[44px] rounded-xl text-white font-extrabold shadow-sm hover:opacity-95 transition cursor-pointer"
            >
              ذخیره و همگام‌سازی با گیت‌هاب
            </button>
          </div>
        </div>
      </div>

      {/* Left Column: Theme Personalization & Family/Partner Multi-User Management */}
      <div className="lg:col-span-6 space-y-5">
        {/* Theme & Style */}
        <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-violet-500" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
              شخصی‌سازی ظاهر و پالت رنگی
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            {(
              [
                {
                  id: 'glass',
                  label: 'شیشه‌ای نئونی',
                  desc: 'کارت‌های کریستالی مات با هاله نوری هم‌رنگ پروفایل',
                },
                {
                  id: 'material',
                  label: 'متریال پویا (Tonal)',
                  desc: 'سطوح و پس‌زمینه رنگی یکپارچه بدون سایه',
                },
                {
                  id: 'classic',
                  label: 'کلاسیک کنتراست بالا',
                  desc: 'کادرهای هندسی تیز با سایه سخت و نقطه چین',
                },
              ] as const
            ).map((st) => {
              const isSel = designStyle === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onSetDesignStyle(st.id)}
                  style={
                    isSel
                      ? {
                          borderColor: pal.hex,
                          backgroundColor: `${pal.hex}15`,
                        }
                      : undefined
                  }
                  className={`min-h-[68px] p-3 rounded-2xl text-right border-2 transition flex flex-col justify-between cursor-pointer ${
                    isSel
                      ? 'text-slate-900 dark:text-white shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold">{st.label}</span>
                    {isSel && (
                      <span
                        style={{ backgroundColor: pal.hex }}
                        className="w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-black"
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] opacity-80 leading-snug mt-1">{st.desc}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">رنگ اختصاصی پروفایل شما:</span>
              <span className="text-slate-500 dark:text-slate-400">{pal.label}</span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
              {(Object.keys(COLOR_PALETTES) as ColorKey[]).map((ck) => {
                const cObj = COLOR_PALETTES[ck];
                const isSelected = profile.color === ck;
                return (
                  <button
                    key={ck}
                    type="button"
                    onClick={() => onSetUserColor(ck)}
                    title={cObj.label}
                    style={{ backgroundColor: cObj.hex }}
                    className={`h-9 rounded-xl transition flex items-center justify-center text-white text-xs font-bold cursor-pointer ${
                      isSelected ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-105' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    {isSelected ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Family / Partner Profiles & Safe Invite Links */}
        <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-500" />
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                پروفایل‌های خانواده و لینک دعوت امن
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                سوییچ سریع بین کاربران یا کپی لینک دعوت بدون افشای کلیدهای امنیتی در آدرس
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {Object.keys(allProfiles).map((k) => {
              const p = allProfiles[k];
              const isCurrent = k === activeProfileKey;
              const pPal = COLOR_PALETTES[p.color] || COLOR_PALETTES.indigo;
              const canDelete = Object.keys(allProfiles).length > 1 && !isCurrent;

              return (
                <div
                  key={k}
                  className={`flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl border ${
                    isCurrent
                      ? 'bg-slate-100/90 dark:bg-slate-800/90 border-slate-400 dark:border-slate-600'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      style={{ backgroundColor: pPal.hex }}
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl text-white shadow-sm"
                    >
                      {p.avatar || '👤'}
                    </span>
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        هدف: {p.targets.calories} kcal · تم: {pPal.label}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => onSwitchUser(k)}
                        className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-extrabold text-slate-800 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
                      >
                        انتخاب
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCopyInviteLink(k)}
                      style={{ backgroundColor: pPal.hex }}
                      className="min-h-[38px] px-3 rounded-xl text-white text-xs font-extrabold flex items-center gap-1 shadow-sm hover:opacity-95 transition cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>لینک دعوت امن</span>
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDeleteUser(k)}
                        aria-label="حذف پروفایل"
                        className="min-h-[38px] min-w-[38px] rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center hover:bg-rose-100 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleAddUser} className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-300">
              <UserPlus className="w-4 h-4" />
              <span>افزودن پروفایل جدید (عضو خانواده / شریک غذایی)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="نام (مثلاً: سارا)"
                className="min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                dir="ltr"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="شناسه انگلیسی (sara)"
                className="min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 text-slate-900 dark:text-slate-100 font-mono"
              />
              <select
                value={newUserGender}
                onChange={(e) => {
                  const g = e.target.value as 'male' | 'female';
                  setNewUserGender(g);
                  setNewUserAvatar(g === 'male' ? '👨🏻' : '👩🏻');
                }}
                className="min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-bold text-slate-900 dark:text-slate-100"
              >
                <option value="female">زن 👩🏻</option>
                <option value="male">مرد 👨🏻</option>
              </select>
              <input
                type="text"
                value={newUserAvatar}
                onChange={(e) => setNewUserAvatar(e.target.value)}
                placeholder="ایموجی آواتار"
                className="min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 text-center"
              />
              <select
                value={newUserColor}
                onChange={(e) => setNewUserColor(e.target.value as ColorKey)}
                className="min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-bold text-slate-900 dark:text-slate-100"
              >
                {(Object.keys(COLOR_PALETTES) as ColorKey[]).map((ck) => (
                  <option key={ck} value={ck}>
                    {COLOR_PALETTES[ck].label}
                  </option>
                ))}
              </select>
              <select
                value={newUserPartner}
                onChange={(e) => setNewUserPartner(e.target.value)}
                className="min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 font-bold text-slate-900 dark:text-slate-100"
              >
                <option value="">بدون شریک پیش‌فرض</option>
                {Object.keys(allProfiles).map((k) => (
                  <option key={k} value={k}>
                    شریک با {allProfiles[k].name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition cursor-pointer"
            >
              ساخت پروفایل جدید
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
