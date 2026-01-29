/**
 * System-level constants for unauthenticated or automated operations.
 * 
 * The SYSTEM_USER_ID is used for:
 * - Unauthenticated API calls (before login)
 * - Background jobs and automated processes
 * - Seed data creation
 * - System-generated records
 * 
 * This UUID is a well-known constant that should exist in the users table.
 */

export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * System user metadata for use in seeding and identification
 */
export const SYSTEM_USER = {
  id: SYSTEM_USER_ID,
  email: 'system@alumerp.internal',
  name: 'System',
} as const;
