export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_CONFLICT";

  constructor(message = "The idempotency key was already used for a different request.") {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export function hasDatabaseErrorCode(error: unknown, expectedCode: string) {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if (Reflect.get(current, "code") === expectedCode) return true;
    current = Reflect.get(current, "cause");
  }
  return false;
}
