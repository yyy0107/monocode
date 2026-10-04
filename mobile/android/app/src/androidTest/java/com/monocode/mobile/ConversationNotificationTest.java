package com.monocode.mobile;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.service.notification.StatusBarNotification;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

@RunWith(AndroidJUnit4.class)
public final class ConversationNotificationTest {
    @Test public void receivesOneSystemNotificationWithUnreadStateAfterWebViewBackgrounds() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(context.getPackageName(), Manifest.permission.POST_NOTIFICATIONS);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.cancelAll();
        MobileActivityTracker.preferences(context).edit().clear().commit();
        JSONObject old = new JSONObject().put("id", "one").put("projectId", "project").put("title", "Test conversation")
            .put("revision", 10).put("lastReplyRevision", 8).put("lastCompletedRunId", "old");
        MobileActivityTracker.observe(context, "test-host", new JSONArray().put(old), false, new JSONObject());
        AtomicInteger polls = new AtomicInteger();
        JSONObject[] received = { null };
        String[] authorization = { null };
        try (ServerSocket server = new ServerSocket(0, 10, InetAddress.getByName("127.0.0.1"));
             ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            Thread fixture = new Thread(() -> {
                while (!server.isClosed()) try (Socket socket = server.accept()) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
                    int length = 0;
                    String line;
                    while ((line = reader.readLine()) != null && !line.isEmpty()) {
                        if (line.toLowerCase().startsWith("content-length:")) length = Integer.parseInt(line.substring(line.indexOf(':') + 1).trim());
                        if (line.toLowerCase().startsWith("authorization:")) authorization[0] = line.substring(line.indexOf(':') + 1).trim();
                        assertFalse("Device HTTP must not send a browser Origin", line.toLowerCase().startsWith("origin:"));
                    }
                    char[] body = new char[length];
                    int offset = 0;
                    while (offset < length) { int read = reader.read(body, offset, length - offset); if (read < 0) break; offset += read; }
                    received[0] = new JSONObject(new String(body));
                    JSONObject reply = new JSONObject(old.toString()).put("revision", 12).put("lastReplyRevision", 12).put("lastCompletedRunId", "new");
                    byte[] response = new JSONObject().put("result", new JSONObject().put("environmentId", "test-host").put("sessions", new JSONArray().put(reply))).toString().getBytes(StandardCharsets.UTF_8);
                    socket.getOutputStream().write(("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: " + response.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                    socket.getOutputStream().write(response);
                    socket.getOutputStream().flush();
                    polls.incrementAndGet();
                } catch (Exception ignored) { /* Server close ends the fixture. */ }
            });
            fixture.setDaemon(true); fixture.start();
            // This test isolates native reception; React routing/read cursors
            // are exercised by the separate UI and bridge tests.
            scenario.onActivity(activity -> {
                activity.getBridge().getWebView().stopLoading();
                activity.getBridge().getWebView().loadUrl("about:blank");
            });
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            Thread.sleep(1_000);
            Intent intent = new Intent(context, MonoCodeNotificationService.class)
                .putExtra("endpoint", "http://127.0.0.1:" + server.getLocalPort()).putExtra("token", "test-device-token")
                .putExtra("environmentId", "test-host").putExtra("texts", "{\"reply\":\"A new reply is ready.\"}");
            scenario.onActivity(activity -> ContextCompat.startForegroundService(activity, intent));
            scenario.moveToState(Lifecycle.State.CREATED);
            StatusBarNotification delivered = null;
            long deadline = System.currentTimeMillis() + 20_000;
            while (delivered == null && System.currentTimeMillis() < deadline) {
                for (StatusBarNotification notification : manager.getActiveNotifications())
                    if ("test-host:one".equals(notification.getTag())) delivered = notification;
                if (delivered == null) Thread.sleep(200);
            }
            assertNotNull("Background conversation reply should reach the system notification manager; received polls=" + polls.get(), delivered);
            assertEquals("Test conversation", delivered.getNotification().extras.getString(Notification.EXTRA_TITLE));
            assertEquals("A new reply is ready.", delivered.getNotification().extras.getString(Notification.EXTRA_TEXT));
            assertEquals(1, received[0].getInt("version"));
            assertEquals("test-host", received[0].getString("environmentId"));
            assertEquals("sessions.activity", received[0].getString("method"));
            assertEquals("Bearer test-device-token", authorization[0]);
            assertEquals("one", MobileActivityTracker.state(context, "test-host").getJSONArray("unreadIds").getString(0));
            long posted = delivered.getPostTime();
            int firstPolls = polls.get();
            deadline = System.currentTimeMillis() + 12_000;
            while (polls.get() == firstPolls && System.currentTimeMillis() < deadline) Thread.sleep(200);
            assertTrue("Background reception should continue", polls.get() > firstPolls);
            for (StatusBarNotification notification : manager.getActiveNotifications())
                if ("test-host:one".equals(notification.getTag())) assertEquals("Repeated polling must not alert twice", posted, notification.getPostTime());
            MobileActivityTracker.visible(context, "test-host", "one", 12L, true);
            assertEquals("A stale WebView foreground flag must not mark a background reply read", 1,
                MobileActivityTracker.state(context, "test-host").getJSONArray("unreadIds").length());
            scenario.moveToState(Lifecycle.State.RESUMED);
            MobileActivityTracker.visible(context, "test-host", "one", 12L, true);
            assertEquals(0, MobileActivityTracker.state(context, "test-host").getJSONArray("unreadIds").length());
            for (StatusBarNotification notification : manager.getActiveNotifications()) assertNotEquals("test-host:one", notification.getTag());
        } finally {
            context.stopService(new Intent(context, MonoCodeNotificationService.class));
            manager.cancelAll();
        }
    }
}
