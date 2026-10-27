/** Учитываем активную работу (prep) и только часть пассивного времени (варка, настаивание). */
export function effectiveDifficultyScore(
  prepMinutes?: number | null,
  cookMinutes?: number | null,
): number {
  const prep = prepMinutes ?? 0;
  const cook = cookMinutes ?? 0;
  const passive = Math.max(cook - 30, 0);
  return prep + Math.min(cook, 30) + passive * 0.25;
}

export function difficultyLevel(
  prepMinutes?: number | null,
  cookMinutes?: number | null,
): string {
  const score = effectiveDifficultyScore(prepMinutes, cookMinutes);
  if (score <= 50) return 'Легко';
  if (score <= 85) return 'Средне';
  return 'Сложно';
}
