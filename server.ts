import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

function getAiClient(customApiKey?: string) {
  const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('کلید هوش مصنوعی یافت نشد. لطفاً در تنظیمات یا پنل Secrets کلید را بررسی کنید.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Resilient Multi-Model Gemini Caller (handles 503 High Demand spikes automatically)
async function generateStructuredJson(
  contents: any,
  responseSchema: any,
  customApiKey?: string
): Promise<any> {
  const ai = getAiClient(customApiKey);
  const candidateModels = [
    { name: 'gemini-3.1-flash-lite', useLowThinking: false },
    { name: 'gemini-3.8-flash', useLowThinking: true },
  ];

  let lastError: any = null;
  for (const candidate of candidateModels) {
    try {
      const config: any = {
        responseMimeType: 'application/json',
        responseSchema,
      };
      if (candidate.useLowThinking) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const response = await ai.models.generateContent({
        model: candidate.name,
        contents,
        config,
      });

      const rawText = (response.text ?? '{}')
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(rawText);
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${candidate.name} failed (${err?.status || err?.message}), trying next fallback...`);
    }
  }

  throw lastError || new Error('خطا در ارتباط با سرور هوش مصنوعی');
}

// 1. Analyze Food (Text + Optional Photo) with Guaranteed Structured JSON
app.post('/api/gemini/analyze-food', async (req, res) => {
  try {
    const { text, imageBase64, mimeType, category, customApiKey } = req.body || {};
    if (!text && !imageBase64) {
      return res.status(400).json({ error: 'لطفاً توضیح غذا یا تصویر آن را ارسال کنید.' });
    }

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      });
    }

    const promptText = [
      'تو یک متخصص تغذیه دقیق مسلط به غذاهای ایرانی، بین‌المللی و پیمانه‌های خانگی ایرانی (قاشق، کف دست، لیوان، پیاله، سیخ، قوطی کبریت) هستی.',
      `وعده انتخابی کاربر: ${category || 'وعده غذایی'}`,
      `ورودی کاربر: ${text || 'تحلیل تصویر پیوست‌شده از غذا و تخمین دقیق کالری و درشت‌مغذی‌های آن'}`,
      'مقادیر کالری، پروتئین، کربوهیدرات، چربی، فیبر، قند و سدیم را با دقت بالا محاسبه کن و یک امتیاز سلامتی از ۱ تا ۱۰ به همراه یک نکته تغذیه‌ای کوتاه و کاربردی به فارسی برگردان.',
    ].join('\n');

    parts.push({ text: promptText });

    const parsed = await generateStructuredJson(
      { parts },
      {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'نام خلاصه، دقیق و تمیز غذا و مقدار آن به فارسی (مثلاً: ۸ قاشق چلو و ۱ سیخ جوجه‌کباب)',
          },
          calories: { type: Type.NUMBER, description: 'مجموع کالری به kcal' },
          protein: { type: Type.NUMBER, description: 'پروتئین به گرم' },
          carbs: { type: Type.NUMBER, description: 'کربوهیدرات به گرم' },
          fat: { type: Type.NUMBER, description: 'چربی به گرم' },
          fiber: { type: Type.NUMBER, description: 'فیبر به گرم' },
          sugar: { type: Type.NUMBER, description: 'قند به گرم' },
          sodium: { type: Type.NUMBER, description: 'سدیم به میلی‌گرم' },
          score: { type: Type.NUMBER, description: 'امتیاز ارزش غذایی از 1 تا 10' },
          tip: {
            type: Type.STRING,
            description: 'یک نکته تغذیه‌ای کوتاه، علمی و دوستانه یک‌خطی به فارسی درباره این وعده',
          },
        },
        required: ['title', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'score', 'tip'],
      },
      customApiKey
    );

    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze-food:', error);
    return res.status(500).json({
      error: error?.message || 'خطا در تحلیل هوشمند وعده غذایی',
    });
  }
});

// 2. Analyze Exercise & Burned Calories
app.post('/api/gemini/analyze-exercise', async (req, res) => {
  try {
    const { text, weight, customApiKey } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: 'لطفاً شرح فعالیت ورزشی را وارد کنید.' });
    }

    const parsed = await generateStructuredJson(
      `کاربر با وزن ${weight || 75} کیلوگرم این فعالیت ورزشی را انجام داده است: "${text}". کالری سوزانده‌شده، مدت زمان به دقیقه و عنوان تمیز فعالیت را به فارسی محاسبه کن.`,
      {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'عنوان خلاصه و تمیز ورزش به فارسی' },
          durationMinutes: { type: Type.NUMBER, description: 'مدت زمان فعالیت به دقیقه' },
          caloriesBurned: { type: Type.NUMBER, description: 'مقدار کالری سوزانده‌شده (kcal)' },
        },
        required: ['title', 'durationMinutes', 'caloriesBurned'],
      },
      customApiKey
    );

    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze-exercise:', error);
    return res.status(500).json({
      error: error?.message || 'خطا در محاسبه کالری ورزش',
    });
  }
});

// 3. Smart Recommendation: "What Should I Eat Now?"
app.post('/api/gemini/what-to-eat', async (req, res) => {
  try {
    const {
      remainingCalories,
      remainingProtein,
      remainingCarbs,
      remainingFat,
      currentHour,
      eatenMeals,
      goal,
      customApiKey,
    } = req.body || {};

    const prompt = [
      'تو یک مشاور تغذیه هوشمند ایرانی هستی.',
      `ساعت فعلی روز: ${currentHour ?? new Date().getHours()}:00`,
      `هدف کاربر: ${goal || 'کاهش وزن اصولی'}`,
      `کالری باقی‌مانده امروز: ${remainingCalories} kcal`,
      `پروتئین باقی‌مانده: ${remainingProtein}g | کربوهیدرات باقی‌مانده: ${remainingCarbs}g | چربی باقی‌مانده: ${remainingFat}g`,
      `غذاهای خورده‌شده امروز: ${(eatenMeals || []).join('، ') || 'هنوز وعده‌ای ثبت نشده است'}`,
      'بر اساس ساعت روز و بودجه کالری و ماکروهای باقی‌مانده، ۳ گزینه غذایی ایرانی، در دسترس و خوشمزه پیشنهاد بده که دقیقاً با نیاز باقی‌مانده امروز کاربر هماهنگ باشد.',
    ].join('\n');

    const parsed = await generateStructuredJson(
      prompt,
      {
        type: Type.OBJECT,
        properties: {
          summaryAdvice: {
            type: Type.STRING,
            description: 'تحلیل کوتاه ۱ تا ۲ جمله‌ای از وضعیت فعلی بدن کاربر در این ساعت از روز',
          },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'نام پیشنهاد غذایی و مقدار دقیق به پیمانه ایرانی' },
                category: { type: Type.STRING, description: 'صبحانه، ناهار، شام یا میان‌وعده' },
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fat: { type: Type.NUMBER },
                fiber: { type: Type.NUMBER },
                reason: { type: Type.STRING, description: 'چرا این گزینه الان برای کاربر عالی است؟' },
              },
              required: ['title', 'category', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'reason'],
            },
          },
        },
        required: ['summaryAdvice', 'suggestions'],
      },
      customApiKey
    );

    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/what-to-eat:', error);
    return res.status(500).json({
      error: error?.message || 'خطا در دریافت پیشنهاد هوشمند',
    });
  }
});

// 4. Smart Fridge Chef: Generate Healthy Recipe from Ingredients
app.post('/api/gemini/generate-recipe', async (req, res) => {
  try {
    const { ingredients, category, targetCalories, customApiKey } = req.body || {};

    const prompt = [
      'تو یک سرآشپز رژیمی و متخصص تغذیه ایرانی هستی.',
      ingredients
        ? `کاربر این مواد اولیه را در یخچال/منزل دارد: "${ingredients}". با استفاده از این مواد (و ادویه‌ها/مواد پایه معمول خانه) یک غذای بسیار خوشمزه، سالم، کم‌روغن و پرپروتئین طراحی کن.`
        : `یک دستور پخت خلاقانه، سالم، سریع و پرپروتئین ایرانی برای وعده «${category || 'ناهار یا شام'}» (حدود ${targetCalories || 350} کالری) طراحی کن.`,
    ].join('\n');

    const parsed = await generateStructuredJson(
      prompt,
      {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'نام جذاب غذای رژیمی به فارسی' },
          category: { type: Type.STRING, description: 'یکی از مقادیر: صبحانه، ناهار، شام، میان‌وعده' },
          prepTime: { type: Type.STRING, description: 'زمان آماده‌سازی به فارسی (مثلاً ۱۵ دقیقه)' },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fat: { type: Type.NUMBER },
          fiber: { type: Type.NUMBER },
          ingredients: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'لیست مواد لازم با مقادیر دقیق به پیمانه خانگی',
          },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'مراحل پخت گام‌به‌گام و خلاصه',
          },
          healthTip: {
            type: Type.STRING,
            description: 'نکته طلایی تغذیه‌ای درباره این رسپی',
          },
        },
        required: [
          'title',
          'category',
          'prepTime',
          'calories',
          'protein',
          'carbs',
          'fat',
          'fiber',
          'ingredients',
          'steps',
          'healthTip',
        ],
      },
      customApiKey
    );

    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/generate-recipe:', error);
    return res.status(500).json({
      error: error?.message || 'خطا در طراحی رسپی هوشمند',
    });
  }
});

// 5. Smart Cloud / Server Sync with ID-level Merge (Prevents Race Conditions)
const SYNC_FILE_PATH = process.env.VERCEL
  ? '/tmp/.cloud-sync-db.json'
  : path.join(__dirname, '.cloud-sync-db.json');

function mergeProfilesSmart(existingProf: any, incomingProf: any) {
  if (!existingProf) return incomingProf;
  if (!incomingProf) return existingProf;

  const merged = {
    ...existingProf,
    ...incomingProf,
    stats: { ...(existingProf.stats || {}), ...(incomingProf.stats || {}) },
    targets: { ...(existingProf.targets || {}), ...(incomingProf.targets || {}) },
    days: { ...(existingProf.days || {}) },
  };

  const incomingDays = incomingProf.days || {};
  for (const dateKey of Object.keys(incomingDays)) {
    const exDay = merged.days[dateKey] || { water: 0, meals: [], exercises: [], deletedIds: [] };
    const inDay = incomingDays[dateKey] || { water: 0, meals: [], exercises: [], deletedIds: [] };

    const deletedSet = new Set<string>([
      ...(Array.isArray(exDay.deletedIds) ? exDay.deletedIds : []),
      ...(Array.isArray(inDay.deletedIds) ? inDay.deletedIds : []),
    ]);

    const mealMap = new Map<string, any>();
    for (const m of exDay.meals || []) {
      if (m && m.id && !deletedSet.has(m.id)) mealMap.set(m.id, m);
    }
    for (const m of inDay.meals || []) {
      if (m && m.id) {
        if (m._deleted || deletedSet.has(m.id)) {
          deletedSet.add(m.id);
          mealMap.delete(m.id);
        } else {
          const prev = mealMap.get(m.id);
          if (!prev || (m.updatedAt || 0) >= (prev.updatedAt || 0)) {
            mealMap.set(m.id, m);
          }
        }
      }
    }

    const mergedMeals = Array.from(mealMap.values()).filter(
      (m) => !m._deleted && !deletedSet.has(m.id)
    );

    const exMap = new Map<string, any>();
    for (const e of exDay.exercises || []) {
      if (e && e.id && !deletedSet.has(e.id)) exMap.set(e.id, e);
    }
    for (const e of inDay.exercises || []) {
      if (e && e.id) {
        if (e._deleted || deletedSet.has(e.id)) {
          deletedSet.add(e.id);
          exMap.delete(e.id);
        } else {
          exMap.set(e.id, e);
        }
      }
    }
    const mergedExercises = Array.from(exMap.values()).filter(
      (e) => !e._deleted && !deletedSet.has(e.id)
    );

    const exWaterTime = Number(exDay.waterUpdatedAt || 0);
    const inWaterTime = Number(inDay.waterUpdatedAt || 0);
    let mergedWater = Number(inDay.water ?? exDay.water ?? 0);
    if (exWaterTime > 0 || inWaterTime > 0) {
      mergedWater = inWaterTime >= exWaterTime ? Number(inDay.water || 0) : Number(exDay.water || 0);
    }

    merged.days[dateKey] = {
      water: mergedWater,
      waterUpdatedAt: Math.max(exWaterTime, inWaterTime),
      meals: mergedMeals,
      exercises: mergedExercises,
      deletedIds: Array.from(deletedSet),
    };
  }

  return merged;
}

app.post('/api/sync', async (req, res) => {
  try {
    const { action, profiles, githubToken: clientGithubToken, gistId: clientGistId } = req.body || {};
    let currentDb: Record<string, any> = {};

    if (fs.existsSync(SYNC_FILE_PATH)) {
      try {
        currentDb = JSON.parse(fs.readFileSync(SYNC_FILE_PATH, 'utf-8'));
      } catch {
        currentDb = {};
      }
    }

    const githubToken = (clientGithubToken && clientGithubToken.trim()) || process.env.GITHUB_TOKEN;
    const gistId = (clientGistId && clientGistId.trim()) || process.env.GIST_ID;

    // Always pull latest state from GitHub Gist first (crucial for 4+ users on Vercel Serverless)
    if (githubToken && gistId) {
      try {
        const gistRes = await fetch(`https://api.github.com/gists/${gistId}`, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
          },
        });
        if (gistRes.ok) {
          const gistData: any = await gistRes.json();
          if (gistData.files) {
            // 1. Support legacy single-file nutrition_db.json if present
            if (gistData.files['nutrition_db.json']?.content) {
              try {
                const legacyDb = JSON.parse(gistData.files['nutrition_db.json'].content);
                const legacyProfiles = legacyDb.profiles || legacyDb;
                if (legacyProfiles && typeof legacyProfiles === 'object') {
                  for (const k of Object.keys(legacyProfiles)) {
                    if (legacyProfiles[k] && typeof legacyProfiles[k] === 'object' && legacyProfiles[k].days) {
                      currentDb[k] = mergeProfilesSmart(currentDb[k], legacyProfiles[k]);
                    }
                  }
                }
              } catch {
                // Ignore malformed legacy file
              }
            }

            // 2. Support per-user files: nutrition_<userKey>.json (used by v3/v4 multi-user architecture)
            for (const fileName of Object.keys(gistData.files)) {
              if (
                fileName.startsWith('nutrition_') &&
                fileName.endsWith('.json') &&
                fileName !== 'nutrition_db.json'
              ) {
                const profKey = fileName.slice('nutrition_'.length, -5);
                const rawContent = gistData.files[fileName]?.content;
                if (profKey && rawContent) {
                  try {
                    currentDb[profKey] = mergeProfilesSmart(currentDb[profKey], JSON.parse(rawContent));
                  } catch {
                    // Ignore malformed user file
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Optional Gist pull skipped:', e);
      }
    }

    if (profiles && typeof profiles === 'object') {
      for (const k of Object.keys(profiles)) {
        currentDb[k] = mergeProfilesSmart(currentDb[k], profiles[k]);
      }
      try {
        fs.writeFileSync(SYNC_FILE_PATH, JSON.stringify(currentDb, null, 2), 'utf-8');
      } catch {
        // Ignore read-only fs errors
      }

      if (action === 'push' && githubToken && gistId) {
        try {
          const filesPayload: Record<string, { content: string }> = {};
          for (const k of Object.keys(currentDb)) {
            filesPayload[`nutrition_${k}.json`] = {
              content: JSON.stringify(currentDb[k], null, 2),
            };
          }
          await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ files: filesPayload }),
          });
        } catch (e) {
          console.warn('Optional Gist push skipped:', e);
        }
      }
    }

    return res.json({ ok: true, profiles: currentDb, syncedAt: Date.now() });
  } catch (error: any) {
    console.error('Sync error:', error);
    return res.status(500).json({ error: error?.message || 'خطا در همگام‌سازی ابری' });
  }
});

// Create New GitHub Gist Database endpoint
app.post('/api/gist/create', async (req, res) => {
  try {
    const { githubToken, profiles } = req.body || {};
    const token = (githubToken && githubToken.trim()) || process.env.GITHUB_TOKEN;
    if (!token) {
      return res.status(400).json({ error: 'لطفاً ابتدا توکن گیت‌هاب را وارد کنید.' });
    }

    const filesObj: Record<string, { content: string }> = {};
    for (const k of Object.keys(profiles || {})) {
      filesObj[`nutrition_${k}.json`] = {
        content: JSON.stringify(profiles[k], null, 2),
      };
    }

    const gistRes = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: 'Smart Nutrition Tracker Multi-User Cloud DB',
        public: false,
        files: filesObj,
      }),
    });

    if (!gistRes.ok) {
      const errText = await gistRes.text();
      return res.status(gistRes.status).json({ error: `خطا از گیت‌هاب: ${errText}` });
    }

    const data: any = await gistRes.json();
    return res.json({ gistId: data.id });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'خطا در ساخت Gist' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;

