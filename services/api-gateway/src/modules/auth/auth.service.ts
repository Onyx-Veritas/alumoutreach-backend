import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { AppLoggerService } from '../../common/logger/app-logger.service';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger: AppLoggerService;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly jwtService: JwtService,
    logger: AppLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext('AuthService');
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // Find tenant by slug
    const tenant = await this.findTenantBySlug(dto.tenantSlug);
    if (!tenant) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Find user by email within tenant
    const user = await this.userRepository.findOne({
      where: { email: dto.email, tenantId: tenant.id, deletedAt: null as any },
      relations: ['role'],
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Account not configured for password login');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    // Generate JWT
    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role?.name || 'user',
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.info('User logged in', { userId: user.id, tenantId: user.tenantId });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenantId,
        role: user.role?.name || 'user',
      },
    };
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Find tenant by slug
    const tenant = await this.findTenantBySlug(dto.tenantSlug);
    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant');
    }

    // Check if user already exists in this tenant
    const existing = await this.userRepository.findOne({
      where: { email: dto.email, tenantId: tenant.id, deletedAt: null as any },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    // Find default role for this tenant
    const defaultRole = await this.roleRepository.findOne({
      where: { tenantId: tenant.id, name: 'User' },
    });

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = this.userRepository.create({
      tenantId: tenant.id,
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      roleId: defaultRole?.id,
      isActive: true,
    });

    const saved = await this.userRepository.save(user);

    // Generate JWT
    const payload: JwtPayload = {
      sub: saved.id,
      tenantId: saved.tenantId,
      email: saved.email,
      role: defaultRole?.name || 'user',
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.info('User registered', { userId: saved.id, tenantId: saved.tenantId });

    return {
      accessToken,
      user: {
        id: saved.id,
        email: saved.email,
        fullName: saved.fullName,
        tenantId: saved.tenantId,
        role: defaultRole?.name || 'user',
      },
    };
  }

  async getProfile(userId: string): Promise<Omit<AuthResponseDto, 'accessToken'>> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenantId,
        role: user.role?.name || 'user',
      },
    };
  }

  async validateUserById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId, isActive: true, deletedAt: null as any },
      relations: ['role'],
    });
  }

  private async findTenantBySlug(slug: string): Promise<{ id: string; name: string } | null> {
    // Query tenants table directly since we don't have a tenant entity in the auth module
    const result = await this.userRepository.query(
      'SELECT id, name FROM tenants WHERE slug = $1 AND is_active = true',
      [slug],
    );
    return result.length > 0 ? result[0] : null;
  }
}
