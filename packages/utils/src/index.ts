export function calculateBmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function scoreFromRange(
  value: number,
  optimal: { min: number; max: number },
  maxScore = 100,
): number {
  if (value >= optimal.min && value <= optimal.max) return maxScore;
  if (value < optimal.min) {
    const ratio = value / optimal.min;
    return Math.round(clamp(ratio, 0, 1) * maxScore);
  }
  const excess = value - optimal.max;
  const penalty = excess * 5;
  return Math.round(clamp(maxScore - penalty, 0, maxScore));
}

export interface WellnessWeights {
  sleepWeight: number;
  exerciseWeight: number;
  stressWeight: number;
  nutritionWeight: number;
  hydrationWeight: number;
}

export interface WellnessInputs {
  sleepHours?: number;
  exerciseMinutes?: number;
  stressLevel?: number;
  mealsCount?: number;
  waterIntake?: number;
}

export function calculateWellnessScores(
  inputs: WellnessInputs,
  weights: WellnessWeights = {
    sleepWeight: 0.2,
    exerciseWeight: 0.2,
    stressWeight: 0.2,
    nutritionWeight: 0.2,
    hydrationWeight: 0.2,
  },
): {
  overallScore: number;
  sleepScore: number;
  exerciseScore: number;
  stressScore: number;
  nutritionScore: number;
  hydrationScore: number;
} {
  const sleepScore = inputs.sleepHours
    ? scoreFromRange(inputs.sleepHours, { min: 7, max: 9 })
    : 50;
  const exerciseScore = inputs.exerciseMinutes
    ? scoreFromRange(inputs.exerciseMinutes, { min: 30, max: 60 })
    : 50;
  const stressScore =
    inputs.stressLevel !== undefined
      ? Math.round(100 - clamp(inputs.stressLevel, 0, 100))
      : 50;
  const nutritionScore = inputs.mealsCount
    ? scoreFromRange(inputs.mealsCount, { min: 3, max: 3 })
    : 50;
  const hydrationScore = inputs.waterIntake
    ? scoreFromRange(inputs.waterIntake, { min: 2, max: 3 })
    : 50;

  const overallScore = Math.round(
    sleepScore * weights.sleepWeight +
      exerciseScore * weights.exerciseWeight +
      stressScore * weights.stressWeight +
      nutritionScore * weights.nutritionWeight +
      hydrationScore * weights.hydrationWeight,
  );

  return {
    overallScore,
    sleepScore,
    exerciseScore,
    stressScore,
    nutritionScore,
    hydrationScore,
  };
}

export function stressLevelToNumber(level: string): number {
  const map: Record<string, number> = {
    VERY_LOW: 10,
    LOW: 30,
    MODERATE: 50,
    HIGH: 70,
    VERY_HIGH: 90,
  };
  return map[level] ?? 50;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function paginate<T>(
  items: T[],
  page = 1,
  limit = 20,
): { data: T[]; total: number; page: number; limit: number; totalPages: number } {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const start = (safePage - 1) * safeLimit;
  const data = items.slice(start, start + safeLimit);
  const total = items.length;
  return {
    data,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  };
}
