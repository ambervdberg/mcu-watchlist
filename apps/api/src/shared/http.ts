import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function readJson<T>(request: HttpRequest): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}

export function serverError(
  context: InvocationContext,
  error: unknown,
  message: string
): HttpResponseInit {
  context.error(error);

  return {
    status: 500,
    jsonBody: {
      message
    }
  };
}
