import { calculateWellnessScores, calculateBmi, stressLevelToNumber } from './index';

describe('calculateBmi', () => {
  it('calculates BMI correctly', () => {
    expect(calculateBmi(70, 175)).toBe(22.9);
  });

  it('returns 0 for invalid inputs', () => {
    expect(calculateBmi(0, 175)).toBe(0);
  });
});

describe('calculateWellnessScores', () => {
  it('returns high score for optimal inputs', () => {
    const result = calculateWellnessScores({
      sleepHours: 8,
      exerciseMinutes: 45,
      stressLevel: 20,
      mealsCount: 3,
      waterIntake: 2.5,
    });
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.sleepScore).toBe(100);
  });

  it('returns lower score for poor inputs', () => {
    const result = calculateWellnessScores({
      sleepHours: 4,
      exerciseMinutes: 0,
      stressLevel: 90,
      mealsCount: 1,
      waterIntake: 0.5,
    });
    expect(result.overallScore).toBeLessThan(60);
  });
});

describe('stressLevelToNumber', () => {
  it('maps stress levels correctly', () => {
    expect(stressLevelToNumber('VERY_HIGH')).toBe(90);
    expect(stressLevelToNumber('LOW')).toBe(30);
  });
});
