package com.mkuu.ai;

import android.Manifest;
import android.app.PendingIntent;
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
        @Permission(strings = { Manifest.permission.SEND_SMS }, alias = "sms"),
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

    @com.getcapacitor.PluginMethod
    public void sendSms(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("sms", call, "sendSms");
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
