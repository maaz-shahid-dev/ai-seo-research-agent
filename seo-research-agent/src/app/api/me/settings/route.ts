import { settingsUpdateSchema, type SettingsDto } from "@/features/settings/schemas";
import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import { getUserSettings, updateUserSettings } from "@/server/db/repositories";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readBoundedJson, readRequestId } from "@/server/http/request";
import { isSameOriginMutation } from "@/server/security/request";

/** The signed-in user's profile and preferences. */
export async function GET(request: Request) {
  const requestId = readRequestId(request);
  try {
    const user = await requireActiveUser();
    const settings = await getUserSettings(getDatabase(), user.id);
    if (!settings) throw new AppError("Account not found.", "NOT_FOUND", 404, false);
    return noStore(Response.json({ settings: settings satisfies SettingsDto }));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

/** Updates any subset of the signed-in user's settings. */
export async function PATCH(request: Request) {
  const requestId = readRequestId(request);
  try {
    if (!isSameOriginMutation(request)) {
      throw new AppError("This request is not allowed.", "INVALID_ORIGIN", 403, false);
    }
    const user = await requireActiveUser();
    const update = settingsUpdateSchema.parse(await readBoundedJson(request, 2 * 1024));
    const settings = await updateUserSettings(getDatabase(), user.id, update);
    if (!settings) throw new AppError("Account not found.", "NOT_FOUND", 404, false);
    return noStore(Response.json({ settings: settings satisfies SettingsDto }));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}
