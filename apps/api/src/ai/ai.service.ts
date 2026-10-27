import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { basename, extname, join } from 'path';
import sharp from 'sharp';
import { generatedRecipeSchema } from './ai.schema';

const VISION_FETCH_TIMEOUT_MS = 90_000;
const VISION_IMAGE_MAX_EDGE = 1024;

export interface GenerateRecipeInput {
  pantryNames: string[];
  constraints?: string;
  locale?: string;
}

/** OpenRouter: в `models` не больше 3 id. */
const OPENROUTER_MODELS_FALLBACK_MAX = 3;

/** Бесплатные vision-модели (разные провайдеры). */
const DEFAULT_VISION_MODELS = [
  'thinkingmachines/inkling:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3.5-super-vl:free',
] as const;

@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService) {}

  private getApiConfig() {
    const provider = this.config.get<string>('AI_PROVIDER') ?? 'openrouter';
    if (provider === 'groq') {
      const key = this.config.get<string>('GROQ_API_KEY');
      if (!key) throw new ServiceUnavailableException('GROQ_API_KEY not set');
      return {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key,
        model: this.config.get<string>('AI_MODEL') ?? 'llama-3.3-70b-versatile',
      };
    }
    const key = this.config.get<string>('OPENROUTER_API_KEY');
    if (!key)
      throw new ServiceUnavailableException('OPENROUTER_API_KEY not set');
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key,
      model:
        this.config.get<string>('AI_MODEL') ??
        'minimax/minimax-m3.1-flash:free',
    };
  }

  private getOpenRouterKey(): string {
    const key = this.config.get<string>('OPENROUTER_API_KEY');
    if (!key) {
      throw new ServiceUnavailableException(
        'OPENROUTER_API_KEY not set (required for photo recognition)',
      );
    }
    return key;
  }

  /** Список vision-моделей: AI_VISION_MODEL=модель1,модель2 (до 3) или дефолт. */
  private getVisionModels(): string[] {
    const raw = this.config.get<string>('AI_VISION_MODEL')?.trim();
    const list =
      raw
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    const models = list.length ? list : [...DEFAULT_VISION_MODELS];
    return models.slice(0, OPENROUTER_MODELS_FALLBACK_MAX);
  }

  private openRouterHeaders(url: string, key: string): Record<string, string> {
    return {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(url.includes('openrouter')
        ? {
            'HTTP-Referer': 'http://localhost:4200',
            'X-Title': 'Recipe Manager',
          }
        : {}),
    };
  }

  private async chatJson(system: string, user: string): Promise<unknown> {
    const { url, key, model } = this.getApiConfig();
    const res = await fetch(url, {
      method: 'POST',
      headers: this.openRouterHeaders(url, key),
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`AI error: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new BadRequestException('Empty AI response');
    try {
      return JSON.parse(content);
    } catch {
      throw new BadRequestException('AI returned invalid JSON');
    }
  }

  private visionRateLimitMessage(): string {
    return (
      'Исчерпан лимит бесплатных vision-запросов OpenRouter (обычно ~50 в день без пополнения баланса, ~20 в минуту). ' +
      'Подождите или пополните аккаунт OpenRouter (от ~10 credits — выше дневной лимит). ' +
      'Либо задайте AI_VISION_MODEL одной моделью в apps/api/.env.'
    );
  }

  private visionTimeoutMessage(): string {
    return (
      'Распознавание заняло слишком много времени у провайдера AI. ' +
      'Попробуйте фото меньшего размера или повторите через минуту. ' +
      'Можно указать другую модель в AI_VISION_MODEL.'
    );
  }

  private isVisionTimeoutError(status: number, body: string): boolean {
    if (status === 408 || status === 504) return true;
    const lower = body.toLowerCase();
    return (
      lower.includes('timed out') ||
      lower.includes('timeout') ||
      lower.includes('deadline exceeded')
    );
  }

  private visionHttpErrorMessage(status: number, body: string): string | null {
    if (this.isVisionTimeoutError(status, body)) return this.visionTimeoutMessage();
    try {
      const data = JSON.parse(body) as { error?: { message?: string } };
      const msg = data.error?.message ?? '';
      if (this.isVisionTimeoutError(status, msg)) return this.visionTimeoutMessage();
      if (msg) return msg;
    } catch {
      /* ignore */
    }
    return null;
  }

  private extractChatMessageContent(message: unknown): string {
    if (!message || typeof message !== 'object') return '';
    const record = message as Record<string, unknown>;
    const refusal = record['refusal'];
    if (typeof refusal === 'string' && refusal.trim()) {
      throw new BadRequestException(`Модель отказалась анализировать фото: ${refusal}`);
    }
    const content = record['content'];
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (!part || typeof part !== 'object') return '';
          const p = part as Record<string, unknown>;
          if (p['type'] === 'text' && typeof p['text'] === 'string') return p['text'];
          return '';
        })
        .filter(Boolean)
        .join('\n')
        .trim();
    }
    return '';
  }

  private parseJsonFromModelText(text: string): unknown {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new BadRequestException('Empty AI vision response');
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through */
    }
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        /* fall through */
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    const salvaged = this.salvageTruncatedProductsJson(trimmed);
    if (salvaged !== null) return salvaged;

    throw new BadRequestException('AI vision returned invalid JSON');
  }

  /** Если ответ обрезан (finish_reason=length), собираем полные объекты из массива products. */
  private salvageTruncatedProductsJson(text: string): unknown | null {
    const start = text.indexOf('"products"');
    if (start === -1) return null;
    const bracket = text.indexOf('[', start);
    if (bracket === -1) return null;
    const tail = text.slice(bracket);
    const lastObjEnd = tail.lastIndexOf('}');
    if (lastObjEnd <= 1) return null;
    const candidate = `${tail.slice(0, lastObjEnd + 1)}]`;
    try {
      const products = JSON.parse(candidate) as unknown;
      if (!Array.isArray(products)) return null;
      return { products };
    } catch {
      return null;
    }
  }

  private tryParseVisionCompletionBody(rawBody: string): unknown | null {
    let data: {
      error?: { message?: string };
      choices?: Array<{
        finish_reason?: string;
        message?: unknown;
      }>;
    };
    try {
      data = JSON.parse(rawBody) as typeof data;
    } catch {
      return null;
    }
    if (data.error?.message) {
      throw new BadRequestException(`AI vision error: ${data.error.message}`);
    }
    const choice = data.choices?.[0];
    const content = this.extractChatMessageContent(choice?.message);
    if (!content) return null;
    try {
      return this.parseJsonFromModelText(content);
    } catch {
      return null;
    }
  }

  private async chatVisionJson(
    system: string,
    userText: string,
    imageDataUrl: string,
  ): Promise<unknown> {
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const key = this.getOpenRouterKey();
    const models = this.getVisionModels();
    const messages = [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          {
            type: 'image_url',
            image_url: { url: imageDataUrl, detail: 'low' },
          },
        ],
      },
    ];

    let lastStatus = 0;
    let lastBody = '';
    let lastFinishReason = 'unknown';
    let sawTimeout = false;

    const provider = {
      allow_fallbacks: true,
      sort: { by: 'latency', partition: 'none' },
    };
    /** JSON-first; при обрезке ответа — повтор с большим лимитом токенов. */
    const requestVariants: Array<Record<string, unknown>> = [
      {
        models,
        messages,
        temperature: 0.2,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        provider,
      },
      {
        models,
        messages,
        temperature: 0.2,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
        provider,
      },
    ];

    for (const body of requestVariants) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: this.openRouterHeaders(url, key),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(VISION_FETCH_TIMEOUT_MS),
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'TimeoutError') {
          sawTimeout = true;
          break;
        }
        throw err;
      }

      lastStatus = res.status;
      lastBody = await res.text();

      if (res.status === 429) {
        throw new HttpException(
          this.visionRateLimitMessage(),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (!res.ok) {
        if (this.isVisionTimeoutError(res.status, lastBody)) {
          sawTimeout = true;
        }
        break;
      }

      try {
        const peek = JSON.parse(lastBody) as {
          choices?: Array<{ finish_reason?: string }>;
        };
        lastFinishReason = peek.choices?.[0]?.finish_reason ?? lastFinishReason;
      } catch {
        /* ignore */
      }

      const parsed = this.tryParseVisionCompletionBody(lastBody);
      if (parsed !== null) return parsed;
    }

    if (sawTimeout) {
      throw new HttpException(
        this.visionTimeoutMessage(),
        HttpStatus.GATEWAY_TIMEOUT,
      );
    }

    const friendly = this.visionHttpErrorMessage(lastStatus, lastBody);
    if (lastStatus >= 200 && lastStatus < 300) {
      const hint =
        lastFinishReason === 'length'
          ? 'Ответ модели обрезался по лимиту длины — попробуйте фото с меньшим числом предметов или укажите AI_VISION_MODEL.'
          : 'Попробуйте другое фото или задайте AI_VISION_MODEL в .env.';
      throw new BadRequestException(
        `Модель не вернула список продуктов (${lastFinishReason}). ${hint}`,
      );
    }
    if (friendly) {
      throw new BadRequestException(friendly);
    }
    throw new BadRequestException(`AI vision error: ${lastStatus} ${lastBody}`);
  }

  private resolveUploadFilename(imageUrl: string): string | null {
    try {
      const u = new URL(imageUrl);
      const name = basename(u.pathname);
      return name && name !== '/' ? name : null;
    } catch {
      return null;
    }
  }

  private async prepareVisionImageDataUrl(imageUrl: string): Promise<string> {
    const filename = this.resolveUploadFilename(imageUrl);
    if (!filename) {
      throw new BadRequestException('Invalid image URL');
    }
    const uploadDir = this.config.get<string>('UPLOAD_DIR') ?? './uploads';
    const filePath = join(uploadDir, filename);
    if (!existsSync(filePath)) {
      throw new BadRequestException('Uploaded image not found');
    }
    const raw = readFileSync(filePath);
    const buf = await sharp(raw)
      .rotate()
      .resize(VISION_IMAGE_MAX_EDGE, VISION_IMAGE_MAX_EDGE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }

  async generateRecipe(input: GenerateRecipeInput) {
    const locale = input.locale ?? 'ru';
    const system = `You are a home cooking assistant. Reply ONLY with valid JSON matching this shape:
{"title":"","description":"","servings":2,"prepMinutes":10,"cookMinutes":20,"ingredients":[{"name":"","amount":0,"unit":"г","optional":false}],"steps":[""],"tags":[]}
Use ${locale} language for all text. For ingredient units use Russian abbreviations: г, кг, мл, л, шт, ст. л., ч. л. Prefer ingredients from the user's pantry; minimize missing items.`;
    const user = `Products at home: ${input.pantryNames.join(', ') || 'none specified'}.
Constraints: ${input.constraints ?? 'none'}.
Suggest one practical recipe.`;
    const raw = await this.chatJson(system, user);
    const parsed = generatedRecipeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  async recognizeProducts(imageUrl: string) {
    const system = `Food vision. Output ONLY JSON, no prose:
{"products":[{"name":"string","confidence":0.9}]}
Up to 15 items; name in Russian (grocery list style); skip non-food; confidence 0-1.`;
    const user = 'Visible food in this fridge/kitchen photo.';
    const imageDataUrl = await this.prepareVisionImageDataUrl(imageUrl);
    const raw = (await this.chatVisionJson(system, user, imageDataUrl)) as {
      products?: Array<{ name: string; confidence?: number }>;
    };
    const products = raw.products ?? [];
    return products
      .filter((p) => typeof p.name === 'string' && p.name.trim())
      .slice(0, 20)
      .map((p) => ({
        name: p.name.trim(),
        confidence: typeof p.confidence === 'number' ? p.confidence : undefined,
      }));
  }
}
