import { Contact } from '../entities/contact.entity';
import {
  ContactResponseDto,
  AcademicInfoDto,
  ProfessionalInfoDto,
  LocationInfoDto,
  TagResponseDto,
  ConsentResponseDto,
  TimelineEventResponseDto,
  AttributeResponseDto,
} from '../dto/contact.dto';
import { ContactTag } from '../entities/contact-tag.entity';
import { ContactConsent } from '../entities/contact-consent.entity';
import { ContactTimelineEvent } from '../entities/contact-timeline-event.entity';
import { ContactAttribute } from '../entities/contact-attribute.entity';

export class ContactMapper {
  static toResponseDto(contact: Contact): ContactResponseDto {
    const response: ContactResponseDto = {
      id: contact.id,
      tenantId: contact.tenantId,
      externalId: contact.externalId,
      fullName: contact.fullName,
      preferredName: contact.preferredName,
      email: contact.email,
      emailSecondary: contact.emailSecondary,
      phone: contact.phone,
      whatsapp: contact.whatsapp,
      profileImageUrl: contact.profileImageUrl,
      status: contact.status,
      engagementScore: contact.engagementScore,
      roles: contact.roles,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };

    // Academic info
    if (contact.program || contact.batchYear || contact.department) {
      response.academic = {
        program: contact.program,
        specialization: contact.specialization,
        batchYear: contact.batchYear,
        graduationYear: contact.graduationYear,
        department: contact.department,
        rollNumber: contact.rollNumber,
        degree: contact.degree,
      };
    }

    // Professional info
    if (contact.currentCompany || contact.designation || contact.industry) {
      response.professional = {
        currentCompany: contact.currentCompany,
        designation: contact.designation,
        industry: contact.industry,
        linkedinUrl: contact.linkedinUrl,
        yearsOfExperience: contact.yearsOfExperience,
        skills: contact.skills,
      };
    }

    // Location info
    if (contact.city || contact.country || contact.state) {
      response.location = {
        city: contact.city,
        state: contact.state,
        country: contact.country,
        postalCode: contact.postalCode,
        timezone: contact.timezone,
      };
    }

    // Tags
    if (contact.tagMappings && contact.tagMappings.length > 0) {
      response.tags = contact.tagMappings
        .filter((m) => m.tag)
        .map((m) => ContactMapper.toTagResponseDto(m.tag));
    }

    // Consents
    if (contact.consents && contact.consents.length > 0) {
      response.consents = contact.consents.map((c) => ContactMapper.toConsentResponseDto(c));
    }

    return response;
  }

  static toTagResponseDto(tag: ContactTag): TagResponseDto {
    return {
      id: tag.id,
      name: tag.name,
      category: tag.category,
      color: tag.color,
    };
  }

  static toConsentResponseDto(consent: ContactConsent): ConsentResponseDto {
    return {
      channel: consent.channel,
      status: consent.status,
      source: consent.source,
      optedInAt: consent.optedInAt,
      optedOutAt: consent.optedOutAt,
      updatedAt: consent.updatedAt,
    };
  }

  static toTimelineEventResponseDto(event: ContactTimelineEvent): TimelineEventResponseDto {
    return {
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      description: event.description,
      data: event.data,
      channel: event.channel,
      referenceType: event.referenceType,
      referenceId: event.referenceId,
      occurredAt: event.occurredAt,
      actorId: event.actorId,
      actorType: event.actorType,
    };
  }

  static toAttributeResponseDto(attr: ContactAttribute): AttributeResponseDto {
    return {
      id: attr.id,
      key: attr.key,
      value: attr.value,
      valueType: attr.valueType,
      label: attr.label,
      category: attr.category,
      createdAt: attr.createdAt,
      updatedAt: attr.updatedAt,
    };
  }

  static applyAcademicInfo(contact: Contact, academic?: AcademicInfoDto): void {
    if (!academic) return;
    contact.program = academic.program ?? contact.program;
    contact.specialization = academic.specialization ?? contact.specialization;
    contact.batchYear = academic.batchYear ?? contact.batchYear;
    contact.graduationYear = academic.graduationYear ?? contact.graduationYear;
    contact.department = academic.department ?? contact.department;
    contact.rollNumber = academic.rollNumber ?? contact.rollNumber;
    contact.degree = academic.degree ?? contact.degree;
  }

  static applyProfessionalInfo(contact: Contact, professional?: ProfessionalInfoDto): void {
    if (!professional) return;
    contact.currentCompany = professional.currentCompany ?? contact.currentCompany;
    contact.designation = professional.designation ?? contact.designation;
    contact.industry = professional.industry ?? contact.industry;
    contact.linkedinUrl = professional.linkedinUrl ?? contact.linkedinUrl;
    contact.yearsOfExperience = professional.yearsOfExperience ?? contact.yearsOfExperience;
    contact.skills = professional.skills ?? contact.skills;
  }

  static applyLocationInfo(contact: Contact, location?: LocationInfoDto): void {
    if (!location) return;
    contact.city = location.city ?? contact.city;
    contact.state = location.state ?? contact.state;
    contact.country = location.country ?? contact.country;
    contact.postalCode = location.postalCode ?? contact.postalCode;
    contact.timezone = location.timezone ?? contact.timezone;
  }
}
