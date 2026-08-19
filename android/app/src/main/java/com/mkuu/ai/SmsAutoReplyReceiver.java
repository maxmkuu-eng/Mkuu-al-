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
 * Background SMS receiver for MKUU Auto Reply.
 *
 * This intentionally does NOT make MKUU the default SMS application. It only
 * observes incoming SMS broadcasts and replies when Auto Reply is explicitly
 * enabled and the sender matches the configured verified phone number.
 */
public class SmsAutoReplyReceiver extends BroadcastReceiver {
    private static final String PREFS = "mkuu_autoreply";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_EMERGENCY_STOP = "emergencyStop";
    private static final String KEY_VERIFIED_PHONE = "verifiedPhone";
    private static final String KEY_REPLY_TEXT = "replyText";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(KEY_ENABLED, false)) return;
        if (prefs.getBoolean(KEY_EMERGENCY_STOP, false)) return;

        String allowedNumber = normalize(prefs.getString(KEY_VERIFIED_PHONE, ""));
        if (allowedNumber.isEmpty()) return;

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

        // Only auto-reply to the number explicitly configured and verified.
        if (!normalize(sender).equals(allowedNumber)) return;

        String reply = prefs.getString(KEY_REPLY_TEXT, "").trim();
        if (reply.isEmpty()) return;

        try {
            SmsManager.getDefault().sendTextMessage(sender, null, reply, null, null);
        } catch (SecurityException ignored) {
            // Permission can be revoked by Android; fail closed and do not retry.
        }
    }

    private static String normalize(String number) {
        if (number == null) return "";
        return number.replaceAll("[^0-9+]", "");
    }
}
