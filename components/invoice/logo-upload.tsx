"use client";

import * as React from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { safeErrorMessage } from "@/lib/utils";

/**
 * Uploads to the private Supabase Storage bucket at `logos/<user_id>/`.
 * Storage policies isolate each user's folder, so no user can read or
 * overwrite another user's logo.
 */
export function LogoUpload({
  logoUrl,
  businessName,
  onUploaded,
  onRemoved,
}: {
  logoUrl: string | null;
  businessName: string;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}) {
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(logoUrl);

  React.useEffect(() => {
    setPreview(logoUrl);
  }, [logoUrl]);

  async function onFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo too large", "Please use an image under 2 MB.");
      return;
    }
    setUploading(true);
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/logo", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Upload failed.");
      onUploaded(json.data.url as string);
      toast.success("Logo uploaded");
    } catch (error) {
      setPreview(logoUrl);
      toast.error("Upload failed", safeErrorMessage(error));
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  async function remove() {
    setRemoving(true);
    try {
      const response = await fetch("/api/logo", { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "Could not remove the logo.");
      onRemoved();
      setPreview(null);
      toast.success("Logo removed");
    } catch (error) {
      toast.error("Could not remove the logo", safeErrorMessage(error));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex items-start gap-4">
      <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-ink-300 bg-ink-50">
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-ink-400" aria-hidden />
        ) : preview ? (
          <img
            src={preview}
            alt="Business logo preview"
            className="max-h-full max-w-full object-contain p-2"
          />
        ) : (
          <span className="px-2 text-center text-2xs text-ink-400">No logo</span>
        )}
      </div>

      <div className="min-w-0 space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
            event.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            loading={uploading}
            loadingText="Uploading…"
          >
            {!uploading ? <ImagePlus className="h-3.5 w-3.5" aria-hidden /> : null}
            {preview ? "Replace logo" : "Upload logo"}
          </Button>
          {preview ? (
            <Button size="sm" variant="ghost" onClick={remove} loading={removing} loadingText="Removing…">
              {!removing ? <Trash2 className="h-3.5 w-3.5" aria-hidden /> : null}
              Remove logo
            </Button>
          ) : null}
        </div>
        <p className="text-2xs leading-relaxed text-ink-500">
          PNG, JPG, WEBP or SVG · max 2 MB. Stored privately in{" "}
          <span className="font-mono">logos/&lt;your-id&gt;/</span> — only you can read it.
          {businessName ? "" : " A monogram is used until a logo is set."}
        </p>
      </div>
    </div>
  );
}
