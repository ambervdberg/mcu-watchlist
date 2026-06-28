import { createHash, randomBytes } from "node:crypto";
import { sanitizeReturnPath } from "./auth.js";
import { createTableClient, isStorageStatus, type TableClientLike } from "../shared/tableStorage.js";
import { normalizeEmail } from "./userStore.js";

const loginTokensTableName = "LoginTokens";

type LoginTokenEntity = {
  partitionKey: "login";
  rowKey: string;
  etag?: string;
  email: string;
  returnPath: string;
  expiresAt: string;
  createdAt: string;
  usedAt?: string;
};

export type CreateLoginTokenRequest = {
  email: string;
  returnPath: string | undefined;
  expiresAt: string;
};

export type CreatedLoginToken = {
  rawToken: string;
  tokenHash: string;
  email: string;
  returnPath: string;
  expiresAt: string;
};

export type ConsumedLoginToken = {
  email: string;
  returnPath: string;
};

let loginTokensTableClient: TableClientLike | undefined;

/**Hashes a raw login token before it is stored or looked up. */
export function hashLoginToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**Creates and consumes one-time magic-link login tokens. */
export class LoginTokenStore {
  constructor(
    private readonly table: TableClientLike = getLoginTokensTableClient(),
    private readonly createRawToken: () => string = () => randomBytes(32).toString("base64url"),
    private readonly nowIso: () => string = () => new Date().toISOString()
  ) {}

  /**Stores a hashed login token and returns the raw token for email delivery. */
  async createLoginToken(request: CreateLoginTokenRequest): Promise<CreatedLoginToken> {
    const rawToken = this.createRawToken();
    const tokenHash = hashLoginToken(rawToken);
    const email = normalizeEmail(request.email);
    const returnPath = sanitizeReturnPath(request.returnPath);
    const tokenEntity: LoginTokenEntity = {
      partitionKey: "login",
      rowKey: tokenHash,
      email,
      returnPath,
      expiresAt: request.expiresAt,
      createdAt: this.nowIso()
    };

    await this.table.upsertEntity(tokenEntity, "Replace");

    return {
      rawToken,
      tokenHash,
      email,
      returnPath,
      expiresAt: request.expiresAt
    };
  }

  /**Consumes an unused token before expiry using the row ETag to reject racing consumes. */
  async consumeLoginToken(
    rawToken: string,
    nowIso = this.nowIso()
  ): Promise<ConsumedLoginToken | null> {
    const tokenHash = hashLoginToken(rawToken);

    try {
      const entity = await this.table.getEntity<LoginTokenEntity>("login", tokenHash);

      if (entity.usedAt || Date.parse(entity.expiresAt) <= Date.parse(nowIso)) {
        return null;
      }

      await this.table.updateEntity({ ...entity, usedAt: nowIso }, "Replace", { etag: entity.etag });

      return {
        email: entity.email,
        returnPath: entity.returnPath
      };
    } catch (error) {
      if (isStorageStatus(error, 404) || isStorageStatus(error, 412)) {
        return null;
      }

      throw error;
    }
  }
}

function getLoginTokensTableClient(): TableClientLike {
  if (!loginTokensTableClient) {
    loginTokensTableClient = createTableClient(loginTokensTableName);
  }

  return loginTokensTableClient;
}
