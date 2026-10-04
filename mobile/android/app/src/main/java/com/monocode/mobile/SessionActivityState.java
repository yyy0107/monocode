package com.monocode.mobile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Device-local read cursors and delivery cursors; independent of Android APIs. */
public final class SessionActivityState {
    public boolean initialized;
    public final Map<String, Entry> entries = new HashMap<>();
    public static final class Entry {
        public long revision, read, reply;
        public String finished, input;
    }
    public static final class Activity {
        public String id, projectId, title, finished, input;
        public long revision, reply;
        public boolean archived;
    }
    public static final class Notice {
        public final Activity activity;
        public final boolean input;
        Notice(Activity activity, boolean input) { this.activity = activity; this.input = input; }
    }
    public List<Notice> observe(List<Activity> activities, String visibleId) {
        List<Notice> notices = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (Activity activity : activities) {
            ids.add(activity.id);
            Entry entry = entries.get(activity.id);
            if (entry != null && entry.revision > activity.revision) continue;
            if (activity.archived) {
                markRead(activity.id, activity.revision);
                Entry archived = entries.get(activity.id);
                archived.revision = Math.max(archived.revision, activity.revision);
                if (activity.finished != null) archived.finished = activity.finished;
                if (activity.input != null) archived.input = activity.input;
                continue;
            }
            if (entry == null) {
                entry = new Entry();
                entry.read = initialized ? 0 : activity.revision;
                if (!initialized) { entry.finished = activity.finished; entry.input = activity.input; }
                entries.put(activity.id, entry);
            }
            entry.revision = activity.revision;
            entry.reply = Math.max(entry.reply, activity.reply);
            boolean newFinish = activity.finished != null && !Objects.equals(activity.finished, entry.finished);
            boolean newInput = activity.input != null && !Objects.equals(activity.input, entry.input);
            if (activity.finished != null) entry.finished = activity.finished;
            if (activity.input != null) entry.input = activity.input;
            if (entry.reply > entry.read && !Objects.equals(activity.id, visibleId) && (newFinish || newInput))
                notices.add(new Notice(activity, newInput));
        }
        entries.keySet().retainAll(ids);
        initialized = true;
        return notices;
    }
    public void markRead(String id, long revision) {
        markRead(id, revision, null, null);
    }
    public void markRead(String id, long revision, String finished, String input) {
        Entry entry = entries.get(id);
        if (entry == null) { entry = new Entry(); entry.revision = revision; entries.put(id, entry); }
        if (revision >= entry.revision) {
            if (finished != null) entry.finished = finished;
            if (input != null) entry.input = input;
        }
        entry.revision = Math.max(entry.revision, revision);
        entry.read = Math.max(entry.read, revision);
    }
    public List<String> unreadIds() {
        List<String> ids = new ArrayList<>();
        for (Map.Entry<String, Entry> row : entries.entrySet())
            if (row.getValue().reply > row.getValue().read) ids.add(row.getKey());
        return ids;
    }
}
