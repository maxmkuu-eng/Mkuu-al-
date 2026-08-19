package com.mkuu.ai;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.telephony.SmsManager;
import android.content.SharedPreferences;

/**
 * Background SMS Auto Reply. MKUU is NOT the default SMS application.
 * The receiver is fail-closed: it replies only when explicitly enabled,
 * Emergency Stop is off, and the incoming sender is allowed by the settings.
 */
public class SmsAutoReplyReceiver extends BroadcastReceiver {
    private static final String PREFS = "mkuu_autoreply";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_EMERGENCY_STOP = "emergencyStop";
    private static final String KEY_VERIFIED_PHONE = "verifiedPhone";
    private static final String KEY_REPLY_TEXT = "replyText";
    private static final String KEY_ALLOWED_SENDERS = "allowedSenders";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(KEY_ENABLED, false) || prefs.getBoolean(KEY_EMERGENCY_STOP, false)) return;

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;
        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null) return;

        String format = bundle.getString("format");
        StringBuilder body = new StringBuilder();
        String sender = "";
        for (Object pdu : pdus) {
            SmsMessage sms = SmsMessage.createFromPdu((byte[]) pdu, format);
            if (sms == null) continue;
            sender = sms.getOriginatingAddress();
            body.append(sms.getMessageBody());
        }

        if (!isAllowedSender(prefs, sender)) return;

        // Until the backend/AI reply callback is connected, use the explicit
        // Auto Reply template configured by the user. Never send an empty SMS.
        String reply = prefs.getString(KEY_REPLY_TEXT, "").trim();
        if (reply.isEmpty()) return;

        try {
            SmsManager.getDefault().sendTextMessage(sender, null, reply, null, null);
        } catch (SecurityException ignored) {
            // Android permission was revoked: fail closed.
        }
    }

    private static boolean isAllowedSender(SharedPreferences prefs, String sender) {
        String normalizedSender = normalize(sender);
        if (normalizedSender.isEmpty()) return false;

        // Prefer an explicit sender allow-list when present.
        String rawAllowed = prefs.getString(KEY_ALLOWED_SENDERS, "").trim();
        if (!rawAllowed.isEmpty()) {
            for (String candidate : rawAllowed.split(",")) {
                if (normalizedSender.equals(normalize(candidate))) return true;
            }
            return false;
        }

        // Backward-compatible single verified number.
        String verified = normalize(prefs.getString(KEY_VERIFIED_PHONE, ""));
        return !verified.isEmpty() && normalizedSender.equals(verified);
    }

    private static String normalize(String number) {
        if (number == null) return "";
        return number.replaceAll("[^0-9+]", "");
    }
}
