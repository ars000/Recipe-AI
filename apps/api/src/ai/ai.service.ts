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

/** OpenRouter: не больше 3 id в `models`; у нас — по одной модели за запрос, но лимит списка тот же. */
const OPENROUTER_VISION_MODELS_MAX = 3;

/** Groq Free: vision + JSON (console.groq.com/docs/vision). */
const DEFAULT_GROQ_VISION_MODEL = 'qwen/qwen3.8-27b';

/** Только бесплатные id OpenRouter (`:free` или роутер `openrouter/free`). */
const DEFAULT_TEXT_MODEL = 'openrouter/free';

/** Бесплатные vision-модели (актуальный каталог OpenRouter). */
const DEFAULT_VISION_MODELS = [
  'nvidia/nemotron-3.5-super-vl:free',
  'google/gemma-4-31b-it:free',
  'thinkingmachines/inkling:free',
] as const;

type GroqVisionResult =
  | { ok: true; data: unknown }
  | { ok: false; rateLimited: boolean; lastStatus: number; lastBody: string };

type OrVisionFail = {
  ok: false;
  rateLimited: boolean;
  lastStatus: number;
  lastBody: string;
  lastFinishReason: string;
  sawTimeout: boolean;
};

function isGroqVisionFail(
  r: GroqVisionResult,
): r is Extract<GroqVisionResult, { ok: false }> {
  return r.ok === false;
}

function isOrVisionFail(
  r: { ok: boolean },
): r is OrVisionFail {
  return r.ok === false;
}

