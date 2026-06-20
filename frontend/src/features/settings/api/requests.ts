import { api } from "@/lib/api";
import type { UserInfo } from "@examify-tms/interfaces";

/**
 * Upload a profile picture for the authenticated user.
 * The backend resizes/compresses the image and returns the updated UserInfo.
 */
export async function uploadAvatarRequest(file: File): Promise<UserInfo> {
  const form = new FormData();
  form.append("avatar", file);
  // Override the client's default "application/json" so the browser sets the
  // multipart/form-data Content-Type with the correct boundary. Without this,
  // multer never sees a multipart body and req.file is undefined.
  const response = await api.post<UserInfo>("/api/users/me/avatar", form, {
    headers: { "Content-Type": undefined },
  });
  return response.data;
}
