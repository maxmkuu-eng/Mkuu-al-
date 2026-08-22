package com.mkuu.ai;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsManager;
import android.telephony.SmsMessage;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Receives SMS and, when Auto Reply is enabled, asks MKUU/Gemini for a reply.
 * Replies are sent through the device SIM using SmsManager.
 */
public class SmsAutoReplyReceiver extends BroadcastReceiver {
    private static final String PREFS = "mkuu_autoreply";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_EMERGENCY_STOP = "emergencyStop";
    private static final String BACKEND_CHAT_URL = "https://mkuu-al-3.onrender.com/api/chat";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(KEY_ENABLED, false) || prefs.getBoolean(KEY_EMERGENCY_STOP, false)) return;
        if (context.checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) return;

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;
        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null || pdus.length == 0) return;

        String format = bundle.getString("format");
        StringBuilder body = new StringBuilder();
        String sender = "";
        for (Object pdu : pdus) {
            SmsMessage sms;
            try {
                sms = SmsMessage.createFromPdu((byte[]) pdu, format);
            } catch (Exception e) {
                continue;
            }
            if (sms == null) continue;
            if (sender.isEmpty()) sender = sms.getOriginatingAddress();
            body.append(sms.getMessageBody());
        }

        final String message = body.toString().trim();
        final String from = sender == null ? "" : sender.trim();
        if (message.isEmpty() || from.isEmpty()) return;

        final PendingResult pendingResult = goAsync();
        new Thread(() -> {
            try {
                String reply = requestMkuuReply(from, message);
                if (reply != null && !reply.trim().isEmpty()
                        && context.checkSelfPermission(Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED) {
                    SmsManager.getDefault().sendTextMessage(from, null, reply.trim(), null, null);
                }
            } catch (Exception e) {
                android.util.Log.e("MKUU_SMS", "SMS auto reply failed", e);
            } finally {
                pendingResult.finish();
            }
        }, "mkuu-sms-reply").start();
    }

    private static String requestMkuuReply(String sender, String smsText) throws Exception {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(BACKEND_CHAT_URL);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(30000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");

            JSONObject payload = new JSONObject();
            payload.put("message", "Jibu SMS hii kwa kifupi na kwa lugha ileile ya mtumaji. Usitaje kwamba wewe ni mfumo wa AI isipokuwa ukiulizwa. Mtumaji: " + sender + "\nSMS: " + smsText);
            payload.put("isVoice", false);
            payload.put("conversationHistory", new org.json.JSONArray());
            payload.put("people", new org.json.JSONArray());

            byte[] data = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(data);
            }

            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300
                    ? connection.getInputStream() : connection.getErrorStream();
            if (stream == null || status < 200 || status >= 300) return null;

            StringBuilder response = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) response.append(line);
            }

            JSONObject json = new JSONObject(response.toString());
            return json.optString("reply", "").trim();
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
