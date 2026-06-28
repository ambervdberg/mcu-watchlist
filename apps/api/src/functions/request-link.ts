import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { handleRequestLink } from "../auth/authHandlers.js";

app.http("requestMagicLink", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "auth/request-link",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    return handleRequestLink(request);
  }
});
