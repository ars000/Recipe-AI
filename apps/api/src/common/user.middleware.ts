import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class UserMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    (req as Request & { userId: string }).userId =
      process.env.DEFAULT_USER_ID ?? '00000000-0000-4000-8000-000000000001';
    next();
  }
}
