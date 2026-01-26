import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { AppLoggerService } from '../../../common/logger/app-logger.service';
import { Contact } from '../entities/contact.entity';

const CONTACT_INDEX = 'contacts';

export interface ContactSearchResult {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  designation?: string;
  city?: string;
  country?: string;
  score: number;
}

export interface SearchResponse {
  hits: ContactSearchResult[];
  total: number;
  took: number;
}

@Injectable()
export class ContactSearchService implements OnModuleInit {
  private client: Client | null = null;
  private readonly logger: AppLoggerService;
  private isConnected = false;

  constructor() {
    this.logger = new AppLoggerService();
    this.logger.setContext('ContactSearchService');
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  private async connect(): Promise<void> {
    const elasticUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    const startTime = this.logger.logOperationStart('connect to Elasticsearch', { url: elasticUrl });

    try {
      this.client = new Client({
        node: elasticUrl,
        requestTimeout: 30000,
        maxRetries: 3,
      });

      // Test connection
      await this.client.ping();

      // Ensure index exists
      await this.ensureIndex();

      this.isConnected = true;
      this.logger.logOperationEnd('connect to Elasticsearch', startTime);
      this.logger.info('Connected to Elasticsearch', { url: elasticUrl });
    } catch (error) {
      this.logger.logOperationError('connect to Elasticsearch', error as Error);
      this.logger.warn('Elasticsearch connection failed, search will use database fallback');
      this.isConnected = false;
    }
  }

  private async ensureIndex(): Promise<void> {
    if (!this.client) return;

    try {
      const exists = await this.client.indices.exists({ index: CONTACT_INDEX });

      if (!exists) {
        await this.client.indices.create({
          index: CONTACT_INDEX,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  contact_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'asciifolding', 'edge_ngram_filter'],
                  },
                },
                filter: {
                  edge_ngram_filter: {
                    type: 'edge_ngram',
                    min_gram: 2,
                    max_gram: 20,
                  },
                },
              },
            },
            mappings: {
              properties: {
                tenantId: { type: 'keyword' },
                fullName: {
                  type: 'text',
                  analyzer: 'contact_analyzer',
                  fields: {
                    keyword: { type: 'keyword' },
                  },
                },
                email: {
                  type: 'text',
                  analyzer: 'contact_analyzer',
                  fields: {
                    keyword: { type: 'keyword' },
                  },
                },
                phone: {
                  type: 'text',
                  analyzer: 'contact_analyzer',
                  fields: {
                    keyword: { type: 'keyword' },
                  },
                },
                whatsapp: { type: 'keyword' },
                company: {
                  type: 'text',
                  analyzer: 'contact_analyzer',
                  fields: {
                    keyword: { type: 'keyword' },
                  },
                },
                designation: { type: 'text' },
                department: { type: 'keyword' },
                batchYear: { type: 'integer' },
                graduationYear: { type: 'integer' },
                city: { type: 'keyword' },
                country: { type: 'keyword' },
                status: { type: 'keyword' },
                engagementScore: { type: 'integer' },
                roles: { type: 'keyword' },
                tags: { type: 'keyword' },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' },
              },
            },
          },
        });

        this.logger.info('Created Elasticsearch index', { index: CONTACT_INDEX });
      }
    } catch (error) {
      this.logger.logOperationError('ensure index', error as Error);
    }
  }

  async indexContact(contact: Contact, tags?: string[]): Promise<void> {
    if (!this.isConnected || !this.client) {
      this.logger.debug('Elasticsearch not connected, skipping indexing', { contactId: contact.id });
      return;
    }

    const startTime = this.logger.logOperationStart('index contact', {
      tenantId: contact.tenantId,
      contactId: contact.id,
    });

    try {
      const document = {
        tenantId: contact.tenantId,
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        whatsapp: contact.whatsapp,
        company: contact.currentCompany,
        designation: contact.designation,
        department: contact.department,
        batchYear: contact.batchYear,
        graduationYear: contact.graduationYear,
        city: contact.city,
        country: contact.country,
        status: contact.status,
        engagementScore: contact.engagementScore,
        roles: contact.roles,
        tags: tags || [],
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      };

      await this.client.index({
        index: CONTACT_INDEX,
        id: contact.id,
        body: document,
        refresh: true,
      });

      this.logger.logDbQuery('INDEX contact in Elasticsearch', 1, {
        tenantId: contact.tenantId,
        contactId: contact.id,
      });
      this.logger.logOperationEnd('index contact', startTime);
    } catch (error) {
      this.logger.logOperationError('index contact', error as Error, {
        tenantId: contact.tenantId,
        contactId: contact.id,
      });
    }
  }

  async removeFromIndex(contactId: string): Promise<void> {
    if (!this.isConnected || !this.client) return;

    const startTime = this.logger.logOperationStart('remove from index', { contactId });

    try {
      await this.client.delete({
        index: CONTACT_INDEX,
        id: contactId,
        refresh: true,
      });

      this.logger.logDbQuery('DELETE contact from Elasticsearch', 1, { contactId });
      this.logger.logOperationEnd('remove from index', startTime);
    } catch (error) {
      // Ignore 404 errors (document not found)
      if ((error as { statusCode?: number }).statusCode !== 404) {
        this.logger.logOperationError('remove from index', error as Error, { contactId });
      }
    }
  }

  async search(tenantId: string, query: string, options?: { limit?: number; offset?: number }): Promise<SearchResponse> {
    const startTime = this.logger.logOperationStart('search contacts', {
      tenantId,
      query,
      limit: options?.limit,
    });

    if (!this.isConnected || !this.client) {
      this.logger.warn('Elasticsearch not connected, returning empty results');
      return { hits: [], total: 0, took: 0 };
    }

    try {
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const response = await this.client.search({
        index: CONTACT_INDEX,
        body: {
          query: {
            bool: {
              must: [
                { term: { tenantId } },
              ],
              should: [
                {
                  multi_match: {
                    query,
                    fields: ['fullName^3', 'email^2', 'phone^2', 'company', 'designation'],
                    type: 'best_fields',
                    fuzziness: 'AUTO',
                  },
                },
                {
                  prefix: {
                    'fullName.keyword': {
                      value: query,
                      boost: 2,
                    },
                  },
                },
              ],
              minimum_should_match: 1,
            },
          },
          size: limit,
          from: offset,
          _source: ['fullName', 'email', 'phone', 'whatsapp', 'company', 'designation', 'city', 'country'],
        },
      });

      const hits: ContactSearchResult[] = response.hits.hits.map((hit) => ({
        id: hit._id as string,
        ...(hit._source as Record<string, unknown>),
        score: hit._score || 0,
      })) as ContactSearchResult[];

      const total = typeof response.hits.total === 'number' 
        ? response.hits.total 
        : response.hits.total?.value || 0;

      this.logger.logExternalCall('Elasticsearch', 'search', {
        tenantId,
        query,
        resultsCount: hits.length,
        total,
        took: response.took,
      });
      this.logger.logOperationEnd('search contacts', startTime, { total, returned: hits.length });

      return {
        hits,
        total,
        took: response.took || 0,
      };
    } catch (error) {
      this.logger.logOperationError('search contacts', error as Error, { tenantId, query });
      return { hits: [], total: 0, took: 0 };
    }
  }

  async rebuildIndex(tenantId: string, contacts: Contact[], batchSize = 100): Promise<{ indexed: number; failed: number }> {
    const startTime = this.logger.logOperationStart('rebuild index', {
      tenantId,
      totalContacts: contacts.length,
    });

    let indexed = 0;
    let failed = 0;

    if (!this.isConnected || !this.client) {
      this.logger.warn('Elasticsearch not connected, cannot rebuild index');
      return { indexed: 0, failed: contacts.length };
    }

    try {
      // Delete existing documents for tenant
      await this.client.deleteByQuery({
        index: CONTACT_INDEX,
        body: {
          query: { term: { tenantId } },
        },
        refresh: true,
      });

      this.logger.info('Deleted existing documents for tenant', { tenantId });

      // Bulk index in batches
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        const operations = batch.flatMap((contact) => [
          { index: { _index: CONTACT_INDEX, _id: contact.id } },
          {
            tenantId: contact.tenantId,
            fullName: contact.fullName,
            email: contact.email,
            phone: contact.phone,
            whatsapp: contact.whatsapp,
            company: contact.currentCompany,
            designation: contact.designation,
            department: contact.department,
            batchYear: contact.batchYear,
            graduationYear: contact.graduationYear,
            city: contact.city,
            country: contact.country,
            status: contact.status,
            engagementScore: contact.engagementScore,
            roles: contact.roles,
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt,
          },
        ]);

        const response = await this.client.bulk({
          body: operations,
          refresh: i + batchSize >= contacts.length, // Only refresh on last batch
        });

        if (response.errors) {
          const failedItems = response.items.filter((item) => item.index?.error);
          failed += failedItems.length;
          indexed += batch.length - failedItems.length;

          this.logger.warn('Some documents failed to index', {
            batch: Math.floor(i / batchSize) + 1,
            failed: failedItems.length,
          });
        } else {
          indexed += batch.length;
        }

        this.logger.debug('Indexed batch', {
          batch: Math.floor(i / batchSize) + 1,
          batchSize: batch.length,
          totalIndexed: indexed,
        });
      }

      this.logger.logOperationEnd('rebuild index', startTime, { indexed, failed });
      return { indexed, failed };
    } catch (error) {
      this.logger.logOperationError('rebuild index', error as Error, { tenantId });
      return { indexed, failed: contacts.length - indexed };
    }
  }
}
