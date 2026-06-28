import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { handleConsumeLink } from "../auth/authHandlers.js";

app.http("consumeMagicLink", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/consume-link",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    return handleConsumeLink(request);
  }
});
