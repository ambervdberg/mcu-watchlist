import { createTableClient } from "../shared/tableStorage.js";

const rowKey = "marvel-mcu";

// Narrower than shared/tableStorage.ts's TableClientLike: progressStore only ever
// reads and replaces, so it doesn't need updateEntity. createTableClient()'s return
// value still satisfies this structurally (it's a superset).
type TableClientLike = {
  getEntity<T>(partitionKey: string, rowKey: string): Promise<T>;
  upsertEntity(entity: object, mode?: "Merge" | "Replace"): Promise<unknown>;
};

type ProgressEntity = {
  partitionKey: string;
  rowKey: string;
  watchedIds: string;
  skippedIds?: string;
  watchedDates?: string;
  watchedEpisodes?: string;
  updatedAt: string;
};

type Progress = {
  watchedIds: string[];
  skippedIds: string[];
  watchedDates: Record<string, string>;
  watchedEpisodes: Record<string, string[]>;
};

let tableClient: TableClientLike | undefined;

/**Reads and writes per-user watch progress rows in Table Storage. */
export class ProgressStore {
  constructor(
    private readonly table: TableClientLike = getTableClient(),
    private readonly nowIso: () => string = () => new Date().toISOString()
  ) {}

  /**Returns the saved progress for a user, or empty progress when no row exists yet. */
  async getProgress(userId: string): Promise<Progress> {
    try {
      const entity = await this.table.getEntity<ProgressEntity>(userId, rowKey);

      return {
        watchedIds: parseIdsJson(entity.watchedIds),
        skippedIds: parseIdsJson(entity.skippedIds),
        watchedDates: parseDatesJson(entity.watchedDates),
        watchedEpisodes: parseEpisodesJson(entity.watchedEpisodes)
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return { watchedIds: [], skippedIds: [], watchedDates: {}, watchedEpisodes: {} };
      }

      throw error;
    }
  }

  /**Saves the complete progress snapshot for one authenticated user. */
  async saveProgress(
    userId: string,
    watchedIds: string[],
    skippedIds: string[],
    watchedDates: Record<string, string>,
    watchedEpisodes: Record<string, string[]>
  ): Promise<void> {
    const uniqueWatchedIds = [...new Set(watchedIds.filter(isString))];
    const uniqueSkippedIds = [...new Set(skippedIds.filter(isString))];

    // Only keep dates for ids that are actually watched, so an unwatch followed
    // by a save can't leave a stale date behind for an item that's no longer marked.
    const relevantWatchedDates = Object.fromEntries(
      Object.entries(watchedDates).filter(
        ([id, date]) => uniqueWatchedIds.includes(id) && isString(date)
      )
    );

    await this.table.upsertEntity(
      {
        partitionKey: userId,
        rowKey,
        watchedIds: JSON.stringify(uniqueWatchedIds),
        skippedIds: JSON.stringify(uniqueSkippedIds),
        watchedDates: JSON.stringify(relevantWatchedDates),
        watchedEpisodes: JSON.stringify(watchedEpisodes),
        updatedAt: this.nowIso()
      },
      "Replace"
    );
  }
}

/**Returns saved progress for an authenticated user. */
export async function getProgress(userId: string): Promise<Progress> {
  return new ProgressStore().getProgress(userId);
}

/**Saves progress for an authenticated user. */
export async function saveProgress(
  userId: string,
  watchedIds: string[],
  skippedIds: string[],
  watchedDates: Record<string, string>,
  watchedEpisodes: Record<string, string[]>
): Promise<void> {
  return new ProgressStore().saveProgress(
    userId,
    watchedIds,
    skippedIds,
    watchedDates,
    watchedEpisodes
  );
}

// Parses a JSON-string array field on the entity, defaulting to [] when the
// property is absent (older rows predating this field) or not valid JSON.
function parseIdsJson(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed.filter(isString) : [];
  } catch {
    return [];
  }
}

// Parses a JSON-string id->date object field on the entity, defaulting to {}
// when the property is absent (older rows predating this field) or not valid JSON.
function parseDatesJson(value: string | undefined): Record<string, string> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, string] => isString(entry[1])
    );

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

// Parses a JSON-string id->episode-ids object field on the entity, defaulting
// to {} when the property is absent (older rows predating this field) or not
// valid JSON.
function parseEpisodesJson(value: string | undefined): Record<string, string[]> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, string[]] =>
        Array.isArray(entry[1]) && entry[1].every(isString)
    );

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function getTableClient(): TableClientLike {
  tableClient ??= createTableClient(process.env.TABLE_NAME ?? "WatchProgress");

  return tableClient;
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error.statusCode === 404
  );
}
