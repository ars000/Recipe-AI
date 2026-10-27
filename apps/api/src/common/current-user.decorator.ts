import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ userId?: string }>();
    return request.userId ?? process.env.DEFAULT_USER_ID ?? '';
  },
);
