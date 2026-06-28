import { app, type HttpResponseInit } from "@azure/functions";
import { handleLogout } from "../auth/authHandlers.js";

app.http("logout", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "logout",
  handler: async (): Promise<HttpResponseInit> => {
    return handleLogout();
  }
});
