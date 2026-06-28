import { TableClient } from "@azure/data-tables";

export type TableClientLike = {
  getEntity<T>(partitionKey: string, rowKey: string): Promise<T>;
  updateEntity(entity: object, mode?: "Merge" | "Replace", options?: { etag?: string }): Promise<unknown>;
  upsertEntity(entity: object, mode?: "Merge" | "Replace"): Promise<unknown>;
};

/**Creates a Table Storage client from the configured connection string. */
export function createTableClient(tableName: string): TableClientLike {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("STORAGE_CONNECTION_STRING is not configured.");
  }

  return TableClient.fromConnectionString(connectionString, tableName) as unknown as TableClientLike;
}

/**Counts entities in a table matching an OData filter, fetching only PartitionKey to keep the payload small. */
export async function countEntities(tableName: string, filter: string): Promise<number> {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("STORAGE_CONNECTION_STRING is not configured.");
  }

  const client = TableClient.fromConnectionString(connectionString, tableName);
  const entities = client.listEntities({
    queryOptions: { filter, select: ["PartitionKey"] }
  });

  let count = 0;
  for await (const _entity of entities) {
    count += 1;
  }

  return count;
}

/**Counts current user accounts and logs them as an AppTraces line for the users-total workbook tile.
 * Telemetry only: any failure (e.g. missing connection string in tests) is swallowed so it can
 * never break the request path that triggered it. */
export async function emitUsersTotalTelemetry(): Promise<void> {
  try {
    const total = await countEntities("Users", "PartitionKey eq 'user'");
    console.log(`users:total ${total}`);
  } catch {
    // Intentionally ignored: emitting the metric must not affect the caller.
  }
}

/**Returns true when an Azure SDK error has the expected HTTP status code. */
export function isStorageStatus(error: unknown, statusCode: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error.statusCode === statusCode
  );
}
