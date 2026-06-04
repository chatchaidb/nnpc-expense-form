import { apiRequest, SESSION_EXPIRED_MESSAGE } from "@/lib/api-client";

export { SESSION_EXPIRED_MESSAGE };

export type UserProfile = {
  department: string;
  fullName: string;
};

export async function getUserProfile(accessToken: string) {
  void accessToken;
  return apiRequest<UserProfile | null>("/api/profile");
}

export async function upsertUserProfile({
  department,
  fullName,
}: {
  accessToken: string;
  department: string;
  fullName: string;
}) {
  return apiRequest<UserProfile>("/api/profile", {
    body: JSON.stringify({ department, fullName }),
    method: "PUT",
  });
}
