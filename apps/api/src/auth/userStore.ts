import { createHash, randomUUID } from "node:crypto";
import {
  createTableClient,
  emitUsersTotalTelemetry,
  isStorageStatus,
  type TableClientLike
} from "../shared/tableStorage.js";

const usersTableName = "Users";

type EmailLookupEntity = {
  partitionKey: "email";
  rowKey: string;
  userId: string;
};

type UserEntity = {
  partitionKey: "user";
  rowKey: string;
  emailHash: string;
  email: string;
  createdAt: string;
  lastLoginAt: string;
};

export type UserAccount = {
  userId: string;
  email: string;
  emailHash: string;
};

let usersTableClient: TableClientLike | undefined;

/**Normalizes an email address for lookup and storage. */
export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Enter a valid email address.");
  }

  return normalized;
}

/**Hashes an email address for lookup rows without using raw email as a key. */
export function hashEmail(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

/**Creates and reads user identity rows in Table Storage. */
export class UserStore {
  constructor(
    private readonly table: TableClientLike = getUsersTableClient(),
    private readonly createUserId: () => string = () => `user_${randomUUID()}`,
    private readonly nowIso: () => string = () => new Date().toISOString()
  ) {}

  /**Returns an existing user for the email or creates a new stable user id. */
  async getOrCreateUserByEmail(email: string): Promise<UserAccount> {
    const normalizedEmail = normalizeEmail(email);
    const emailHash = hashEmail(normalizedEmail);
    const existingUserId = await this.findUserIdByEmailHash(emailHash);

    if (existingUserId) {
      return this.updateLastLogin(existingUserId, normalizedEmail, emailHash);
    }

    return this.createUser(normalizedEmail, emailHash);
  }

  /**Returns a user by stable id, or null when the session points at no current user. */
  async getUserById(userId: string): Promise<UserAccount | null> {
    try {
      const user = await this.table.getEntity<UserEntity>("user", userId);

      return {
        userId: user.rowKey,
        email: user.email,
        emailHash: user.emailHash
      };
    } catch (error) {
      if (isStorageStatus(error, 404)) {
        return null;
      }

      throw error;
    }
  }

  /**Looks up the user id associated with a normalized email hash. */
  private async findUserIdByEmailHash(emailHash: string): Promise<string | null> {
    try {
      const lookup = await this.table.getEntity<EmailLookupEntity>("email", emailHash);

      return lookup.userId;
    } catch (error) {
      if (isStorageStatus(error, 404)) {
        return null;
      }

      throw error;
    }
  }

  /**Creates the primary user row and the secondary email lookup row. */
  private async createUser(email: string, emailHash: string): Promise<UserAccount> {
    const userId = this.createUserId();
    const now = this.nowIso();
    const userEntity: UserEntity = {
      partitionKey: "user",
      rowKey: userId,
      emailHash,
      email,
      createdAt: now,
      lastLoginAt: now
    };
    const lookupEntity: EmailLookupEntity = {
      partitionKey: "email",
      rowKey: emailHash,
      userId
    };

    await this.table.upsertEntity(userEntity, "Replace");
    await this.table.upsertEntity(lookupEntity, "Replace");

    // Realtime metric: a brand-new account just landed, so refresh the users-total trace now.
    await emitUsersTotalTelemetry();

    return { userId, email, emailHash };
  }

  /**Refreshes lastLoginAt while preserving the user's stable id. */
  private async updateLastLogin(
    userId: string,
    email: string,
    emailHash: string
  ): Promise<UserAccount> {
    let createdAt = this.nowIso();

    try {
      const existing = await this.table.getEntity<UserEntity>("user", userId);
      createdAt = existing.createdAt;
    } catch (error) {
      if (!isStorageStatus(error, 404)) {
        throw error;
      }
    }

    const userEntity: UserEntity = {
      partitionKey: "user",
      rowKey: userId,
      emailHash,
      email,
      createdAt,
      lastLoginAt: this.nowIso()
    };

    await this.table.upsertEntity(userEntity, "Replace");

    return { userId, email, emailHash };
  }
}

function getUsersTableClient(): TableClientLike {
  if (!usersTableClient) {
    usersTableClient = createTableClient(usersTableName);
  }

  return usersTableClient;
}
