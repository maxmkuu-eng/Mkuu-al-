package com.mkuu.ai;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.PowerManager;
import android.telephony.SmsManager;
import android.telephony.SmsMessage;
import android.provider.Telephony;

/**
 * Native SMS receiver. Android can create this component for SMS_RECEIVED even when
 * the MKUU AI activity/WebView is not open. The fixed auto-reply is sent locally and
 * does not depend on the app UI, network, Gemini, or the chat server.
 */
public class SmsAutoReplyReceiver extends BroadcastReceiver {
    private static final String PREFS = "mkuu_autoreply";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_EMERGENCY_STOP = "emergencyStop";
    private static final String KEY_AUTO_REPLY_SUBSCRIPTION_ID = "autoReplySubscriptionId";
    private static final String FIXED_AUTO_REPLY = "Habari, mimi ni MKUU AI, msaidizi wa Boss Max. Kwa sasa yupo busy, atakutafuta akiwa free. Asante.";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(KEY_ENABLED, true) || prefs.getBoolean(KEY_EMERGENCY_STOP, false)) return;
        if (context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED
                || context.checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) return;

        final SmsMessage[] messages;
        try {
            messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        } catch (Exception error) {
            android.util.Log.e("MKUU_SMS", "Could not decode incoming SMS broadcast", error);
            return;
        }
        if (messages == null || messages.length == 0) return;

        String sender = "";
        for (SmsMessage sms : messages) {
            if (sms != null && sms.getOriginatingAddress() != null && !sms.getOriginatingAddress().trim().isEmpty()) {
                sender = sms.getOriginatingAddress().trim();
                break;
            }
        }
        if (sender.isEmpty()) return;

        // SMS_RECEIVED is delivered to this receiver even when the UI is closed.
        // Keep the CPU awake briefly while the telephony framework accepts the send.
        final PendingResult pendingResult = goAsync();
        final Context appContext = context.getApplicationContext();
        final PowerManager powerManager = (PowerManager) appContext.getSystemService(Context.POWER_SERVICE);
        final PowerManager.WakeLock wakeLock = powerManager == null ? null
                : powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MKUU:SmsAutoReply");
        if (wakeLock != null) {
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(15000L);
        }

        try {
            int selectedSubscriptionId = prefs.getInt(KEY_AUTO_REPLY_SUBSCRIPTION_ID, -1);
            if (selectedSubscriptionId < 0) {
                android.util.Log.w("MKUU_SMS", "Auto Reply skipped: no SIM selected by owner");
                return;
            }

            // Never fall back to SIM 1. Always use the exact subscription selected by the owner.
            SmsManager smsManager = SmsManager.getSmsManagerForSubscriptionId(selectedSubscriptionId);
            String text = cleanSmsReply(FIXED_AUTO_REPLY);
            if (text.length() <= 160) {
                smsManager.sendTextMessage(sender, null, text, null, null);
            } else {
                smsManager.sendMultipartTextMessage(sender, null, smsManager.divideMessage(text), null, null);
            }
            android.util.Log.i("MKUU_SMS", "Auto-reply accepted by telephony for " + sender
                    + " using subscription " + selectedSubscriptionId + " while app UI may be closed");
        } catch (Exception error) {
            android.util.Log.e("MKUU_SMS", "Background SMS auto reply failed", error);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
            pendingResult.finish();
        }
    }

    private static String cleanSmsReply(String reply) {
        String text = reply == null ? "" : reply.trim();
        text = text.replaceFirst("(?i)^MKUU AI\\s*[:\\-]\\s*", "");
        text = text.replaceFirst("(?i)^AI\\s*[:\\-]\\s*", "");
        text = text.replace("**", "");
        text = text.replaceAll("(?m)^[-*]\\s+", "");
        return text.trim();
    }
}
