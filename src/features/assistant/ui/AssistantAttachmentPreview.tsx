import { useEffect, useState } from "react";
import { File as FileIcon, ImagePlus } from "../../../shared/ui/icons";
import type { AssistantDraftAttachment } from "./AssistantChatChrome";

export function AssistantAttachmentPreview({ file }: { file: AssistantDraftAttachment }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (file.kind !== "image" || !file.previewFile) return;
    const preview = URL.createObjectURL(file.previewFile);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file.kind, file.previewFile]);
  if (file.kind !== "image") return <FileIcon size={16} aria-hidden="true" />;
  return url
    ? <img className="assistant-attachment-preview" src={url} alt={file.name} />
    : <ImagePlus size={16} aria-hidden="true" />;
}
