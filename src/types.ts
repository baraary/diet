export type MealCategory = 'صبحانه' | 'ناهار' | 'شام' | 'میان‌وعده';

export type DesignStyle = 'glass' | 'material' | 'classic';

export type ColorKey =
  | 'indigo'
  | 'rose'
  | 'emerald'
  | 'sky'
  | 'amber'
  | 'violet'
  | 'coral'
  | 'cyan'
  | 'lime'
  | 'fuchsia'
  | 'slate';

export interface MealItem {
  id: string;
  time: string;
  category: MealCategory;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  score?: number;
  tip?: string;
  updatedAt?: number;
  _deleted?: boolean;
}

export interface RoutineItem {
  category: MealCategory;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export interface ExerciseItem {
  id: string;
  title: string;
  durationMinutes?: number;
  caloriesBurned: number;
  time?: string;
  _deleted?: boolean;
}

export interface DayLog {
  water: number;
  waterUpdatedAt?: number;
  meals: MealItem[];
  exercises: ExerciseItem[];
  deletedIds?: string[];
}

export interface OfflineQueueItem {
  id: string;
  profileKey: string;
  dateStr: string;
  category: MealCategory;
  text: string;
  photoBase64?: string | null;
  saveToRoutine: boolean;
  sharedPartnerKey: string | null;
  sharedMultiplier: number;
  createdAt: number;
}

export interface HealthyRecipe {
  id: string;
  category: MealCategory;
  title: string;
  prepTime: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  ingredients: string[];
  steps: string[];
  healthTip: string;
  isCustom?: boolean;
}

export interface UserStats {
  age: number;
  height: number;
  weight: number;
  startWeight: number;
  targetWeight: number;
  activity: number;
  goal: 'lose_fast' | 'lose_mild' | 'maintain' | 'recomp' | 'gain';
}

export interface UserTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  water: number;
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface UserProfile {
  name: string;
  gender: 'male' | 'female';
  avatar: string;
  color: ColorKey;
  partnerId: string;
  onboarded: boolean;
  stats: UserStats;
  targets: UserTargets;
  routines: RoutineItem[];
  favoriteRecipeIds: string[];
  customRecipes: HealthyRecipe[];
  weightHistory: WeightEntry[];
  days: Record<string, DayLog>;
  updatedAt?: number;
}

export interface AppConfig {
  githubToken?: string;
  gistId?: string;
}

export interface AppState {
  activeProfile: string;
  lockedProfile: string | null;
  currentDate: string;
  darkMode: boolean;
  soundEnabled?: boolean;
  designStyle: DesignStyle;
  config?: AppConfig;
  offlineQueue?: OfflineQueueItem[];
  profiles: Record<string, UserProfile>;
}
