import "server-only";

import { registerAccount } from "./service";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readBoundedJson, readRequestId } from "@/server/http/request";
import { getClientAddress, isSameOriginMutation } from "@/server/security/request";

const MAX_REGISTRATION_BODY_BYTES = 16 * 1024;

type RegistrationFunction = typeof registerAccount;

export async function handleRegistrationRequest(
  request: Request,
  register: RegistrationFunction = registerAccount,
) {
  const requestId = readRequestId(request);

  try {
    if (!isSameOriginMutation(request)) {
      throw new AppError("This request is not allowed.", "INVALID_ORIGIN", 403, false);
    }

    const input = await readBoundedJson(request, MAX_REGISTRATION_BODY_BYTES);
    await register(input, getClientAddress(request));

    return noStore(
      Response.json(
        { ok: true },
        { status: 201, headers: { "x-request-id": requestId } },
      ),
    );
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}
