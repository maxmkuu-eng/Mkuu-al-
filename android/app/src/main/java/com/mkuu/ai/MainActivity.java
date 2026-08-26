package com.mkuu.ai;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int SMS_PERMISSION_REQUEST = 4101;
    private static final String PREFS = "mkuu_autoreply";
    private static final String KEY_AUTO_REPLY_SUBSCRIPTION_ID = "autoReplySubscriptionId";
    private static final String KEY_ENABLED = "enabled";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GallerySaverPlugin.class);
        registerPlugin(SmsSenderPlugin.class);
        super.onCreate(savedInstanceState);
        // Do this independently of SMS permissions so MKUU appears in Android's
        // battery/background controls even when SMS Auto Reply is not configured.
        ensureSmsBackgroundAccess();
        requestSmsPermissions();
    }

    private void requestSmsPermissions() {
        boolean receive = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean send = ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean phoneState = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        if (!receive || !send || !phoneState) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.RECEIVE_SMS, Manifest.permission.SEND_SMS, Manifest.permission.READ_PHONE_STATE},
                    SMS_PERMISSION_REQUEST);
        } else {
            showAutoReplySimPicker();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != SMS_PERMISSION_REQUEST) return;
        boolean receiveGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean phoneStateGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        boolean sendGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
        if (receiveGranted && phoneStateGranted && sendGranted) showAutoReplySimPicker();
        else android.util.Log.w("MKUU_SMS", "Auto Reply requires RECEIVE_SMS, SEND_SMS and READ_PHONE_STATE permissions");
    }

    private void showAutoReplySimPicker() {
        try {
            SubscriptionManager manager = (SubscriptionManager) getSystemService(TELEPHONY_SUBSCRIPTION_SERVICE);
            List<SubscriptionInfo> infos = manager.getActiveSubscriptionInfoList();
            if (infos == null || infos.isEmpty()) { ensureSmsBackgroundAccess(); return; }
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            int savedId = prefs.getInt(KEY_AUTO_REPLY_SUBSCRIPTION_ID, -1);
            String[] labels = new String[infos.size()];
            int checked = 0;
            for (int i = 0; i < infos.size(); i++) {
                SubscriptionInfo info = infos.get(i);
                String name = info.getDisplayName() == null ? "SIM " + (info.getSimSlotIndex() + 1) : info.getDisplayName().toString();
                String number = info.getNumber() == null ? "" : info.getNumber().trim();
                labels[i] = name + (number.isEmpty() ? "" : " — " + number);
                if (info.getSubscriptionId() == savedId) checked = i;
            }
            final int[] selected = {checked};
            new AlertDialog.Builder(this)
                    .setTitle("Line ya Auto Reply")
                    .setMessage("Chagua line ambayo MKUU AI atatumia kutuma majibu ya SMS. Line zote zinazopatikana kwenye simu zinaonyeshwa hapa.")
                    .setSingleChoiceItems(labels, checked, (dialog, which) -> selected[0] = which)
                    .setNegativeButton("Baadaye", null)
                    .setPositiveButton("Hifadhi", (dialog, which) -> {
                        SubscriptionInfo chosen = infos.get(selected[0]);
                        prefs.edit().putInt(KEY_AUTO_REPLY_SUBSCRIPTION_ID, chosen.getSubscriptionId()).putBoolean(KEY_ENABLED, true).apply();
                        startSmsAutoReplyService();
                        ensureSmsBackgroundAccess();
                    }).show();
        } catch (SecurityException e) {
            android.util.Log.w("MKUU_SMS", "SIM list unavailable without phone permission", e);
        } catch (Exception e) {
            android.util.Log.e("MKUU_SMS", "Could not show SIM picker", e);
        }
    }

    private void startSmsAutoReplyService() {
        try {
            Intent serviceIntent = new Intent(this, SmsAutoReplyService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(serviceIntent);
            else startService(serviceIntent);
        } catch (Exception error) {
            android.util.Log.e("MKUU_SMS", "Could not start persistent SMS auto-reply service", error);
        }
    }

    /**
     * Request Android's battery-optimization exemption directly on first launch.
     * Previously this was reached only through the SMS/SIM setup path, which meant
     * a normal MKUU installation never appeared in battery/background controls.
     */
    private void ensureSmsBackgroundAccess() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager == null || powerManager.isIgnoringBatteryOptimizations(getPackageName())) return;
            new AlertDialog.Builder(this)
                    .setTitle("MKUU AI — Background Access")
                    .setMessage("Ili MKUU AI iendelee kufanya kazi ukiwa kwenye app nyingine au screen ikiwa imezimwa, ruhusu MKUU AI kutotumia battery optimization.")
                    .setNegativeButton("Baadaye", null)
                    .setPositiveButton("Ruhusu", (dialog, which) -> {
                        try {
                            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                            intent.setData(Uri.parse("package:" + getPackageName()));
                            startActivity(intent);
                        } catch (Exception error) {
                            android.util.Log.w("MKUU_BACKGROUND", "Direct battery optimization request unavailable", error);
                            try { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
                            catch (Exception ignored) { android.util.Log.w("MKUU_BACKGROUND", "Battery optimization settings unavailable", ignored); }
                        }
                    }).show();
        } catch (Exception error) {
            android.util.Log.w("MKUU_BACKGROUND", "Could not check battery optimization state", error);
        }
    }
}
