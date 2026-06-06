import { Injectable } from '@nestjs/common';
import type { Role } from '@pulse/shared-types';
import { DatabaseService } from '../database/database.service';

export interface UserRow {
  id: string;
  entra_oid: string;
  display_name: string;
  email: string;
  role: Role;
  created_at: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  /** Insert on first login, update profile + role on subsequent logins. */
  async upsertFromEntra(input: {
    entraOid: string;
    displayName: string;
    email: string;
    role: Role;
  }): Promise<UserRow> {
    const { rows } = await this.db.query<UserRow>(
      `INSERT INTO users (entra_oid, display_name, email, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (entra_oid) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             email        = EXCLUDED.email,
             role         = EXCLUDED.role
       RETURNING *`,
      [input.entraOid, input.displayName, input.email, input.role],
    );
    return rows[0];
  }

  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(
      `SELECT * FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }
}
