import type { HTMLAttributes, ReactNode } from "react";
import type { Attachment } from "../model/session";
import { AttachmentChip } from "./AttachmentChip";

/** Shared attachment list for transcripts and composers on both platforms. */
export function AttachmentList<T extends Attachment>({
  attachments, onRemove, renderAttachment, ...props
}: HTMLAttributes<HTMLDivElement> & {
  attachments: T[];
  onRemove?: (id: string) => void;
  renderAttachment?: (attachment: T) => ReactNode;
}) {
  return <div {...props}>
    {attachments.map(file => renderAttachment
      ? renderAttachment(file)
      : <AttachmentChip key={file.id} attachment={file} onRemove={onRemove ? () => onRemove(file.id) : undefined} />)}
  </div>;
}
