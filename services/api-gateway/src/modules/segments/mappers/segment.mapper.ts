import { Segment } from '../entities/segment.entity';
import { SegmentMember } from '../entities/segment-member.entity';
import { SegmentResponseDto, SegmentMemberResponseDto, SegmentRulesDto } from '../dto/segment.dto';

export class SegmentMapper {
  static toResponseDto(segment: Segment): SegmentResponseDto {
    return {
      id: segment.id,
      tenantId: segment.tenantId,
      name: segment.name,
      description: segment.description,
      type: segment.type,
      status: segment.status,
      rules: segment.rules as SegmentRulesDto,
      eventConfig: segment.eventConfig,
      folder: segment.folder,
      tags: segment.tags || [],
      color: segment.color,
      memberCount: segment.memberCount,
      lastComputedAt: segment.lastComputedAt,
      computationDurationMs: segment.computationDurationMs,
      refreshIntervalMinutes: segment.refreshIntervalMinutes,
      nextRefreshAt: segment.nextRefreshAt,
      metadata: segment.metadata,
      createdBy: segment.createdBy,
      updatedBy: segment.updatedBy,
      createdAt: segment.createdAt,
      updatedAt: segment.updatedAt,
    };
  }

  static toMemberResponseDto(member: SegmentMember): SegmentMemberResponseDto {
    return {
      id: member.id,
      contactId: member.contactId,
      source: member.source,
      addedAt: member.addedAt,
      addedBy: member.addedBy,
      computedAt: member.computedAt,
    };
  }

  static toResponseDtoList(segments: Segment[]): SegmentResponseDto[] {
    return segments.map((s) => this.toResponseDto(s));
  }

  static toMemberResponseDtoList(members: SegmentMember[]): SegmentMemberResponseDto[] {
    return members.map((m) => this.toMemberResponseDto(m));
  }
}
