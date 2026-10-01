import { requireUser, updateProfile } from "@/lib/invoice/service";
import { handleApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(200),
  newPassword: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(200)
    .regex(/[a-zA-Z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
});

const nameSchema = z.object({ fullName: z.string().trim().min(1).max(160) });

export async function PUT(request: Request) {
  try {
    const { user } = await requireUser();
    const body = (await readJson(request)) as Record<string, unknown>;

    if (body.fullName !== undefined) {
      const payload = nameSchema.parse(body);
      await updateProfile(user.id, payload.fullName);
      return jsonOk({ fullName: payload.fullName });
    }

    if (body.newPassword !== undefined) {
      const payload = passwordSchema.parse(body);
      const { supabase } = await requireUser();
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email ?? "",
        password: payload.currentPassword,
      });
      if (error) {
        return jsonError("Your current password is incorrect.", 400, "bad_password");
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: payload.newPassword,
      });
      if (updateError) {
        return jsonError("The password could not be changed.", 400, "update_failed");
      }
      return jsonOk({ passwordChanged: true });
    }

    return jsonError("Nothing to update.", 400);
  } catch (error) {
    return handleApiError(error, "PUT /api/account");
  }
}

/** Permanently delete the account and every row that belongs to it. */
export async function DELETE(request: Request) {
  try {
    const { user } = await requireUser();
    const body = (await readJson(request)) as { confirm?: string };
    if (body?.confirm !== user.email) {
      return jsonError("Type your email address to confirm deletion.", 400, "confirm_required");
    }

    const admin = createAdminClient();

    // remove storage files first (cascades handle the database rows)
    const { data: files } = await admin.storage.from("logos").list(`${user.id}`, { limit: 100 });
    const paths = (files ?? []).map((f) => `${user.id}/${f.name}`);
    if (paths.length) await admin.storage.from("logos").remove(paths);

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("[account] delete failed", error.message);
      return jsonError("The account could not be deleted.", 500, "delete_failed");
    }
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error, "DELETE /api/account");
  }
}
