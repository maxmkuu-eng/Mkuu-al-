package com.mkuu.ai;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "SmsSender",
    permissions = {
        @Permission(strings = { Manifest.permission.SEND_SMS, Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_PHONE_STATE }, alias = "autoreply"),
        @Permission(strings = { Manifest.permission.READ_PHONE_STATE }, alias = "phone")
    }
)
public class SmsSenderPlugin extends Plugin {
    private static final String SENT_ACTION = "com.mkuu.ai.SMS_SENT";
    private static final String DELIVERED_ACTION = "com.mkuu.ai.SMS_DELIVERED";

    @Override
    public void load() {
        SmsDeliveryReceiver.setEventSink(this);
    }

    void emitSmsStatus(JSObject data) {
        notifyListeners("smsStatus", data);
    }

    @com.getcapacitor.PluginMethod
    public void getSimCards(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("phone", call, "getSimCards");
            return;
        }
        SubscriptionManager manager = (SubscriptionManager) getContext().getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
        List<SubscriptionInfo> infos = manager.getActiveSubscriptionInfoList();
        JSArray sims = new JSArray();
        if (infos != null) {
            for (SubscriptionInfo info : infos) {
                JSObject sim = new JSObject();
                sim.put("subscriptionId", info.getSubscriptionId());
                sim.put("slotIndex", info.getSimSlotIndex());
                sim.put("displayName", info.getDisplayName() == null ? "SIM " + (info.getSimSlotIndex() + 1) : info.getDisplayName().toString());
                sim.put("number", info.getNumber() == null ? "" : info.getNumber());
                sims.put(sim);
            }
        }
        JSObject ret = new JSObject();
        ret.put("sims", sims);
        call.resolve(ret);
    }

    // MKUU_AUTO_REPLY_SIM_SELECTOR_V1
    // These settings are stored in native SharedPreferences, not in the WebView.
    // Therefore SmsAutoReplyReceiver can use them when the MKUU AI UI is closed.
    @com.getcapacitor.PluginMethod
    public void getAutoReplySim(PluginCall call) {
        android.content.SharedPreferences prefs = getContext().getSharedPreferences("mkuu_autoreply", Context.MODE_PRIVATE);
        int subscriptionId = prefs.getInt("autoReplySubscriptionId", -1);
        JSObject ret = new JSObject();
        ret.put("subscriptionId", subscriptionId);
        call.resolve(ret);
    }

    @com.getcapacitor.PluginMethod
    public void setAutoReplySim(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("autoreply", call, "setAutoReplySim");
            return;
        }

        int subscriptionId = call.getInt("subscriptionId", -1);
        if (subscriptionId < 0) {
            call.reject("Invalid SIM subscription ID");
            return;
        }

        SubscriptionManager manager = (SubscriptionManager) getContext().getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
        List<SubscriptionInfo> infos = manager.getActiveSubscriptionInfoList();
        boolean exists = false;
        if (infos != null) {
            for (SubscriptionInfo info : infos) {
                if (info.getSubscriptionId() == subscriptionId) {
                    exists = true;
                    break;
                }
            }
        }
        if (!exists) {
            call.reject("Selected SIM is not active");
            return;
        }

        getContext().getSharedPreferences("mkuu_autoreply", Context.MODE_PRIVATE)
                .edit()
                .putInt("autoReplySubscriptionId", subscriptionId)
                .putBoolean("enabled", true)
                .apply();

        JSObject ret = new JSObject();
        ret.put("subscriptionId", subscriptionId);
        ret.put("saved", true);
        ret.put("backgroundReady", true);
        call.resolve(ret);
    }

    // MKUU_AUTO_REPLY_KILLSWITCH_NATIVE_V1
    // This is the same native SharedPreferences state consumed by SmsAutoReplyReceiver.
    // The receiver checks this flag before processing every incoming SMS.
    @com.getcapacitor.PluginMethod
    public void getEmergencyStop(PluginCall call) {
        android.content.SharedPreferences prefs = getContext().getSharedPreferences("mkuu_autoreply", Context.MODE_PRIVATE);
        JSObject ret = new JSObject();
        ret.put("emergencyStop", prefs.getBoolean("emergencyStop", false));
        call.resolve(ret);
    }

    @com.getcapacitor.PluginMethod
    public void setEmergencyStop(PluginCall call) {
        boolean emergencyStop = call.getBoolean("enabled", false);
        getContext().getSharedPreferences("mkuu_autoreply", Context.MODE_PRIVATE)
                .edit()
                .putBoolean("emergencyStop", emergencyStop)
                .apply();
        JSObject ret = new JSObject();
        ret.put("emergencyStop", emergencyStop);
        ret.put("saved", true);
        call.resolve(ret);
    }

    @com.getcapacitor.PluginMethod
    public void sendSms(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("autoreply", call, "sendSms");
            return;
        }
        String to = call.getString("to", "").trim();
        String body = call.getString("message", "").trim();
        int subscriptionId = call.getInt("subscriptionId", -1);
        if (to.isEmpty() || body.isEmpty()) {
            call.reject("Receiver number and message are required");
            return;
        }
        try {
            SmsManager manager = subscriptionId >= 0 ? SmsManager.getSmsManagerForSubscriptionId(subscriptionId) : SmsManager.getDefault();
            ArrayList<String> parts = manager.divideMessage(body);
            ArrayList<PendingIntent> sentIntents = new ArrayList<>();
            ArrayList<PendingIntent> deliveredIntents = new ArrayList<>();
            for (int i = 0; i < parts.size(); i++) {
                Intent sent = new Intent(SENT_ACTION).setPackage(getContext().getPackageName());
                sent.putExtra("to", to); sent.putExtra("part", i + 1); sent.putExtra("total", parts.size());
                Intent delivered = new Intent(DELIVERED_ACTION).setPackage(getContext().getPackageName());
                delivered.putExtra("to", to); delivered.putExtra("part", i + 1); delivered.putExtra("total", parts.size());
                int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
                sentIntents.add(PendingIntent.getBroadcast(getContext(), (int) (System.currentTimeMillis() + i) & 0x7fffffff, sent, flags));
                deliveredIntents.add(PendingIntent.getBroadcast(getContext(), (int) (System.currentTimeMillis() + 1000 + i) & 0x7fffffff, delivered, flags));
            }
            manager.sendMultipartTextMessage(to, null, parts, sentIntents, deliveredIntents);
            JSObject ret = new JSObject(); ret.put("status", "sending"); ret.put("to", to); ret.put("parts", parts.size()); ret.put("timestamp", System.currentTimeMillis());
            call.resolve(ret);
        } catch (Exception e) { call.reject("SMS_SEND_FAILED", e); }
    }
}
