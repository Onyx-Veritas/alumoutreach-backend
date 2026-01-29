import { Injectable } from '@nestjs/common';
import { faker } from '@faker-js/faker';

export interface GenerateContactsOptions {
  count: number;
  tenantId: string;
  withPhone?: boolean;
  withWhatsapp?: boolean;
  withAcademic?: boolean;
  withProfessional?: boolean;
  graduationYearRange?: { min?: number; max?: number };
  departments?: string[];
  companies?: string[];
}

export interface GeneratedContact {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  emailSecondary?: string;
  phone?: string;
  phoneCountryCode?: string;
  whatsapp?: string;
  salutation?: string;
  gender?: string;
  dateOfBirth?: string;
  preferredLanguage: string;
  roles: string[];
  academic?: {
    graduationYear?: number;
    degree?: string;
    major?: string;
    department?: string;
    studentId?: string;
    gpa?: number;
  };
  professional?: {
    currentCompany?: string;
    currentTitle?: string;
    industry?: string;
    linkedinUrl?: string;
    yearsOfExperience?: number;
  };
  location?: {
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    timezone?: string;
  };
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ContactGenerator {
  private readonly salutations = ['Mr.', 'Ms.', 'Dr.', 'Prof.'];
  private readonly genders = ['male', 'female', 'other', 'prefer_not_to_say'];
  private readonly roles = ['alumnus', 'donor', 'mentor', 'volunteer', 'board_member'];
  private readonly degrees = ['B.S.', 'B.A.', 'M.S.', 'M.A.', 'MBA', 'Ph.D.', 'M.D.', 'J.D.'];
  private readonly departments = [
    'Computer Science',
    'Business Administration',
    'Engineering',
    'Liberal Arts',
    'Medicine',
    'Law',
    'Education',
    'Sciences',
  ];
  private readonly industries = [
    'Technology',
    'Finance',
    'Healthcare',
    'Education',
    'Consulting',
    'Manufacturing',
    'Retail',
    'Government',
  ];

  /**
   * Generate a batch of realistic contact data
   */
  generate(options: GenerateContactsOptions): GeneratedContact[] {
    const contacts: GeneratedContact[] = [];

    for (let i = 0; i < options.count; i++) {
      contacts.push(this.generateSingle(options, i));
    }

    return contacts;
  }

  /**
   * Generate a single contact with realistic data
   */
  private generateSingle(options: GenerateContactsOptions, index: number): GeneratedContact {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const gender = faker.helpers.arrayElement(this.genders);
    
    const contact: GeneratedContact = {
      fullName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      email: this.generateUniqueEmail(firstName, lastName, index),
      salutation: faker.helpers.arrayElement(this.salutations),
      gender,
      dateOfBirth: faker.date.birthdate({ min: 22, max: 70, mode: 'age' }).toISOString().split('T')[0],
      preferredLanguage: faker.helpers.arrayElement(['en', 'es', 'fr', 'de', 'zh']),
      roles: this.generateRoles(),
    };

    // Optional secondary email
    if (faker.datatype.boolean(0.3)) {
      contact.emailSecondary = faker.internet.email({ firstName, lastName, provider: 'personal.com' });
    }

    // Phone numbers
    if (options.withPhone !== false && faker.datatype.boolean(0.8)) {
      contact.phoneCountryCode = faker.helpers.arrayElement(['+1', '+44', '+91', '+86', '+49']);
      contact.phone = faker.phone.number({ style: 'national' });
    }

    // WhatsApp
    if (options.withWhatsapp && faker.datatype.boolean(0.6)) {
      contact.whatsapp = contact.phone || faker.phone.number({ style: 'international' });
    }

    // Academic information
    if (options.withAcademic !== false) {
      const yearRange = {
        min: options.graduationYearRange?.min ?? 1990,
        max: options.graduationYearRange?.max ?? 2024,
      };
      const depts = options.departments || this.departments;
      
      contact.academic = {
        graduationYear: faker.number.int({ min: yearRange.min, max: yearRange.max }),
        degree: faker.helpers.arrayElement(this.degrees),
        major: faker.helpers.arrayElement(['Computer Science', 'Economics', 'Biology', 'Psychology', 'Engineering', 'English', 'Mathematics']),
        department: faker.helpers.arrayElement(depts),
        studentId: faker.string.alphanumeric(8).toUpperCase(),
        gpa: parseFloat(faker.number.float({ min: 2.5, max: 4.0, fractionDigits: 2 }).toFixed(2)),
      };
    }

    // Professional information
    if (options.withProfessional !== false) {
      const companies = options.companies || [
        'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta',
        'Goldman Sachs', 'McKinsey', 'Deloitte', 'Johnson & Johnson',
        'Tesla', 'Netflix', 'Uber', 'Airbnb', 'Stripe',
      ];
      
      contact.professional = {
        currentCompany: faker.helpers.arrayElement(companies),
        currentTitle: faker.person.jobTitle(),
        industry: faker.helpers.arrayElement(this.industries),
        linkedinUrl: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${faker.string.alphanumeric(6)}`,
        yearsOfExperience: faker.number.int({ min: 0, max: 40 }),
      };
    }

    // Location
    contact.location = {
      city: faker.location.city(),
      state: faker.location.state(),
      country: faker.helpers.arrayElement(['United States', 'United Kingdom', 'Canada', 'Germany', 'India', 'Australia']),
      postalCode: faker.location.zipCode(),
      timezone: faker.helpers.arrayElement(['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'Asia/Kolkata']),
    };

    // Random metadata
    if (faker.datatype.boolean(0.4)) {
      contact.metadata = {
        source: faker.helpers.arrayElement(['import', 'registration', 'referral', 'event']),
        importBatch: faker.string.uuid(),
        notes: faker.lorem.sentence(),
      };
    }

    return contact;
  }

  /**
   * Generate unique email to avoid conflicts
   */
  private generateUniqueEmail(firstName: string, lastName: string, index: number): string {
    const domain = faker.helpers.arrayElement(['alumni.edu', 'example.com', 'test.edu', 'demo.org']);
    const randomSuffix = faker.string.alphanumeric(4);
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${index}.${randomSuffix}@${domain}`;
  }

  /**
   * Generate a realistic set of roles
   */
  private generateRoles(): string[] {
    const roles = ['alumnus']; // Everyone is at least an alumnus
    
    // Add additional roles with probability
    if (faker.datatype.boolean(0.2)) roles.push('donor');
    if (faker.datatype.boolean(0.1)) roles.push('mentor');
    if (faker.datatype.boolean(0.05)) roles.push('volunteer');
    if (faker.datatype.boolean(0.02)) roles.push('board_member');
    
    return roles;
  }
}
