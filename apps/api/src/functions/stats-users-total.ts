import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { timingSafeEqual } from "node:crypto";
import { countEntities } from "../shared/tableStorage.js";
import { serverError } from "../shared/http.js";

const usersTableName = "Users";

// Only identity rows (PartitionKey "user") represent accounts; "email" lookup rows are excluded.
const userRowsFilter = "PartitionKey eq 'user'";

/**Constant-time comparison of the caller-supplied key against the configured stats secret. */
function isAuthorizedKey(providedKey: string): boolean {
  const configuredKey = process.env.STATS_API_KEY;

  if (!configuredKey) {
    return false;
  }

  const expected = Buffer.from(configuredKey);
  const actual = Buffer.from(providedKey);

  // Length check first; timingSafeEqual throws on length mismatch.
  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

/**Reads the key from the request body (trimmed), falling back to the x-stats-key header. */
async function readProvidedKey(request: HttpRequest): Promise<string> {
  const body = (await request.text()).trim();

  if (body.length > 0) {
    return body;
  }

  return request.headers.get("x-stats-key") ?? "";
}

app.http("statsUsersTotal", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "stats/users-total",
  handler: async (
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> => {
    const providedKey = await readProvidedKey(request);

    if (!isAuthorizedKey(providedKey)) {
      return { status: 401, jsonBody: { message: "Unauthorized." } };
    }

    try {
      const total = await countEntities(usersTableName, userRowsFilter);

      // Also emit the metric so a manual call to this endpoint seeds/refreshes the
      // users-total AppTraces line (e.g. to populate the workbook tile on demand).
      console.log(`users:total ${total}`);

      return {
        status: 200,
        jsonBody: { total }
      };
    } catch (error) {
      return serverError(context, error, "Could not count users.");
    }
  }
});
