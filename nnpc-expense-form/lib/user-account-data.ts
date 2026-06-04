import { apiRequest } from "@/lib/api-client";

export type AccessStatus = "approved" | "disabled" | "pending";
export type AccountRole = "admin" | "central_admin" | "user";
export type AssignableRole = "admin" | "user";

export type UserAccount = {
  accessStatus: AccessStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  disabledAt: string | null;
  disabledBy: string | null;
  displayName: string;
  email: string;
  role: AccountRole;
  updatedAt: string;
  userId: string;
};

export type AdminUserManagementData = {
  totals: {
    approvedUsers: number;
    disabledUsers: number;
    elevatedUsers: number;
    pendingUsers: number;
  };
  users: UserAccount[];
};

export async function getCurrentUserAccount(accessToken: string) {
  void accessToken;
  return apiRequest<UserAccount>("/api/me");
}

export async function getAdminUserManagement(accessToken: string) {
  void accessToken;
  return apiRequest<AdminUserManagementData>("/api/admin/users");
}

export async function adminManageUserAccount({
  action,
  role,
  targetUserId,
}: {
  accessToken: string;
  action: "approve" | "delete" | "disable" | "set_role";
  role?: AssignableRole;
  targetUserId: string;
}) {
  return apiRequest<{ action: string; userId: string }>("/api/admin/users", {
    body: JSON.stringify({ action, role, targetUserId }),
    method: "POST",
  });
}

export async function deleteAdminUserStorageAssets(accessToken?: string, targetUserId?: string) {
  void accessToken;
  void targetUserId;
  return;
}
