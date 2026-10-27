const MEASURE_UNIT =
  '(?:ст\\.?\\s*л\\.?|ч\\.?\\s*л\\.?|стак(?:ан|ана|анов)?|банк(?:а|и)?|щепот(?:ка|ки)?|дол(?:ька|ьки|ек)?|пуч(?:ок|ка|ков)?|ломт(?:ик|ика|иков)?|шт\\.?|г|кг|мл|л|лист(?:а|ов)?)';

/** Короткое имя продукта для списка «Продукты» и отображения в UI. */
export function normalizeIngredientDisplayName(nameRu: string): string {
  let n = nameRu.trim().replace(/\s+/g, ' ');

  n = n.replace(/\s+по\s+желанию\s*$/iu, '');
  n = n.replace(/\s+для\s+жарки\s*$/iu, '');
  n = n.replace(/\s*\/\s*$/u, '');
  n = n.replace(/\s+=\s*$/u, '');

  let prev = '';
  while (prev !== n) {
    prev = n;
    n = n.replace(new RegExp(`\\s+\\d+[,.]?\\d*\\s*${MEASURE_UNIT}\\.?\\s*(?:\\/\\s*)?$`, 'iu'), '');
  }

  n = n.replace(/\s+ч\.?\s*м\.?\s*$/iu, '');

  const conserved = n.match(/^консервирован(ная|ное|ный|ной|ные|ных)\s+(.+)$/iu);
  if (conserved) {
    const product = conserved[2].trim();
    const adj = `консервирован${conserved[1].toLowerCase()}`;
    n = `${capitalizeFirst(product)} ${adj}`;
  }

  n = n.trim();
  if (!n) return capitalizeFirst(nameRu.trim());

  return capitalizeFirst(n);
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
