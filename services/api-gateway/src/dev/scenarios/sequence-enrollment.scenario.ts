import { Injectable, Logger } from '@nestjs/common';
import { ContactGenerator, GeneratedContact } from '../generators/contact.generator';
import { SequenceGenerator, GeneratedSequence } from '../generators/sequence.generator';
import { ContactsService } from '../../modules/contacts/contacts.service';
import { SequencesService } from '../../modules/sequences/services/sequences.service';
import { SYSTEM_USER_ID } from '../../common/constants/system';

export interface SequenceEnrollmentResult {
  scenario: string;
  success: boolean;
  duration: number;
  summary: {
    contactsCreated: number;
    sequenceId: string;
    sequenceName: string;
    sequenceType: string;
    stepsCount: number;
    enrolledContacts: number;
    failedEnrollments: number;
  };
  errors?: string[];
}

export interface SequenceEnrollmentOptions {
  contactCount?: number;
  sequenceType?: 'drip' | 'onboarding' | 'behavioral';
  enrollAll?: boolean;
  correlationId?: string;
}

/**
 * Sequence Enrollment Scenario
 * 
 * This scenario:
 * 1. Generates contacts
 * 2. Creates a sequence with steps
 * 3. Publishes the sequence (makes it active)
 * 4. Enrolls contacts into the sequence
 */
@Injectable()
export class SequenceEnrollmentScenario {
  private readonly logger = new Logger(SequenceEnrollmentScenario.name);

  constructor(
    private readonly contactGenerator: ContactGenerator,
    private readonly sequenceGenerator: SequenceGenerator,
    private readonly contactsService: ContactsService,
    private readonly sequencesService: SequencesService,
  ) {}

  async run(
    tenantId: string,
    options: SequenceEnrollmentOptions = {},
  ): Promise<SequenceEnrollmentResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const correlationId = options.correlationId || `seq-enroll-${Date.now()}`;
    
    const contactCount = options.contactCount || 10;
    const sequenceType = options.sequenceType || 'drip';
    const enrollAll = options.enrollAll !== false; // default true

    this.logger.log(`Starting sequence enrollment scenario: ${contactCount} contacts, type: ${sequenceType}`);

    // Step 1: Generate and create contacts
    this.logger.debug('Step 1: Creating contacts...');
    const generatedContacts = this.contactGenerator.generate({
      count: contactCount,
      tenantId,
      withPhone: true,
      withAcademic: true,
      withProfessional: true,
    });

    const createdContacts: { id: string; email: string }[] = [];
    for (const contactData of generatedContacts) {
      try {
        const contact = await this.contactsService.create(
          tenantId,
          contactData as any,
          SYSTEM_USER_ID,
          correlationId,
        );
        createdContacts.push({ id: contact.id, email: contact.email });
      } catch (error) {
        errors.push(`Failed to create contact ${contactData.email}: ${error.message}`);
      }
    }

    if (createdContacts.length === 0) {
      return {
        scenario: 'sequence-enrollment',
        success: false,
        duration: Date.now() - startTime,
        summary: {
          contactsCreated: 0,
          sequenceId: '',
          sequenceName: '',
          sequenceType,
          stepsCount: 0,
          enrolledContacts: 0,
          failedEnrollments: 0,
        },
        errors: ['No contacts created - aborting scenario'],
      };
    }

    this.logger.debug(`Created ${createdContacts.length} contacts`);

    // Step 2: Generate and create sequence
    this.logger.debug('Step 2: Creating sequence...');
    const [generatedSequence] = this.sequenceGenerator.generate({
      count: 1,
      tenantId,
      types: [sequenceType],
      minSteps: 4,
      maxSteps: 6,
    });

    let sequence: any;
    try {
      sequence = await this.sequencesService.create(
        tenantId,
        {
          name: generatedSequence.name,
          description: generatedSequence.description,
          type: generatedSequence.type as any,
          triggerConfig: generatedSequence.triggerConfig as any,
          steps: generatedSequence.steps.map(step => ({
            stepNumber: step.stepNumber,
            name: step.name,
            description: step.description,
            stepType: step.stepType as any,
            config: step.config as any,
          })),
        },
        SYSTEM_USER_ID,
        correlationId,
      );
      this.logger.debug(`Created sequence: ${sequence.id} - ${sequence.name}`);
    } catch (error) {
      return {
        scenario: 'sequence-enrollment',
        success: false,
        duration: Date.now() - startTime,
        summary: {
          contactsCreated: createdContacts.length,
          sequenceId: '',
          sequenceName: generatedSequence.name,
          sequenceType,
          stepsCount: generatedSequence.steps.length,
          enrolledContacts: 0,
          failedEnrollments: 0,
        },
        errors: [`Failed to create sequence: ${error.message}`],
      };
    }

    // Step 3: Publish the sequence
    this.logger.debug('Step 3: Publishing sequence...');
    try {
      await this.sequencesService.publish(tenantId, sequence.id, SYSTEM_USER_ID, correlationId);
      this.logger.debug('Sequence published');
    } catch (error) {
      errors.push(`Failed to publish sequence: ${error.message}`);
      // Continue anyway - enrollment might still work
    }

    // Step 4: Enroll contacts
    this.logger.debug('Step 4: Enrolling contacts...');
    let enrolledCount = 0;
    let failedCount = 0;

    if (enrollAll) {
      for (const contact of createdContacts) {
        try {
          await this.sequencesService.enrollContact(
            tenantId,
            sequence.id,
            contact.id,
            {
              source: 'dev-playground',
              variables: { scenario: 'sequence-enrollment' },
            },
            SYSTEM_USER_ID,
            correlationId,
          );
          enrolledCount++;
        } catch (error) {
          failedCount++;
          errors.push(`Failed to enroll ${contact.email}: ${error.message}`);
        }
      }
    }

    this.logger.log(`Scenario complete: ${enrolledCount} enrolled, ${failedCount} failed`);

    return {
      scenario: 'sequence-enrollment',
      success: errors.length === 0,
      duration: Date.now() - startTime,
      summary: {
        contactsCreated: createdContacts.length,
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        sequenceType: sequence.type,
        stepsCount: sequence.steps?.length || generatedSequence.steps.length,
        enrolledContacts: enrolledCount,
        failedEnrollments: failedCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
