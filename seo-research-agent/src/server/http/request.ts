import "server-only";

import { AppError } from "./errors";

export async function readBoundedJson(request: Request, maximumBytes: number): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new AppError("Send a JSON request.", "UNSUPPORTED_MEDIA_TYPE", 415, false);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw payloadTooLargeError();
  }
  if (!request.body) throw invalidJsonError();

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let decoded = "";
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maximumBytes) {
        await reader.cancel();
        throw payloadTooLargeError();
      }
      decoded += decoder.decode(value, { stream: true });
    }
    decoded += decoder.decode();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw invalidJsonError();
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(decoded) as unknown;
  } catch {
    throw invalidJsonError();
  }
}

export function readRequestId(request: Request) {
  const candidate = request.headers.get("x-request-id")?.trim();
  return candidate && /^[A-Za-z0-9._:-]{1,120}$/.test(candidate)
    ? candidate
    : crypto.randomUUID();
}

export function noStore(response: Response) {
  response.headers.set("cache-control", "no-store");
  return response;
}

function payloadTooLargeError() {
  return new AppError("The request is too large.", "PAYLOAD_TOO_LARGE", 413, false);
}

function invalidJsonError() {
  return new AppError("Send a valid JSON request.", "INVALID_JSON", 400, false);
}
