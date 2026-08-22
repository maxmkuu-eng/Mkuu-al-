package com.mkuu.ai;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(GallerySaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
