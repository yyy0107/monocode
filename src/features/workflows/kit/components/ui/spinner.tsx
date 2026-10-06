import { cn } from "../lib/utils.js";
import { Loader as LoaderIcon } from "../../../../../shared/ui/icons";
import { useWorkflowIntl } from "../../i18n/IntlProvider.js";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const { intl } = useWorkflowIntl();
  return (
    <LoaderIcon
      role="status"
      aria-label={intl.formatMessage({ id: "common.loading" })}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
