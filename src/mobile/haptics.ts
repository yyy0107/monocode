import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

/** Feedback must never interrupt an action or vibrate the browser preview. */
export async function lightImpact(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform())
      await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics are optional on devices without a supported native plugin.
  }
}
