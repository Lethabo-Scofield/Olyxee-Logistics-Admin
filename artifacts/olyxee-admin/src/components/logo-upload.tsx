import { useEffect, useRef, useState } from "react";
import { Upload, X, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogoUploadProps {
  value: string;
  onFile: (file: File) => void;
  onRemove: () => void;
  businessName?: string;
  variant?: "logo" | "favicon";
}

export function LogoUpload({
  value,
  onFile,
  onRemove,
  businessName,
  variant = "logo",
}: LogoUploadProps) {
  const isFavicon = variant === "favicon";
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setPreviewError(false);
  }, [value]);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG, JPG, or SVG).");
      return;
    }
    onFile(file);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {value && !previewError ? (
        <div className="flex items-stretch gap-3 border border-border bg-background p-3">
          <div
            className={cn(
              "flex items-center justify-center bg-muted/40 border border-border flex-shrink-0",
              isFavicon ? "h-12 w-12" : "h-20 w-32",
            )}
          >
            <img
              src={value}
              alt={isFavicon ? "Favicon preview" : "Logo preview"}
              className="object-contain max-h-full max-w-full"
              onError={() => setPreviewError(true)}
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
            {businessName ? (
              isFavicon ? (
                <div className="inline-flex items-center gap-1.5 self-start max-w-full border border-border bg-background/60 pl-1.5 pr-2.5 py-1">
                  <img
                    src={value}
                    alt=""
                    aria-hidden="true"
                    className="h-3.5 w-3.5 object-contain flex-shrink-0"
                  />
                  <span className="text-xs font-medium truncate">{businessName}</span>
                </div>
              ) : (
                <span className="text-sm font-semibold truncate" title={businessName}>
                  {businessName}
                </span>
              )
            ) : (
              <span className="text-xs text-muted-foreground italic">
                Add a business name above to see it next to the{" "}
                {isFavicon ? "favicon" : "logo"}.
              </span>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Eye className="h-3 w-3" />
              {isFavicon ? "Favicon in use" : "Logo in use"}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "w-full flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed transition-colors text-center",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20 hover:bg-muted/40 hover:border-muted-foreground/40",
            previewError && "border-destructive/40",
          )}
        >
          {previewError ? (
            <>
              <AlertCircle className="h-6 w-6 text-destructive/70" aria-hidden="true" />
              <p className="text-sm font-medium text-destructive">Could not load image</p>
              <p className="text-xs text-muted-foreground">Click to upload a new one</p>
            </>
          ) : (
            <>
              <div className="h-9 w-9 flex items-center justify-center bg-background border border-border">
                <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium">
                Drop{" "}
                {isFavicon
                  ? "a favicon"
                  : businessName
                    ? `${businessName}'s logo`
                    : "your logo"}{" "}
                here, or <span className="text-primary">browse</span>
              </p>
              <p className="text-xs text-muted-foreground">PNG, SVG, or JPEG</p>
            </>
          )}
        </button>
      )}
    </>
  );
}
