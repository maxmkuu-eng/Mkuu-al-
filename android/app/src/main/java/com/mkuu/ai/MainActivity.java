package com.mkuu.ai;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int SMS_PERMISSION_REQUEST = 4101;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GallerySaverPlugin.class);
        registerPlugin(SmsSenderPlugin.class);
        super.onCreate(savedInstanceState);
        requestSmsPermissions();
    }

    private void requestSmsPermissions() {
        boolean receive = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean send = ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean phoneState = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        if (!receive || !send || !phoneState) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.RECEIVE_SMS, Manifest.permission.SEND_SMS, Manifest.permission.READ_PHONE_STATE},
                    SMS_PERMISSION_REQUEST
            );
        }
    }
}
