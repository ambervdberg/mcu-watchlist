import { app, type HttpResponseInit } from "@azure/functions";

app.http("login", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "login",
  handler: async (): Promise<HttpResponseInit> => {
    // Password login is removed; magic-link routes will replace this endpoint.
    return {
      status: 410,
      jsonBody: {
        authenticated: false,
        message: "Password login has been removed."
      }
    };
  }
});
