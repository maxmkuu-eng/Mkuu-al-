package com.mkuu.ai;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;

public class SmsDeliveryReceiver extends BroadcastReceiver {
    private static SmsSenderPlugin eventSink;

    public static void setEventSink(SmsSenderPlugin plugin) {
        eventSink = plugin;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (eventSink == null || intent == null) return;
        String action = intent.getAction();
        if (!"com.mkuu.ai.SMS_SENT".equals(action) && !"com.mkuu.ai.SMS_DELIVERED".equals(action)) return;

        JSObject data = new JSObject();
        data.put("status", "com.mkuu.ai.SMS_DELIVERED".equals(action) ? "delivered" : "sent");
        data.put("to", intent.getStringExtra("to"));
        data.put("part", intent.getIntExtra("part", 1));
        data.put("total", intent.getIntExtra("total", 1));
        data.put("resultCode", getResultCode());
        data.put("timestamp", System.currentTimeMillis());
        eventSink.emitSmsStatus(data);
    }
}
