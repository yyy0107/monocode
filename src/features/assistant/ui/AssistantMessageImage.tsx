import { useEffect, useState } from "react";
import type { RemoteAttachment } from "../../connections/model/protocol";
import { AttachmentChip } from "../../sessions/ui/AttachmentChip";
import { useSurfaceVisibility } from "../../../shared/ui/SurfaceVisibility";

export type ReadAssistantImage = (messageId: string, file: RemoteAttachment) => Promise<string>;

/** Preview bytes stay local; the public timeline retains its small attachment references. */
export function AssistantMessageImage({ messageId, file, readImage }: {
  messageId: string;
  file: RemoteAttachment;
  readImage: ReadAssistantImage;
}) {
  const visible = useSurfaceVisibility();
  const identity = JSON.stringify([messageId, file.id, file.mimeType, file.size]);
  const [preview, setPreview] = useState<{ readImage: ReadAssistantImage; identity: string; data: string }>();
  useEffect(() => {
    if (!visible || (preview?.readImage === readImage && preview.identity === identity)) return;
    let cancelled = false;
    void readImage(messageId, file).then(data => {
      if (!cancelled) setPreview({ readImage, identity, data });
    }, () => {
      // Older Hosts or missing bytes keep a usable filename fallback.
    });
    return () => { cancelled = true; };
  }, [messageId, file, identity, readImage, visible, preview]);
  return <AttachmentChip attachment={{ ...file, data: (preview?.readImage === readImage && preview.identity === identity) ? preview.data : undefined }} />;
}
