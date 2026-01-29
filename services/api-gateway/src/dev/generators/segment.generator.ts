import { Injectable } from '@nestjs/common';
import { faker } from '@faker-js/faker';

export interface GenerateSegmentsOptions {
  count: number;
  tenantId: string;
  types?: ('static' | 'dynamic')[];
  includeComplexRules?: boolean;
}

export interface GeneratedSegment {
  name: string;
  description: string;
  type: 'static' | 'dynamic';
  rules?: SegmentRules;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SegmentRules {
  matchType: 'all' | 'any';
  conditions: SegmentCondition[];
}

export interface SegmentCondition {
  field: string;
  operator: string;
  value: unknown;
}

@Injectable()
export class SegmentGenerator {
  private readonly segmentNameTemplates = [
    'Class of {year}',
    '{department} Alumni',
    '{location} Region',
    'High Engagement',
    'Recent Graduates',
    'Major Donors',
    'Active Mentors',
    '{industry} Professionals',
    'Newsletter Subscribers',
    'Event Attendees',
    'Volunteers',
    'Board Members',
  ];

  private readonly fieldOperators: Record<string, string[]> = {
    'academic.graduationYear': ['equals', 'greaterThan', 'lessThan', 'between'],
    'academic.department': ['equals', 'in'],
    'professional.industry': ['equals', 'in'],
    'location.country': ['equals', 'in'],
    'location.city': ['equals', 'in'],
    'engagementScore': ['greaterThan', 'lessThan', 'between'],
    'roles': ['contains', 'in'],
    'status': ['equals'],
    'createdAt': ['after', 'before', 'between'],
  };

  /**
   * Generate a batch of segments
   */
  generate(options: GenerateSegmentsOptions): GeneratedSegment[] {
    const segments: GeneratedSegment[] = [];
    const types = options.types || ['static', 'dynamic'];

    for (let i = 0; i < options.count; i++) {
      segments.push(this.generateSingle(options, types, i));
    }

    return segments;
  }

  /**
   * Generate a single segment
   */
  private generateSingle(
    options: GenerateSegmentsOptions,
    types: ('static' | 'dynamic')[],
    index: number,
  ): GeneratedSegment {
    const type = faker.helpers.arrayElement(types);
    const name = this.generateSegmentName(index);

    const segment: GeneratedSegment = {
      name,
      description: this.generateDescription(name),
      type,
      tags: this.generateTags(),
    };

    // Dynamic segments need rules
    if (type === 'dynamic') {
      segment.rules = this.generateRules(options.includeComplexRules);
    }

    // Random metadata
    if (faker.datatype.boolean(0.3)) {
      segment.metadata = {
        createdBy: 'dev-playground',
        purpose: faker.helpers.arrayElement(['marketing', 'engagement', 'fundraising', 'events']),
        priority: faker.helpers.arrayElement(['high', 'medium', 'low']),
      };
    }

    return segment;
  }

  /**
   * Generate a realistic segment name
   */
  private generateSegmentName(index: number): string {
    const template = faker.helpers.arrayElement(this.segmentNameTemplates);
    
    return template
      .replace('{year}', faker.number.int({ min: 2000, max: 2024 }).toString())
      .replace('{department}', faker.helpers.arrayElement(['Engineering', 'Business', 'Arts', 'Science', 'Medicine']))
      .replace('{location}', faker.helpers.arrayElement(['Northeast', 'West Coast', 'Midwest', 'Southeast', 'International']))
      .replace('{industry}', faker.helpers.arrayElement(['Tech', 'Finance', 'Healthcare', 'Education']))
      + (index > 0 ? ` #${index + 1}` : '');
  }

  /**
   * Generate description based on segment name
   */
  private generateDescription(name: string): string {
    const templates = [
      `Alumni matching the "${name}" criteria`,
      `Segment for ${name.toLowerCase()} outreach`,
      `Auto-generated segment: ${name}`,
      `Target audience: ${name}`,
    ];
    return faker.helpers.arrayElement(templates);
  }

  /**
   * Generate segment rules for dynamic segments
   */
  private generateRules(complex: boolean = false): SegmentRules {
    const conditionCount = complex ? faker.number.int({ min: 2, max: 5 }) : faker.number.int({ min: 1, max: 2 });
    const conditions: SegmentCondition[] = [];

    const fields = Object.keys(this.fieldOperators);
    const usedFields = new Set<string>();

    for (let i = 0; i < conditionCount; i++) {
      let field: string;
      do {
        field = faker.helpers.arrayElement(fields);
      } while (usedFields.has(field) && usedFields.size < fields.length);
      
      usedFields.add(field);
      conditions.push(this.generateCondition(field));
    }

    return {
      matchType: faker.helpers.arrayElement(['all', 'any']),
      conditions,
    };
  }

  /**
   * Generate a single condition
   */
  private generateCondition(field: string): SegmentCondition {
    const operators = this.fieldOperators[field] || ['equals'];
    const operator = faker.helpers.arrayElement(operators);

    return {
      field,
      operator,
      value: this.generateValue(field, operator),
    };
  }

  /**
   * Generate appropriate value for field and operator
   */
  private generateValue(field: string, operator: string): unknown {
    if (operator === 'in') {
      return this.generateArrayValue(field);
    }

    if (operator === 'between') {
      if (field.includes('Year')) {
        return { min: 2010, max: 2020 };
      }
      if (field === 'engagementScore') {
        return { min: 50, max: 100 };
      }
      return { min: 0, max: 100 };
    }

    switch (field) {
      case 'academic.graduationYear':
        return faker.number.int({ min: 2000, max: 2024 });
      case 'academic.department':
        return faker.helpers.arrayElement(['Computer Science', 'Business', 'Engineering']);
      case 'professional.industry':
        return faker.helpers.arrayElement(['Technology', 'Finance', 'Healthcare']);
      case 'location.country':
        return faker.helpers.arrayElement(['United States', 'United Kingdom', 'Canada']);
      case 'location.city':
        return faker.location.city();
      case 'engagementScore':
        return faker.number.int({ min: 0, max: 100 });
      case 'roles':
        return faker.helpers.arrayElement(['alumnus', 'donor', 'mentor']);
      case 'status':
        return 'active';
      default:
        return faker.lorem.word();
    }
  }

  /**
   * Generate array value for 'in' operator
   */
  private generateArrayValue(field: string): unknown[] {
    const count = faker.number.int({ min: 2, max: 4 });
    const values: unknown[] = [];

    for (let i = 0; i < count; i++) {
      values.push(this.generateValue(field, 'equals'));
    }

    return [...new Set(values)]; // Remove duplicates
  }

  /**
   * Generate tags for segment
   */
  private generateTags(): string[] {
    const allTags = ['marketing', 'fundraising', 'events', 'newsletter', 'priority', 'vip', 'new'];
    const count = faker.number.int({ min: 0, max: 3 });
    return faker.helpers.arrayElements(allTags, count);
  }
}
