package com.mkuu.ai;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.telephony.SmsManager;
import android.telephony.SmsMessage;
import android.provider.Telephony;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Receives every incoming SMS and sends the configured MKUU auto-reply using the selected SIM. */
public class SmsAutoReplyReceiver extends BroadcastReceiver {
    private static final String PREFS = "mkuu_autoreply";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_EMERGENCY_STOP = "emergencyStop";
    private static final String KEY_AUTO_REPLY_SUBSCRIPTION_ID = "autoReplySubscriptionId";
    private static final String BACKEND_CHAT_URL = "https://mkuu-al-3.onrender.com/api/chat";
    private static final String FIXED_AUTO_REPLY = "Habari, mimi ni MKUU AI, msaidizi wa Boss Max. Kwa sasa yupo busy, atakutafuta akiwa free. Asante.";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(KEY_ENABLED, true) || prefs.getBoolean(KEY_EMERGENCY_STOP, false)) return;
        if (context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED
                || context.checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) return;

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;
        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null || pdus.length == 0) return;

        String format = bundle.getString("format");
        StringBuilder body = new StringBuilder();
        String sender = "";
        for (Object pdu : pdus) {
            try {
                SmsMessage sms = format == null
                        ? SmsMessage.createFromPdu((byte[]) pdu)
                        : SmsMessage.createFromPdu((byte[]) pdu, format);
                if (sms == null) continue;
                if (sender.isEmpty() && sms.getOriginatingAddress() != null) sender = sms.getOriginatingAddress();
                String part = sms.getMessageBody();
                if (part != null) body.append(part);
            } catch (Exception e) {
                android.util.Log.w("MKUU_SMS", "Could not decode SMS part", e);
            }
        }

        final String message = body.toString().trim();
        final String from = sender.trim();
        if (message.isEmpty() || from.isEmpty()) return;

        final PendingResult pendingResult = goAsync();
        Context appContext = context.getApplicationContext();
        new Thread(() -> {
            try {
                String text = cleanSmsReply(FIXED_AUTO_REPLY);
                if (text.isEmpty()) return;
                if (appContext.checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) return;

                int selectedSubscriptionId = prefs.getInt(KEY_AUTO_REPLY_SUBSCRIPTION_ID, -1);
                SmsManager smsManager = selectedSubscriptionId >= 0
                        ? SmsManager.getSmsManagerForSubscriptionId(selectedSubscriptionId)
                        : SmsManager.getDefault();

                if (text.length() <= 160) {
                    smsManager.sendTextMessage(from, null, text, null, null);
                } else {
                    smsManager.sendMultipartTextMessage(from, null, smsManager.divideMessage(text), null, null);
                }
            } catch (Exception e) {
                android.util.Log.e("MKUU_SMS", "SMS auto reply failed", e);
            } finally {
                pendingResult.finish();
            }
        }, "mkuu-sms-reply").start();
    }

    private static String cleanSmsReply(String reply) {
        String text = reply == null ? "" : reply.trim();
        text = text.replaceFirst("(?i)^MKUU AI\\s*[:\\-]\\s*", "");
        text = text.replaceFirst("(?i)^AI\\s*[:\\-]\\s*", "");
        text = text.replace("**", "");
        text = text.replaceAll("(?m)^[-*]\\s+", "");
        return text.trim();
    }

    // Kept available for the existing server-backed SMS flow; auto-reply itself uses the fixed owner message above.
    @SuppressWarnings("unused")
    private static String requestMkuuReply(String sender, String smsText) throws Exception {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(BACKEND_CHAT_URL);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");

            JSONObject payload = new JSONObject();
            payload.put("userId", "user_max_owner");
            payload.put("message", "Jibu SMS hii kama mtu wa kawaida anayewasiliana kwa SMS.");
            payload.put("isVoice", false);
            payload.put("conversationHistory", new JSONArray());
            payload.put("people", new JSONArray());

            byte[] data = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = connection.getOutputStream()) { output.write(data); }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) return null;
            StringBuilder response = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) response.append(line);
            }
            return new JSONObject(response.toString()).optString("reply", "").trim();
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
