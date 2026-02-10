import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ApiKey } from './entities/api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { AppLoggerService } from '../../common/logger/app-logger.service';

@Injectable()
export class ApiKeyService {
  private readonly logger: AppLoggerService;

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    logger: AppLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext('ApiKeyService');
  }

  async createKey(tenantId: string, userId: string, dto: CreateApiKeyDto): Promise<{ key: string; id: string }> {
    // Generate a random key with prefix
    const rawKey = randomBytes(32).toString('base64url');
    const fullKey = `ao_live_${rawKey}`;
    const keyHash = this.hashKey(fullKey);
    const keyPrefix = fullKey.substring(0, 12);

    const apiKey = this.apiKeyRepository.create({
      tenantId,
      userId,
      name: dto.name,
      keyHash,
      keyPrefix,
      scopes: dto.scopes || [],
      isActive: true,
    });

    const saved = await this.apiKeyRepository.save(apiKey);

    this.logger.info('API key created', { keyId: saved.id, tenantId, name: dto.name });

    // Return the full key only once — it cannot be retrieved again
    return { key: fullKey, id: saved.id };
  }

  async validateKey(key: string): Promise<{ tenantId: string; userId: string; scopes: string[] } | null> {
    const keyHash = this.hashKey(key);

    const apiKey = await this.apiKeyRepository.findOne({
      where: { keyHash, isActive: true },
    });

    if (!apiKey) {
      return null;
    }

    // Check expiry
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used (fire and forget)
    this.apiKeyRepository.update(apiKey.id, { lastUsedAt: new Date() }).catch(() => {});

    return {
      tenantId: apiKey.tenantId,
      userId: apiKey.userId,
      scopes: apiKey.scopes,
    };
  }

  async listKeys(tenantId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { tenantId, isActive: true },
      select: ['id', 'name', 'keyPrefix', 'scopes', 'lastUsedAt', 'expiresAt', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async revokeKey(id: string, tenantId: string): Promise<void> {
    await this.apiKeyRepository.update(
      { id, tenantId },
      { isActive: false },
    );
    this.logger.info('API key revoked', { keyId: id, tenantId });
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
}
