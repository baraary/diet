// Zero-Dependency Vercel Serverless API Entry Point
// Uses 100% native Node.js fetch so it can never fail with MODULE_NOT_FOUND or FUNCTION_INVOCATION_FAILED on Vercel

async function callGeminiStructuredJson(
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
  responseSchema: any,
  customApiKey?: string
): Promise<any> {
  const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'کلید GEMINI_API_KEY در Vercel تنظیم نشده است. لطفاً در Settings -> Environment Variables متغیر GEMINI_API_KEY را وارد کرده و یک بار Redeploy کنید.'
    );
  }

  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3-flash-preview',
    'gemini-1.5-flash',
  ];

  let lastErrorMsg = 'خطا در ارتباط با هوش مصنوعی جمینای';

  for (const modelName of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.2,
          },
        }),
      });

      const rawBody = await res.text();
      if (!res.ok) {
        let errDetail = rawBody;
        try {
          const errJson = JSON.parse(rawBody);
          errDetail = errJson?.error?.message || rawBody;
        } catch {
          // keep rawBody
        }
        lastErrorMsg = `خطا از جمینای (${res.status}): ${errDetail}`;
        // If API key itself is invalid, stop retrying other models
        if (res.status === 400 && errDetail.toLowerCase().includes('api key')) {
          throw new Error('کلید GEMINI_API_KEY واردشده معتبر نیست.');
        }
        continue;
      }

      const data = JSON.parse(rawBody);
      const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOut) {
        lastErrorMsg = 'پاسخ خالی از مدل دریافت شد';
        continue;
      }

      const cleaned = String(textOut)
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      return JSON.parse(cleaned);
    } catch (err: any) {
      lastErrorMsg = err?.message || lastErrorMsg;
    }
  }

  throw new Error(lastErrorMsg);
}

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

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const rawUrl = String(req.url || '');
    const routeParam = String(req.query?.route || '');
    const routePath = routeParam || rawUrl.replace(/^\/api\/?/, '').split('?')[0];

    let body: any = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    body = body || {};

    // 1. Analyze Food
    if (routePath.includes('gemini/analyze-food')) {
      const { text, imageBase64, mimeType, category, customApiKey } = body;
      if (!text && !imageBase64) {
        return res.status(400).json({ error: 'لطفاً توضیح غذا یا تصویر آن را ارسال کنید.' });
      }

      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
      if (imageBase64 && mimeType) {
        parts.push({ inlineData: { mimeType, data: imageBase64 } });
      }

      parts.push({
        text: [
          'تو یک متخصص تغذیه دقیق مسلط به غذاهای ایرانی، بین‌المللی و پیمانه‌های خانگی ایرانی (قاشق، کف دست، لیوان، پیاله، سیخ، قوطی کبریت) هستی.',
          `وعده انتخابی کاربر: ${category || 'وعده غذایی'}`,
          `ورودی کاربر: ${text || 'تحلیل تصویر پیوست‌شده از غذا و تخمین دقیق کالری و درشت‌مغذی‌های آن'}`,
          'مقادیر کالری، پروتئین، کربوهیدرات، چربی، فیبر، قند و سدیم را با دقت بالا محاسبه کن و یک امتیاز سلامتی از ۱ تا ۱۰ به همراه یک نکته تغذیه‌ای کوتاه و کاربردی به فارسی برگردان.',
        ].join('\n'),
      });

      const parsed = await callGeminiStructuredJson(
        parts,
        {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            calories: { type: 'NUMBER' },
            protein: { type: 'NUMBER' },
            carbs: { type: 'NUMBER' },
            fat: { type: 'NUMBER' },
            fiber: { type: 'NUMBER' },
            sugar: { type: 'NUMBER' },
            sodium: { type: 'NUMBER' },
            score: { type: 'NUMBER' },
            tip: { type: 'STRING' },
          },
          required: [
            'title',
            'calories',
            'protein',
            'carbs',
            'fat',
            'fiber',
            'sugar',
            'sodium',
            'score',
            'tip',
          ],
        },
        customApiKey
      );

      return res.status(200).json(parsed);
    }

    // 2. Analyze Exercise
    if (routePath.includes('gemini/analyze-exercise')) {
      const { text, weight, customApiKey } = body;
      if (!text) {
        return res.status(400).json({ error: 'لطفاً شرح فعالیت ورزشی را وارد کنید.' });
      }

      const parsed = await callGeminiStructuredJson(
        [
          {
            text: `کاربر با وزن ${weight || 75} کیلوگرم این فعالیت ورزشی را انجام داده است: "${text}". کالری سوزانده‌شده، مدت زمان به دقیقه و عنوان تمیز فعالیت را به فارسی محاسبه کن.`,
          },
        ],
        {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            durationMinutes: { type: 'NUMBER' },
            caloriesBurned: { type: 'NUMBER' },
          },
          required: ['title', 'durationMinutes', 'caloriesBurned'],
        },
        customApiKey
      );

      return res.status(200).json(parsed);
    }

    // 3. What To Eat
    if (routePath.includes('gemini/what-to-eat')) {
      const {
        remainingCalories,
        remainingProtein,
        remainingCarbs,
        remainingFat,
        currentHour,
        eatenMeals,
        goal,
        customApiKey,
      } = body;

      const prompt = [
        'تو یک مشاور تغذیه هوشمند ایرانی هستی.',
        `ساعت فعلی روز: ${currentHour ?? new Date().getHours()}:00`,
        `هدف کاربر: ${goal || 'کاهش وزن اصولی'}`,
        `کالری باقی‌مانده امروز: ${remainingCalories} kcal`,
        `پروتئین باقی‌مانده: ${remainingProtein}g | کربوهیدرات باقی‌مانده: ${remainingCarbs}g | چربی باقی‌مانده: ${remainingFat}g`,
        `غذاهای خورده‌شده امروز: ${(eatenMeals || []).join('، ') || 'هنوز وعده‌ای ثبت نشده است'}`,
        'بر اساس ساعت روز و بودجه کالری و ماکروهای باقی‌مانده، ۳ گزینه غذایی ایرانی، در دسترس و خوشمزه پیشنهاد بده که دقیقاً با نیاز باقی‌مانده امروز کاربر هماهنگ باشد.',
      ].join('\n');

      const parsed = await callGeminiStructuredJson(
        [{ text: prompt }],
        {
          type: 'OBJECT',
          properties: {
            summaryAdvice: { type: 'STRING' },
            suggestions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  category: { type: 'STRING' },
                  calories: { type: 'NUMBER' },
                  protein: { type: 'NUMBER' },
                  carbs: { type: 'NUMBER' },
                  fat: { type: 'NUMBER' },
                  fiber: { type: 'NUMBER' },
                  reason: { type: 'STRING' },
                },
                required: ['title', 'category', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'reason'],
              },
            },
          },
          required: ['summaryAdvice', 'suggestions'],
        },
        customApiKey
      );

      return res.status(200).json(parsed);
    }

    // 4. Generate Recipe
    if (routePath.includes('gemini/generate-recipe')) {
      const { ingredients, category, targetCalories, customApiKey } = body;

      const prompt = [
        'تو یک سرآشپز رژیمی و متخصص تغذیه ایرانی هستی.',
        ingredients
          ? `کاربر این مواد اولیه را در یخچال/منزل دارد: "${ingredients}". با استفاده از این مواد (و ادویه‌ها/مواد پایه معمول خانه) یک غذای بسیار خوشمزه، سالم، کم‌روغن و پرپروتئین طراحی کن.`
          : `یک دستور پخت خلاقانه، سالم، سریع و پرپروتئین ایرانی برای وعده «${category || 'ناهار یا شام'}» (حدود ${targetCalories || 350} کالری) طراحی کن.`,
      ].join('\n');

      const parsed = await callGeminiStructuredJson(
        [{ text: prompt }],
        {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            category: { type: 'STRING' },
            prepTime: { type: 'STRING' },
            calories: { type: 'NUMBER' },
            protein: { type: 'NUMBER' },
            carbs: { type: 'NUMBER' },
            fat: { type: 'NUMBER' },
            fiber: { type: 'NUMBER' },
            ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
            steps: { type: 'ARRAY', items: { type: 'STRING' } },
            healthTip: { type: 'STRING' },
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

      return res.status(200).json(parsed);
    }

    // 5. Create New GitHub Gist
    if (routePath.includes('gist/create')) {
      const { githubToken, profiles } = body;
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
      return res.status(200).json({ gistId: data.id });
    }

    // 6. Multi-User Cloud Sync (GitHub Gist)
    if (routePath.includes('sync')) {
      const { action, profiles, githubToken: clientGithubToken, gistId: clientGistId } = body;
      const currentDb: Record<string, any> = {};

      const githubToken =
        (clientGithubToken && clientGithubToken.trim()) || process.env.GITHUB_TOKEN;
      const gistId = (clientGistId && clientGistId.trim()) || process.env.GIST_ID;

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
              if (gistData.files['nutrition_db.json']?.content) {
                try {
                  const legacyDb = JSON.parse(gistData.files['nutrition_db.json'].content);
                  const legacyProfiles = legacyDb.profiles || legacyDb;
                  if (legacyProfiles && typeof legacyProfiles === 'object') {
                    for (const k of Object.keys(legacyProfiles)) {
                      if (
                        legacyProfiles[k] &&
                        typeof legacyProfiles[k] === 'object' &&
                        legacyProfiles[k].days
                      ) {
                        currentDb[k] = mergeProfilesSmart(currentDb[k], legacyProfiles[k]);
                      }
                    }
                  }
                } catch {
                  // Ignore malformed legacy file
                }
              }

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
                      currentDb[profKey] = mergeProfilesSmart(
                        currentDb[profKey],
                        JSON.parse(rawContent)
                      );
                    } catch {
                      // Ignore malformed file
                    }
                  }
                }
              }
            }
          }
        } catch {
          // Optional pull error ignored
        }
      }

      if (profiles && typeof profiles === 'object') {
        for (const k of Object.keys(profiles)) {
          currentDb[k] = mergeProfilesSmart(currentDb[k], profiles[k]);
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
          } catch {
            // Optional push error ignored
          }
        }
      }

      return res.status(200).json({ ok: true, profiles: currentDb, syncedAt: Date.now() });
    }

    return res.status(404).json({ error: `مسیر API یافت نشد: ${routePath}` });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || 'خطای داخلی سرور در پردازش درخواست',
    });
  }
}
