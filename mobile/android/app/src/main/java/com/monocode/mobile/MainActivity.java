package com.monocode.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MonoCodeCredentialsPlugin.class);
        registerPlugin(MonoCodeUpdatesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
