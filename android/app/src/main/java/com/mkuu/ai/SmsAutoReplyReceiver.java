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

/** Receives incoming SMS and replies only to numbers registered in MKUU Watu Wangu. */
public class SmsAutoReplyReceiver extends BroadcastReceiver {
    private static final String PREFS = "mkuu_autoreply";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_EMERGENCY_STOP = "emergencyStop";
    private static final String BACKEND_CHAT_URL = "https://mkuu-al-3.onrender.com/api/chat";
    private static final String BACKEND_PEOPLE_URL = "https://mkuu-al-3.onrender.com/api/people";

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
                if (!isAllowedPerson(from)) {
                    android.util.Log.i("MKUU_SMS", "Ignoring SMS from non-whitelisted number: " + from);
                    return;
                }

                String reply = requestMkuuReply(from, message);
                if (reply == null || reply.trim().isEmpty()) return;
                if (appContext.checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) return;

                SmsManager smsManager = SmsManager.getDefault();
                String text = cleanSmsReply(reply);
                if (text.isEmpty()) return;
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

    private static boolean isAllowedPerson(String sender) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(BACKEND_PEOPLE_URL);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setRequestProperty("Accept", "application/json");
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) return false;

            StringBuilder response = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) response.append(line);
            }

            JSONArray people;
            JSONObject root = new JSONObject(response.toString());
            if (root.has("people") && root.opt("people") instanceof JSONArray) people = root.getJSONArray("people");
            else if (root.has("data") && root.opt("data") instanceof JSONArray) people = root.getJSONArray("data");
            else if (root.has("results") && root.opt("results") instanceof JSONArray) people = root.getJSONArray("results");
            else if (root.has("phone")) people = new JSONArray().put(root);
            else return false;

            String normalizedSender = normalizePhone(sender);
            for (int i = 0; i < people.length(); i++) {
                JSONObject person = people.optJSONObject(i);
                if (person == null) continue;
                String phone = person.optString("phone", "");
                if (!phone.isEmpty() && normalizedSender.equals(normalizePhone(phone))) return true;
            }
        } catch (Exception e) {
            android.util.Log.w("MKUU_SMS", "Could not verify SMS sender whitelist", e);
        } finally {
            if (connection != null) connection.disconnect();
        }
        return false;
    }

    private static String normalizePhone(String value) {
        String digits = value == null ? "" : value.replaceAll("[^0-9]", "");
        if (digits.startsWith("255")) return digits;
        if (digits.startsWith("0") && digits.length() >= 9) return "255" + digits.substring(1);
        return digits;
    }

    private static String cleanSmsReply(String reply) {
        String text = reply == null ? "" : reply.trim();
        text = text.replaceFirst("(?i)^MKUU AI\\s*[:\\-]\\s*", "");
        text = text.replaceFirst("(?i)^AI\\s*[:\\-]\\s*", "");
        text = text.replaceAll("\\\\*\\\\*", "");
        text = text.replaceAll("(?m)^[-*]\\s+", "");
        return text.trim();
    }

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
            payload.put("message", "Jibu SMS hii kama mtu wa kawaida anayewasiliana kwa SMS. Jibu kwa kifupi, kwa heshima, na kwa lugha ileile ya mtumaji. Usijitambulishe kama AI, usitumie 'MKUU AI:', headings, bullets, markdown, au maelezo ya chatbot. Mtumaji: " + sender + "\nSMS: " + smsText);
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
            JSONObject json = new JSONObject(response.toString());
            return json.optString("reply", "").trim();
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
