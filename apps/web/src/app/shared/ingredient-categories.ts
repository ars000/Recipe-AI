export const INGREDIENT_CATEGORY_ORDER: readonly string[] = [
  'мясо',
  'овощи',
  'грибы',
  'фрукты',
  'рыба',
  'молочное',
  'бакалея',
  'зелень',
  'соусы',
  'прочее',
];

const CATEGORY_LABELS: Record<string, string> = {
  мясо: 'Мясо и птица',
  овощи: 'Овощи',
  грибы: 'Грибы',
  фрукты: 'Фрукты и ягоды',
  рыба: 'Рыба и морепродукты',
  молочное: 'Молочные продукты и яйца',
  бакалея: 'Бакалея и крупы',
  зелень: 'Зелень и специи',
  соусы: 'Соусы и масла',
  прочее: 'Прочее',
};

/** Фоновые изображения (Unsplash, бесплатное использование в демо). */
const CATEGORY_IMAGES: Record<string, string> = {
  мясо: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800&q=80',
  овощи: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80',
  грибы:
    'https://images.unsplash.com/photo-1645106540091-219948d3ce39?w=800&q=80',
  фрукты: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=800&q=80',
  рыба: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80',
  молочное: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&q=80',
  бакалея: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&q=80',
  зелень:
    'https://images.unsplash.com/photo-1535189487909-a262ad10c165?w=800&q=80',
  соусы:
    'https://images.unsplash.com/photo-1720787159551-14e2f9d32a6a?w=800&q=80',
  прочее: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&q=80',
};

export function ingredientCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

export function ingredientCategoryImage(category: string): string {
  return CATEGORY_IMAGES[category] ?? CATEGORY_IMAGES['прочее'];
}

export function compareIngredientCategories(a: string, b: string): number {
  const ia = INGREDIENT_CATEGORY_ORDER.indexOf(a);
  const ib = INGREDIENT_CATEGORY_ORDER.indexOf(b);
  const ra = ia === -1 ? INGREDIENT_CATEGORY_ORDER.length : ia;
  const rb = ib === -1 ? INGREDIENT_CATEGORY_ORDER.length : ib;
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b, 'ru');
}
