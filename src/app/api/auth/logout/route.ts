import { logoutResponse } from "@/lib/auth/session";

export async function POST() {
  return logoutResponse();
}
