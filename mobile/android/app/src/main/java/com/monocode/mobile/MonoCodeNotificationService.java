package com.monocode.mobile;

import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Transfers Host-owned conversation activity while the WebView is suspended. */
public final class MonoCodeNotificationService extends Service {
    private static final int NOTIFICATION_ID = 9041;
    private ScheduledExecutorService executor;
    private volatile Config config;
    private volatile HttpURLConnection request;
    private int failures;
    private static final class Config {
        final String endpoint, token, environmentId;
        final JSONObject texts;
        Config(Intent intent) throws Exception {
            endpoint = intent.getStringExtra("endpoint"); token = intent.getStringExtra("token"); environmentId = intent.getStringExtra("environmentId");
            URI uri = new URI(endpoint);
            if (!("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) || uri.getHost() == null
                || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                || !(uri.getPath().isEmpty() || "/".equals(uri.getPath())) || token == null || !token.matches("[A-Za-z0-9_-]+") || environmentId == null)
                throw new IllegalArgumentException("Invalid notification connection");
            texts = new JSONObject(intent.getStringExtra("texts"));
        }
    }
    @Override public void onCreate() {
        super.onCreate();
        executor = Executors.newSingleThreadScheduledExecutor();
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            if (intent == null || !NotificationManagerCompat.from(this).areNotificationsEnabled()) { stopSelf(); return START_NOT_STICKY; }
            Config next = new Config(intent);
            boolean first = config == null;
            config = next;
            MobileActivityTracker.channels(this, next.texts);
            NotificationCompat.Builder notification = new NotificationCompat.Builder(this, MobileActivityTracker.MONITORING)
                .setSmallIcon(R.drawable.ic_stat_monocode).setContentTitle(next.texts.optString("monitoring", "Receiving conversation updates"))
                .setContentText(next.texts.optString("monitoringBody", "New replies will notify you while MonoCode is in the background."))
                .setOngoing(true).setSilent(true).setContentIntent(MobileActivityTracker.openIntent(this, next.environmentId, null, null));
            if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION_ID, notification.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING);
            else startForeground(NOTIFICATION_ID, notification.build());
            if (first) executor.execute(this::poll);
        } catch (Exception error) { config = null; stopSelf(); }
        return START_NOT_STICKY;
    }
    private void poll() {
        Config current = config;
        if (current == null || executor.isShutdown()) return;
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) { stopSelf(); return; }
        try {
            if (!MobileActivityTracker.foreground) {
                JSONObject activity = rpc(current);
                if (config != current) return;
                if (!current.environmentId.equals(activity.getString("environmentId"))) { config = null; stopSelf(); return; }
                JSONObject result = MobileActivityTracker.observe(this, current.environmentId, activity.getJSONArray("sessions"), true, current.texts);
                MonoCodeNotificationsPlugin.publishUnread(result);
            }
            failures = 0;
        } catch (ConnectionRejectedException error) { config = null; stopSelf(); return; }
        catch (Exception ignored) { failures = Math.min(failures + 1, 4); }
        finally {
            if (config != null && !executor.isShutdown()) executor.schedule(this::poll, failures == 0 ? 5 : Math.min(60, 5L << failures), TimeUnit.SECONDS);
        }
    }
    private static final class ConnectionRejectedException extends Exception {}
    private JSONObject rpc(Config current) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URI(current.endpoint + "/rpc").toURL().openConnection();
        request = connection;
        try {
            connection.setInstanceFollowRedirects(false);
            connection.setRequestMethod("POST"); connection.setConnectTimeout(10_000); connection.setReadTimeout(20_000); connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json"); connection.setRequestProperty("Authorization", "Bearer " + current.token);
            byte[] body = new JSONObject().put("version", 1).put("environmentId", current.environmentId)
                .put("method", "sessions.activity").put("params", new JSONObject()).toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(body.length);
            try (java.io.OutputStream output = connection.getOutputStream()) { output.write(body); }
            int status = connection.getResponseCode();
            if (status == 400 || status == 401 || status == 403) throw new ConnectionRejectedException();
            if (status != 200) throw new IllegalStateException("Notification activity unavailable");
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            try (java.io.InputStream input = connection.getInputStream()) {
                byte[] bytes = new byte[8192]; int length;
                while ((length = input.read(bytes)) != -1) {
                    if (buffer.size() + length > 8 * 1024 * 1024) throw new IllegalStateException("Activity response too large");
                    buffer.write(bytes, 0, length);
                }
            }
            return new JSONObject(buffer.toString(StandardCharsets.UTF_8.name())).getJSONObject("result");
        } finally { connection.disconnect(); if (request == connection) request = null; }
    }
    @Override public void onDestroy() {
        config = null;
        if (request != null) request.disconnect();
        if (executor != null) executor.shutdownNow();
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
