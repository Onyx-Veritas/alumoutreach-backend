import { Template } from '../entities/template.entity';
import { TemplateVersion } from '../entities/template-version.entity';
import { TemplateResponseDto, TemplateVersionResponseDto } from '../dto/template.dto';

export class TemplateMapper {
  static toResponseDto(template: Template): TemplateResponseDto {
    const dto: TemplateResponseDto = {
      id: template.id,
      tenantId: template.tenantId,
      name: template.name,
      description: template.description,
      channel: template.channel,
      category: template.category,
      status: template.status,
      approvalStatus: template.approvalStatus,
      isApproved: template.isApproved,
      approvalNotes: template.approvalNotes,
      approvedBy: template.approvedBy,
      approvedAt: template.approvedAt,
      currentVersionId: template.currentVersionId,
      currentVersionNumber: template.currentVersionNumber,
      folder: template.folder,
      tags: template.tags || [],
      usageCount: template.usageCount,
      lastUsedAt: template.lastUsedAt,
      metadata: template.metadata,
      createdBy: template.createdBy,
      updatedBy: template.updatedBy,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };

    // Include current version if loaded
    if (template.currentVersion) {
      dto.currentVersion = this.toVersionResponseDto(template.currentVersion);
    }

    return dto;
  }

  static toVersionResponseDto(version: TemplateVersion): TemplateVersionResponseDto {
    return {
      id: version.id,
      templateId: version.templateId,
      versionNumber: version.versionNumber,
      channel: version.channel,
      content: version.content as unknown as Record<string, unknown>,
      variables: version.variables || [],
      changelog: version.changelog,
      isCurrent: version.isCurrent,
      isValid: version.isValid,
      validationErrors: version.validationErrors,
      createdBy: version.createdBy,
      createdAt: version.createdAt,
    };
  }

  static toResponseDtoList(templates: Template[]): TemplateResponseDto[] {
    return templates.map((t) => this.toResponseDto(t));
  }

  static toVersionResponseDtoList(versions: TemplateVersion[]): TemplateVersionResponseDto[] {
    return versions.map((v) => this.toVersionResponseDto(v));
  }
}
