import { z } from 'zod';

export const generatedRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  servings: z.number().int().positive().optional(),
  prepMinutes: z.number().int().nonnegative().optional(),
  cookMinutes: z.number().int().nonnegative().optional(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      amount: z.number().optional(),
      unit: z.string().optional(),
      optional: z.boolean().optional(),
    }),
  ),
  steps: z.array(z.string()).min(1),
  tags: z.array(z.string()).optional(),
});

export type GeneratedRecipeParsed = z.infer<typeof generatedRecipeSchema>;
