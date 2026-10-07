import { useEffect, useState } from "react";
import { AttachmentChip } from "../../sessions/ui/AttachmentChip";
import type { AssistantDraftAttachment } from "./AssistantChatChrome";

export function AssistantAttachmentPreview({ file, onRemove }: { file: AssistantDraftAttachment; onRemove?: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (file.kind !== "image" || !file.previewFile) return;
    const preview = URL.createObjectURL(file.previewFile);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file.kind, file.previewFile]);
  return <AttachmentChip attachment={{ ...file, previewUrl: url }} onRemove={onRemove} />;
}
