import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** MVP: один demo-пользователь через DEFAULT_USER_ID. Расширение — JWT login. */
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDemoUser() {
    const id =
      process.env.DEFAULT_USER_ID ?? '00000000-0000-4000-8000-000000000001';
    return this.prisma.user.upsert({
      where: { id },
      create: { id, email: 'demo@recipe.local', displayName: 'Demo' },
      update: {},
    });
  }
}
