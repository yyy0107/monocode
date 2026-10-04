package com.monocode.mobile;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.lang.ref.WeakReference;
import org.json.JSONObject;

@CapacitorPlugin(name = "MonoCodeNotifications", permissions = {
    @Permission(alias = "display", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public final class MonoCodeNotificationsPlugin extends Plugin {
    private static WeakReference<MonoCodeNotificationsPlugin> instance = new WeakReference<>(null);
    private JSObject pendingOpen;
    @Override public void load() { instance = new WeakReference<>(this); captureOpen(getActivity().getIntent()); }
    private JSObject permission() {
        JSObject result = new JSObject();
        String display = "granted";
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            PermissionState state = getPermissionState("display");
            display = Build.VERSION.SDK_INT >= 33 && state == PermissionState.PROMPT ? "prompt" : "denied";
        }
        result.put("display", display);
        return result;
    }
    @Override @PluginMethod public void checkPermissions(PluginCall call) { call.resolve(permission()); }
    @Override @PluginMethod public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && !NotificationManagerCompat.from(getContext()).areNotificationsEnabled()
            && getPermissionState("display") != PermissionState.GRANTED)
            requestPermissionForAlias("display", call, "permissionResult");
        else call.resolve(permission());
    }
    @PermissionCallback private void permissionResult(PluginCall call) { call.resolve(permission()); }
    @PluginMethod public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        getActivity().startActivity(intent); call.resolve();
    }
    @PluginMethod public void start(PluginCall call) {
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) { call.reject("Notifications are disabled"); return; }
        Intent intent = new Intent(getContext(), MonoCodeNotificationService.class)
            .putExtra("endpoint", call.getString("endpoint")).putExtra("token", call.getString("token"))
            .putExtra("environmentId", call.getString("environmentId")).putExtra("texts", call.getObject("texts", new JSObject()).toString());
        try {
            if (!MobileActivityTracker.preferences(getContext()).edit().putString("texts", call.getObject("texts", new JSObject()).toString()).commit())
                throw new IllegalStateException("Unable to save notification preferences");
            ContextCompat.startForegroundService(getContext(), intent); call.resolve();
        }
        catch (Exception error) { call.reject("Unable to receive background conversation updates", error); }
    }
    @PluginMethod public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), MonoCodeNotificationService.class)); call.resolve();
    }
    @PluginMethod public void state(PluginCall call) {
        String environmentId = call.getString("environmentId");
        if (environmentId == null) { call.reject("Missing Host identity"); return; }
        call.resolve(MobileActivityTracker.state(getContext(), environmentId));
    }
    @PluginMethod public void setVisible(PluginCall call) {
        try {
            String environmentId = call.getString("environmentId");
            if (environmentId == null) { call.reject("Missing Host identity"); return; }
            Double revision = call.getDouble("revision");
            call.resolve(MobileActivityTracker.visible(getContext(), environmentId, call.getString("sessionId"),
                revision == null ? null : revision.longValue(), call.getBoolean("foreground", true),
                call.getString("lastCompletedRunId"), call.getString("pendingInputKey")));
        } catch (Exception error) { call.reject("Unable to mark conversation read", error); }
    }
    @PluginMethod public void observe(PluginCall call) {
        try {
            String environmentId = call.getString("environmentId");
            if (environmentId == null || call.getArray("sessions") == null) { call.reject("Missing activity snapshot"); return; }
            JSONObject texts = new JSONObject(MobileActivityTracker.preferences(getContext()).getString("texts", "{}"));
            call.resolve(MobileActivityTracker.observe(getContext(), environmentId, call.getArray("sessions"), call.getBoolean("enabled", false), texts));
        } catch (Exception error) { call.reject("Unable to track conversation activity", error); }
    }
    @PluginMethod public void consumeOpen(PluginCall call) {
        JSObject result = new JSObject();
        if (pendingOpen != null) result.put("target", pendingOpen);
        pendingOpen = null; call.resolve(result);
    }
    static void publishUnread(JSONObject result) {
        MonoCodeNotificationsPlugin plugin = instance.get();
        if (plugin == null || plugin.getActivity() == null) return;
        plugin.getActivity().runOnUiThread(() -> {
            try { plugin.notifyListeners("unread", JSObject.fromJSONObject(result)); }
            catch (Exception ignored) { /* Foreground reconciliation loads persisted state. */ }
        });
    }
    private void captureOpen(Intent intent) {
        if (intent == null || !intent.hasExtra("monocodeSession")) return;
        JSObject target = new JSObject();
        target.put("environmentId", intent.getStringExtra("monocodeEnvironment"));
        target.put("projectId", intent.getStringExtra("monocodeProject"));
        target.put("sessionId", intent.getStringExtra("monocodeSession"));
        intent.removeExtra("monocodeSession");
        if (hasListeners("open")) notifyListeners("open", target);
        else pendingOpen = target;
    }
    @Override protected void handleOnNewIntent(Intent intent) { captureOpen(intent); }
    @Override protected void handleOnPause() { MobileActivityTracker.foreground = false; }
    @Override protected void handleOnResume() { MobileActivityTracker.foreground = true; }
    @Override protected void handleOnDestroy() {
        if (instance.get() == this) {
            instance.clear();
            MobileActivityTracker.foreground = false;
        }
    }
}
