package com.monocode.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Device credentials and pending command journal stay encrypted at rest. */
@CapacitorPlugin(name = "MonoCodeCredentials")
public class MonoCodeCredentialsPlugin extends Plugin {
    private static final String ALIAS = "com.monocode.mobile.credentials";
    private SharedPreferences preferences() {
        return getContext().getSharedPreferences("monocode-credentials", Context.MODE_PRIVATE);
    }
    private String key(PluginCall call) {
        String key = call.getString("key");
        if (!"connection".equals(key) && !"pending".equals(key)) {
            call.reject("Invalid storage key");
            return null;
        }
        return key;
    }
    private SecretKey secret() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }
    @PluginMethod
    public synchronized void get(PluginCall call) {
        String key = key(call);
        if (key == null) return;
        try {
            JSObject result = new JSObject();
            String stored = preferences().getString(key, null);
            if (stored != null) {
                String[] parts = stored.split(":", 2);
                if (parts.length != 2) throw new Exception("Invalid stored credential");
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, secret(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
                cipher.updateAAD(key.getBytes(StandardCharsets.UTF_8));
                result.put("value", new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
            }
            call.resolve(result);
        } catch (Exception error) { call.reject("Unable to read secure storage", error); }
    }
    @PluginMethod
    public synchronized void set(PluginCall call) {
        String key = key(call);
        String value = call.getString("value");
        if (key == null) return;
        if (value == null) { call.reject("Missing value"); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, secret());
            cipher.updateAAD(key.getBytes(StandardCharsets.UTF_8));
            String stored = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" +
                Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!preferences().edit().putString(key, stored).commit()) throw new Exception("Storage write failed");
            call.resolve();
        } catch (Exception error) { call.reject("Unable to save secure storage", error); }
    }
    @PluginMethod
    public synchronized void remove(PluginCall call) {
        String key = key(call);
        if (key == null) return;
        if (preferences().edit().remove(key).commit()) call.resolve();
        else call.reject("Unable to remove secure storage");
    }
}