@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService) {}

  /** Только бесплатные варианты OpenRouter (см. openrouter.ai/docs …/free). */
  private resolveOpenRouterTextModel(): string {
    const raw = this.config.get<string>('AI_MODEL')?.trim();
    const model = raw || DEFAULT_TEXT_MODEL;
    if (model === 'openrouter/free') return model;
    if (model.endsWith(':free')) return model;
    throw new BadRequestException(
      'AI_MODEL должен быть бесплатным: openrouter/free или id с суффиксом :free',
    );
  }

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
      model: this.resolveOpenRouterTextModel(),
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
    const freeOnly = models.map((id) => {
      if (id === 'openrouter/free' || id.endsWith(':free')) return id;
      throw new BadRequestException(
        `AI_VISION_MODEL: только бесплатные id (:free), получено «${id}»`,
      );
    });
    return freeOnly.slice(0, OPENROUTER_VISION_MODELS_MAX);
  }

  private getGroqKey(): string | null {
    const key = this.config.get<string>('GROQ_API_KEY')?.trim();
    return key || null;
  }

  private getGroqVisionModel(): string {
    return (
      this.config.get<string>('AI_VISION_GROQ_MODEL')?.trim() ||
      DEFAULT_GROQ_VISION_MODEL
    );
  }

  /** openrouter → groq (если есть ключ), groq — только Groq, openrouter — только OR. */
  private getVisionProviderMode(): 'auto' | 'openrouter' | 'groq' {
    const raw = this.config
      .get<string>('AI_VISION_PROVIDER')
      ?.trim()
      .toLowerCase();
    if (raw === 'groq' || raw === 'openrouter') return raw;
    return 'auto';
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
    const groqHint = this.getGroqKey()
      ? ''
      : ' Либо добавьте бесплатный GROQ_API_KEY (console.groq.com) — включится запасной vision.';
    return (
      'Исчерпан лимит бесплатного распознавания фото (OpenRouter и/или Groq). ' +
      'Подождите 15–60 минут или до следующего дня.' +
      groqHint
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
    if (this.isVisionTimeoutError(status, body))
      return this.visionTimeoutMessage();
    try {
      const data = JSON.parse(body) as { error?: { message?: string } };
      const msg = data.error?.message ?? '';
      if (this.isVisionTimeoutError(status, msg))
        return this.visionTimeoutMessage();
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
      throw new BadRequestException(
        `Модель отказалась анализировать фото: ${refusal}`,
      );
    }
    const content = record['content'];
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (!part || typeof part !== 'object') return '';
          const p = part as Record<string, unknown>;
          if (p['type'] === 'text' && typeof p['text'] === 'string')
            return p['text'];
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

  private buildVisionMessages(
    system: string,
    userText: string,
    imageDataUrl: string,
  ) {
    return [
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
  }

  private async postVisionChat(
    url: string,
    key: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
  ): Promise<{
    status: number;
    body: string;
    parsed: unknown | null;
    finishReason: string;
    timedOut: boolean;
  }> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(VISION_FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        return {
          status: 504,
          body: '',
          parsed: null,
          finishReason: 'timeout',
          timedOut: true,
        };
      }
      throw err;
    }
    const text = await res.text();
    let finishReason = 'unknown';
    if (res.ok) {
      try {
        const peek = JSON.parse(text) as {
          choices?: Array<{ finish_reason?: string }>;
        };
        finishReason = peek.choices?.[0]?.finish_reason ?? finishReason;
      } catch {
        /* ignore */
      }
    }
    const parsed = res.ok ? this.tryParseVisionCompletionBody(text) : null;
    return {
      status: res.status,
      body: text,
      parsed,
      finishReason,
      timedOut: this.isVisionTimeoutError(res.status, text),
    };
  }

  private async chatVisionOpenRouter(
    messages: ReturnType<AiService['buildVisionMessages']>,
  ): Promise<{ ok: true; data: unknown } | OrVisionFail> {
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const key = this.getOpenRouterKey();
    const models = this.getVisionModels();
    const provider = {
      allow_fallbacks: false,
      sort: { by: 'latency', partition: 'none' },
    };

    let lastStatus = 0;
    let lastBody = '';
    let lastFinishReason = 'unknown';
    let sawTimeout = false;
    let saw429 = false;

    for (const model of models) {
      for (const maxTokens of [2048, 4096]) {
        const result = await this.postVisionChat(
          url,
          key,
          this.openRouterHeaders(url, key),
          {
            model,
            messages,
            temperature: 0.2,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
            provider,
          },
        );
        lastStatus = result.status;
        lastBody = result.body;
        lastFinishReason = result.finishReason;
        if (result.timedOut) sawTimeout = true;
        if (result.status === 429) {
          saw429 = true;
          continue;
        }
        if (result.parsed !== null) {
          return { ok: true as const, data: result.parsed };
        }
        if (!result.timedOut && result.status >= 400) break;
      }
    }

    return {
      ok: false as const,
      rateLimited: saw429,
      lastStatus,
      lastBody,
      lastFinishReason,
      sawTimeout,
    };
  }

  private async chatVisionGroq(
    messages: ReturnType<AiService['buildVisionMessages']>,
  ): Promise<GroqVisionResult> {
    const key = this.getGroqKey();
    if (!key) {
      return {
        ok: false as const,
        rateLimited: false,
        lastStatus: 0,
        lastBody: '',
      };
    }
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const model = this.getGroqVisionModel();
    let lastStatus = 0;
    let lastBody = '';
    let saw429 = false;

    for (const maxTokens of [2048, 4096]) {
      const result = await this.postVisionChat(
        url,
        key,
        {},
        {
          model,
          messages,
          temperature: 0.2,
          max_completion_tokens: maxTokens,
          response_format: { type: 'json_object' },
        },
      );
      lastStatus = result.status;
      lastBody = result.body;
      if (result.status === 429) {
        saw429 = true;
        continue;
      }
      if (result.parsed !== null) {
        return { ok: true as const, data: result.parsed };
      }
    }

    return {
      ok: false as const,
      rateLimited: saw429,
      lastStatus,
      lastBody,
    };
  }

  private async chatVisionJson(
    system: string,
    userText: string,
    imageDataUrl: string,
  ): Promise<unknown> {
    const messages = this.buildVisionMessages(system, userText, imageDataUrl);
    const mode = this.getVisionProviderMode();

    const tryGroqFirst = mode === 'groq';
    const tryOpenRouter = mode !== 'groq';
    const tryGroqFallback = mode === 'auto' || mode === 'groq';

    if (tryGroqFirst && this.getGroqKey()) {
      const groq = await this.chatVisionGroq(messages);
      if (groq.ok) {
        return groq.data;
      }
      if (isGroqVisionFail(groq) && mode === 'groq' && groq.rateLimited) {
        throw new HttpException(
          this.visionRateLimitMessage(),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    let orFail: OrVisionFail | null = null;
    if (tryOpenRouter) {
      const or = await this.chatVisionOpenRouter(messages);
      if (or.ok) {
        return or.data;
      }
      if (isOrVisionFail(or)) {
        orFail = or;
      }
    }

    if (tryGroqFallback && this.getGroqKey() && mode !== 'groq') {
      const groq = await this.chatVisionGroq(messages);
      if (groq.ok) {
        return groq.data;
      }
      if (
        (isGroqVisionFail(groq) && groq.rateLimited) ||
        orFail?.rateLimited
      ) {
        throw new HttpException(
          this.visionRateLimitMessage(),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } else if (orFail?.rateLimited) {
      throw new HttpException(
        this.visionRateLimitMessage(),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const lastStatus = orFail?.lastStatus ?? 0;
    const lastBody = orFail?.lastBody ?? '';
    const lastFinishReason = orFail?.lastFinishReason ?? 'unknown';
    const sawTimeout = orFail?.sawTimeout ?? false;

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
          ? 'Ответ модели обрезался — попробуйте фото с меньшим числом предметов.'
          : 'Попробуйте другое фото.';
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
