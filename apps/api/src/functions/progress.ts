import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { requireAuthenticatedUser } from "../auth/auth.js";
import { getProgress, isString, saveProgress } from "../progress/progressStore.js";
import { readJson, serverError } from "../shared/http.js";

type SaveProgressRequest = {
  watchedIds?: unknown;
  skippedIds?: unknown;
  watchedDates?: unknown;
  watchedEpisodes?: unknown;
};

function toWatchedDates(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value).filter(([, date]) => isString(date)));
}

function toWatchedEpisodes(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([, episodeIds]) => Array.isArray(episodeIds) && episodeIds.every(isString)
    )
  );
}

app.http("getProgress", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "progress",
  handler: async (
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> => {
    const authResult = requireAuthenticatedUser(request);
    if (authResult.response) return authResult.response;

    try {
      const { watchedIds, skippedIds, watchedDates, watchedEpisodes } = await getProgress(
        authResult.user.userId
      );

      return {
        status: 200,
        jsonBody: {
          watchedIds,
          skippedIds,
          watchedDates,
          watchedEpisodes
        }
      };
    } catch (error) {
      return serverError(context, error, "Could not load progress.");
    }
  }
});

app.http("saveProgress", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "progress",
  handler: async (
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> => {
    const authResult = requireAuthenticatedUser(request);
    if (authResult.response) return authResult.response;

    try {
      const body = await readJson<SaveProgressRequest>(request);
      const watchedIds = Array.isArray(body?.watchedIds)
        ? body.watchedIds.filter(isString)
        : [];
      const skippedIds = Array.isArray(body?.skippedIds)
        ? body.skippedIds.filter(isString)
        : [];
      const watchedDates = toWatchedDates(body?.watchedDates);
      const watchedEpisodes = toWatchedEpisodes(body?.watchedEpisodes);

      await saveProgress(
        authResult.user.userId,
        watchedIds,
        skippedIds,
        watchedDates,
        watchedEpisodes
      );

      return {
        status: 200,
        jsonBody: {
          watchedIds,
          skippedIds,
          watchedDates,
          watchedEpisodes
        }
      };
    } catch (error) {
      return serverError(context, error, "Could not save progress.");
    }
  }
});
