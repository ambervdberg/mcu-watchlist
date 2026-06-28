import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { handleMe } from "../auth/authHandlers.js";

app.http("me", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "me",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    return handleMe(request);
  }
});
