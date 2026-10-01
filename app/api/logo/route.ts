import { requireUser, getBusinessSettings, signedLogoUrl } from "@/lib/invoice/service";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * POST /api/logo — upload a business logo into the private `logos` bucket at
 * `logos/<user_id>/logo.<ext>`. Storage policies keep folders isolated per user.
 */
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return jsonError("Choose an image to upload.", 400, "no_file");
    }
    if (file.size > MAX_BYTES) {
      return jsonError("Logo must be smaller than 2 MB.", 413, "too_large");
    }
    const extension = ALLOWED[file.type];
    if (!extension) {
      return jsonError("Use a PNG, JPG, WEBP or SVG file.", 415, "unsupported_type");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // SVG is XML and can carry scripts — only accept it when it has no
    // dangerous constructs.
    if (file.type === "image/svg+xml") {
      const text = new TextDecoder().decode(bytes).toLowerCase();
      if (/<script|onload=|onclick=|<foreignobject|javascript:/i.test(text)) {
        return jsonError("That SVG file contains unsafe markup and was rejected.", 415, "unsafe_svg");
      }
    }

    const supabase = await createClient();
    const path = `${user.id}/logo.${extension}`;

    // replace any previous logo of a different extension
    const existing = await getBusinessSettings(user.id);
    if (existing?.logo_path && existing.logo_path !== path) {
      await supabase.storage.from("logos").remove([existing.logo_path]);
    }

    const { error } = await supabase.storage.from("logos").upload(path, bytes, {
      contentType: file.type,
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) {
      console.error("[logo] upload failed", error.message);
      return jsonError("The logo could not be uploaded. Try a smaller file.", 500, "upload_failed");
    }

    const signed = await signedLogoUrl(path, 60 * 60 * 24 * 365);
    const { error: updateError } = await supabase
      .from("business_settings")
      .upsert({ user_id: user.id, logo_path: path, logo_url: null }, { onConflict: "user_id" });
    if (updateError) {
      console.error("[logo] settings update failed", updateError.message);
    }

    return jsonOk({ path, url: signed });
  } catch (error) {
    return handleApiError(error, "POST /api/logo");
  }
}

/** DELETE /api/logo — remove the stored logo. */
export async function DELETE() {
  try {
    const { supabase, user } = await requireUser();
    const settings = await getBusinessSettings(user.id);

    if (settings?.logo_path) {
      await supabase.storage.from("logos").remove([settings.logo_path]);
    }
    await supabase
      .from("business_settings")
      .upsert({ user_id: user.id, logo_path: null, logo_url: null }, { onConflict: "user_id" });

    return jsonOk({ removed: true });
  } catch (error) {
    return handleApiError(error, "DELETE /api/logo");
  }
}

