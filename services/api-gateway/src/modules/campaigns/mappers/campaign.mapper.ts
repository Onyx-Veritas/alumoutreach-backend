import { Campaign, CampaignChannel, CampaignStatus } from '../entities/campaign.entity';
import { CampaignRun, CampaignRunStatus } from '../entities/campaign-run.entity';
import { CampaignMessage, DispatchStatus } from '../entities/campaign-message.entity';
import {
  CampaignResponseDto,
  CampaignRunResponseDto,
  CampaignMessageResponseDto,
} from '../dto/campaign.dto';

export class CampaignMapper {
  static toResponseDto(campaign: Campaign): CampaignResponseDto {
    return {
      id: campaign.id,
      tenantId: campaign.tenantId,
      name: campaign.name,
      description: campaign.description,
      channel: campaign.channel,
      templateVersionId: campaign.templateVersionId,
      segmentId: campaign.segmentId,
      scheduleAt: campaign.scheduleAt,
      status: campaign.status,
      audienceCount: campaign.audienceCount,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      failedCount: campaign.failedCount,
      openedCount: campaign.openedCount,
      clickedCount: campaign.clickedCount,
      metadata: campaign.metadata,
      createdBy: campaign.createdBy,
      updatedBy: campaign.updatedBy,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  static toResponseDtoList(campaigns: Campaign[]): CampaignResponseDto[] {
    return campaigns.map(this.toResponseDto);
  }

  static toRunResponseDto(run: CampaignRun): CampaignRunResponseDto {
    return {
      id: run.id,
      campaignId: run.campaignId,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      totalRecipients: run.totalRecipients,
      processedCount: run.processedCount,
      sentCount: run.sentCount,
      failedCount: run.failedCount,
      errorMessage: run.errorMessage,
      createdAt: run.createdAt,
    };
  }

  static toMessageResponseDto(message: CampaignMessage): CampaignMessageResponseDto {
    return {
      id: message.id,
      campaignId: message.campaignId,
      runId: message.runId,
      contactId: message.contactId,
      dispatchStatus: message.dispatchStatus,
      providerMessageId: message.providerMessageId,
      dispatchError: message.dispatchError,
      sentAt: message.sentAt,
      deliveredAt: message.deliveredAt,
      openedAt: message.openedAt,
      clickedAt: message.clickedAt,
      createdAt: message.createdAt,
    };
  }

  static toMessageResponseDtoList(messages: CampaignMessage[]): CampaignMessageResponseDto[] {
    return messages.map(this.toMessageResponseDto);
  }
}
