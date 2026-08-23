package com.mkuu.ai;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Restores the native SMS auto-reply service after device/app updates and reboot. */
public class SmsAutoReplyBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;

        if (!context.getSharedPreferences("mkuu_autoreply", Context.MODE_PRIVATE)
                .getBoolean("enabled", false)) return;

        try {
            Intent serviceIntent = new Intent(context, SmsAutoReplyService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception error) {
            android.util.Log.e("MKUU_SMS", "Could not restore SMS auto-reply service", error);
        }
    }
}
