import type { Role } from '@pulse/shared-types';
import { env } from '../config/env';

/**
 * Map Entra group object IDs (from the JWT `groups` claim) to a Pulse role.
 * Precedence: admin > member > viewer. Falls back to least privilege (viewer)
 * when the user belongs to no recognized group.
 */
export function groupsToRole(groups: string[] | undefined): Role {
  const ids = new Set(groups ?? []);
  if (ids.has(env.entra.groups.admin)) return 'pulse-admin';
  if (ids.has(env.entra.groups.member)) return 'pulse-member';
  if (ids.has(env.entra.groups.viewer)) return 'pulse-viewer';
  return 'pulse-viewer';
}
