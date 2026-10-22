import { handleRegistrationRequest } from "@/features/auth/registration-handler";

export async function POST(request: Request) {
  return handleRegistrationRequest(request);
}
