package com.mkuu.ai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

/**
 * Keeps MKUU's native SMS receiver process resident after the UI leaves the foreground.
 * The actual SMS_RECEIVED handling remains in SmsAutoReplyReceiver.
 */
public class SmsAutoReplyService extends Service {
    private static final int NOTIFICATION_ID = 4201;
    private static final String CHANNEL_ID = "mkuu_sms_autoreply";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        Notification notification = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("MKUU AI Auto Reply")
                .setContentText("Auto Reply ya SMS iko tayari kufanya kazi hata ukiwa nje ya app.")
                .setSmallIcon(com.mkuu.ai.R.mipmap.ic_launcher)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "MKUU SMS Auto Reply",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Background service for MKUU SMS auto reply.");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }
}
