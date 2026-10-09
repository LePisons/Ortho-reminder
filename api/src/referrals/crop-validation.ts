import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function validateCropRecipe(value: string): Prisma.InputJsonObject {
  let recipe: Record<string, unknown>;
  try {
    recipe = JSON.parse(value);
  } catch {
    throw new BadRequestException('Recorte inválido.');
  }
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe))
    throw new BadRequestException('Recorte inválido.');
  const keys = [
    'centerX',
    'centerY',
    'width',
    'height',
    'rotation',
    'flipX',
    'flipY',
  ];
  if (
    Object.keys(recipe).some((key) => !keys.includes(key)) ||
    !keys.every((key) => key in recipe)
  )
    throw new BadRequestException('Recorte inválido.');
  for (const key of keys.slice(0, 5)) {
    const number = recipe[key];
    if (
      typeof number !== 'number' ||
      !Number.isFinite(number) ||
      Math.abs(number) > 100_000 ||
      (key !== 'rotation' && number < 0) ||
      (['width', 'height'].includes(key) && number < 1)
    )
      throw new BadRequestException('Dimensiones de recorte inválidas.');
  }
  if (typeof recipe.flipX !== 'boolean' || typeof recipe.flipY !== 'boolean')
    throw new BadRequestException('Orientación inválida.');
  return recipe as Prisma.InputJsonObject;
}

export function safePredictions(data: unknown) {
  const predictions = (data as { predictions?: unknown[] })?.predictions;
  if (!Array.isArray(predictions)) return [];
  return predictions
    .filter((p): p is Record<string, number | string> => {
      if (!p || typeof p !== 'object') return false;
      const item = p as Record<string, unknown>;
      return (
        ['x', 'y', 'width', 'height', 'confidence'].every(
          (k) => typeof item[k] === 'number' && Number.isFinite(item[k]),
        ) &&
        typeof item.class === 'string' &&
        item.class.length <= 100 &&
        Number(item.width) > 0 &&
        Number(item.height) > 0 &&
        Number(item.width) <= 1280 &&
        Number(item.height) <= 1280 &&
        Number(item.x) >= 0 &&
        Number(item.x) <= 640 &&
        Number(item.y) >= 0 &&
        Number(item.y) <= 640 &&
        Number(item.confidence) >= 0.4 &&
        Number(item.confidence) <= 1
      );
    })
    .sort((a, b) => Number(b.confidence) - Number(a.confidence))
    .slice(0, 5)
    .map((p) => ({
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      confidence: p.confidence,
      class: p.class,
    }));
}
