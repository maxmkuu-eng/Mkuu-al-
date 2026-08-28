const fs = require('fs');

const PLUGIN = 'android/app/src/main/java/com/mkuu/ai/SmsSenderPlugin.java';
const UI = 'src/components/AutoReplyCenter.tsx';

function patchFile(path, marker, anchor, block) {
  let source = fs.readFileSync(path, 'utf8');
  if (source.includes(marker)) {
    console.log(`[SMS-SIM] ${path}: already patched`);
    return;
  }
  const index = source.indexOf(anchor);
  if (index < 0) throw new Error(`[SMS-SIM] ${path}: insertion point not found`);
  source = source.slice(0, index) + block + source.slice(index);
  fs.writeFileSync(path, source);
  console.log(`[SMS-SIM] ${path}: patched`);
}

patchFile(
  PLUGIN,
  'MKUU_AUTO_REPLY_SIM_SELECTOR_V1',
  '    @com.getcapacitor.PluginMethod\n    public void sendSms(PluginCall call) {',
  `    // MKUU_AUTO_REPLY_SIM_SELECTOR_V1\n    @com.getcapacitor.PluginMethod\n    public void getAutoReplySim(PluginCall call) {\n        android.content.SharedPreferences prefs = getContext().getSharedPreferences("mkuu_autoreply", Context.MODE_PRIVATE);\n        int subscriptionId = prefs.getInt("autoReplySubscriptionId", -1);\n        JSObject ret = new JSObject();\n        ret.put("subscriptionId", subscriptionId);\n        call.resolve(ret);\n    }\n\n    @com.getcapacitor.PluginMethod\n    public void setAutoReplySim(PluginCall call) {\n        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {\n            requestPermissionForAlias("phone", call, "setAutoReplySim");\n            return;\n        }\n        int subscriptionId = call.getInt("subscriptionId", -1);\n        if (subscriptionId < 0) {\n            call.reject("Invalid SIM subscription ID");\n            return;\n        }\n        SubscriptionManager manager = (SubscriptionManager) getContext().getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);\n        List<SubscriptionInfo> infos = manager.getActiveSubscriptionInfoList();\n        boolean exists = false;\n        if (infos != null) {\n            for (SubscriptionInfo info : infos) { if (info.getSubscriptionId() == subscriptionId) { exists = true; break; } }\n        }\n        if (!exists) {\n            call.reject("Selected SIM is not active");\n            return;\n        }\n        getContext().getSharedPreferences("mkuu_autoreply", Context.MODE_PRIVATE).edit().putInt("autoReplySubscriptionId", subscriptionId).apply();\n        JSObject ret = new JSObject();\n        ret.put("subscriptionId", subscriptionId);\n        ret.put("saved", true);\n        call.resolve(ret);\n    }\n\n`
);

patchFile(
  UI,
  'MKUU_AUTO_REPLY_SIM_SELECTOR_UI_V1',
  "import { apiFetch } from '../services/apiConfig';",
  `import { apiFetch } from '../services/apiConfig';\nimport { registerPlugin } from '@capacitor/core';\n\ninterface AutoReplySimInfo {\n  subscriptionId: number;\n  slotIndex: number;\n  displayName: string;\n  number: string;\n}\n\nconst SmsSenderNative = registerPlugin<any>('SmsSender');`
);

patchFile(
  UI,
  'MKUU_AUTO_REPLY_SIM_SELECTOR_STATE_V1',
  "  const [actionNotification, setActionNotification] = useState<{",
  `  // MKUU_AUTO_REPLY_SIM_SELECTOR_STATE_V1\n  const [autoReplySims, setAutoReplySims] = useState<AutoReplySimInfo[]>([]);\n  const [selectedAutoReplySim, setSelectedAutoReplySim] = useState<number>(-1);\n  const [loadingAutoReplySims, setLoadingAutoReplySims] = useState(false);\n  const [savingAutoReplySim, setSavingAutoReplySim] = useState(false);\n\n`
);

patchFile(
  UI,
  'MKUU_AUTO_REPLY_SIM_SELECTOR_LOGIC_V1',
  '  const notify = (type: \'success\' | \'error\' | \'info\', text: string) => {',
  `  // MKUU_AUTO_REPLY_SIM_SELECTOR_LOGIC_V1\n  const loadAutoReplySims = async () => {\n    setLoadingAutoReplySims(true);\n    try {\n      const result = await SmsSenderNative.getSimCards();\n      const sims = Array.isArray(result?.sims) ? result.sims : [];\n      setAutoReplySims(sims);\n      const saved = await SmsSenderNative.getAutoReplySim();\n      const savedId = Number(saved?.subscriptionId ?? -1);\n      setSelectedAutoReplySim(sims.some((sim) => sim.subscriptionId === savedId) ? savedId : -1);\n    } catch (error) {\n      console.warn('[SMS-SIM] Could not read SIMs', error);\n      setAutoReplySims([]);\n      setSelectedAutoReplySim(-1);\n    } finally {\n      setLoadingAutoReplySims(false);\n    }\n  };\n\n  const handleAutoReplySimChange = async (subscriptionId: number) => {\n    setSelectedAutoReplySim(subscriptionId);\n    setSavingAutoReplySim(true);\n    try {\n      await SmsSenderNative.setAutoReplySim({ subscriptionId });\n      const sim = autoReplySims.find((item) => item.subscriptionId === subscriptionId);\n      notify('success', 'Line ya Auto Reply imehifadhiwa: ' + (sim?.number || sim?.displayName || ('SIM ' + ((sim?.slotIndex ?? 0) + 1))));\n    } catch (error: any) {\n      console.error('[SMS-SIM] Could not save selected SIM', error);\n      notify('error', 'Haikuweza kuhifadhi line ya Auto Reply. Hakikisha SIM iko active na ruhusa za simu zimeruhusiwa.');\n      await loadAutoReplySims();\n    } finally {\n      setSavingAutoReplySim(false);\n    }\n  };\n\n  useEffect(() => {\n    loadAutoReplySims();\n  }, []);\n\n`
);

patchFile(
  UI,
  'MKUU_AUTO_REPLY_SIM_SELECTOR_SETTINGS_UI_V1',
  '            {/* General SMS & Tone Settings */}',
  `            {/* MKUU_AUTO_REPLY_SIM_SELECTOR_SETTINGS_UI_V1 */}\n            <div className="glass p-6 rounded-3xl border border-[#222222] shadow-lg space-y-4">\n              <div className="flex items-center justify-between gap-3">\n                <div>\n                  <h3 className="serif font-bold text-sm text-[#F5F2ED] flex items-center gap-2"><Smartphone className="w-4 h-4 text-[#D4AF37]" /><span>LINE YA AUTO REPLY SMS</span></h3>\n                  <p className="text-xs text-[#888888] mt-1 leading-relaxed">Chagua mwenyewe SIM ambayo MKUU AI atatumia kutuma auto reply. Line zote active kwenye simu zitaonekana hapa.</p>\n                </div>\n                <button type="button" onClick={loadAutoReplySims} disabled={loadingAutoReplySims} className="p-2 rounded-xl bg-[#111111] border border-[#222222] text-[#D4AF37] disabled:opacity-50" title="Refresh SIMs"><RefreshCw className="w-4 h-4" /></button>\n              </div>\n              <select id="auto-reply-sim-selector" value={selectedAutoReplySim >= 0 ? String(selectedAutoReplySim) : ''} onChange={(e) => handleAutoReplySimChange(Number(e.target.value))} disabled={loadingAutoReplySims || savingAutoReplySim || autoReplySims.length === 0} className="w-full px-3.5 py-3 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37] disabled:opacity-50">\n                <option value="">{loadingAutoReplySims ? 'Inasoma laini za simu...' : autoReplySims.length ? 'Chagua Line ya Auto Reply' : 'Hakuna SIM active iliyopatikana'}</option>\n                {autoReplySims.map((sim) => <option key={sim.subscriptionId} value={String(sim.subscriptionId)}>{sim.displayName || ('SIM ' + (sim.slotIndex + 1))} {sim.number ? ('— ' + sim.number) : ''}</option>)}\n              </select>\n              <div className="text-[11px] text-[#888888]">{selectedAutoReplySim >= 0 ? '✓ Line hii ndiyo itakayotumika kwa SMS zote za Auto Reply.' : '⚠️ Chagua line moja ili Auto Reply isitume kwa SIM nyingine.'}</div>\n            </div>\n\n`
);

patchFile(
  PLUGIN,
  'MKUU_AUTO_REPLY_KILLSWITCH_NATIVE_V1',
  '    @com.getcapacitor.PluginMethod\n    public void sendSms(PluginCall call) {',
  `    // MKUU_AUTO_REPLY_KILLSWITCH_NATIVE_V1\n    @com.getcapacitor.PluginMethod\n    public void getEmergencyStop(PluginCall call) {\n        android.content.SharedPreferences prefs = getContext().getSharedPreferences("mkuu_autoreply", Context.MODE_PRIVATE);\n        JSObject ret = new JSObject();\n        ret.put("emergencyStop", prefs.getBoolean("emergencyStop", false));\n        call.resolve(ret);\n    }\n\n    @com.getcapacitor.PluginMethod\n    public void setEmergencyStop(PluginCall call) {\n        boolean emergencyStop = call.getBoolean("enabled", false);\n        getContext().getSharedPreferences("mkuu_autoreply", Context.MODE_PRIVATE).edit().putBoolean("emergencyStop", emergencyStop).apply();\n        JSObject ret = new JSObject();\n        ret.put("emergencyStop", emergencyStop);\n        ret.put("saved", true);\n        call.resolve(ret);\n    }\n\n`
);

patchFile(
  UI,
  'MKUU_AUTO_REPLY_KILLSWITCH_UI_V1',
  "  const notify = (type: 'success' | 'error' | 'info', text: string) => {",
  `  // MKUU_AUTO_REPLY_KILLSWITCH_UI_V1\n  const syncNativeEmergencyStop = async (enabled: boolean) => {\n    try {\n      await SmsSenderNative.setEmergencyStop({ enabled });\n      console.log('[SMS-KILLSWITCH] Native SMS receiver emergencyStop =', enabled);\n    } catch (error) {\n      console.error('[SMS-KILLSWITCH] Failed to sync native emergencyStop', error);\n      throw error;\n    }\n  };\n\n  useEffect(() => {\n    syncNativeEmergencyStop(Boolean(settings.emergencyStop)).catch(() => undefined);\n  }, [settings.emergencyStop]);\n\n  const handleEmergencyStopClick = async () => {\n    const nextState = !settings.emergencyStop;\n    try {\n      await syncNativeEmergencyStop(nextState);\n      onEmergencyStopToggle();\n    } catch (error) {\n      notify('error', 'Killswitch haikuweza kuunganishwa na SMS receiver ya simu.');\n    }\n  };\n\n`
);

// Replace, rather than insert before, the existing handler so the JSX can never become
// <button onClick={new} onClick={old}>. This is intentionally idempotent across builds.
{
  const source = fs.readFileSync(UI, 'utf8');
  const marker = 'MKUU_AUTO_REPLY_KILLSWITCH_BUTTONS_V2';
  if (!source.includes(marker)) {
    const old = 'onClick={onEmergencyStopToggle}';
    const first = source.indexOf(old);
    if (first < 0) throw new Error(`[SMS-SIM] ${UI}: emergency stop button handler not found`);
    const updated = source.slice(0, first) + 'onClick={handleEmergencyStopClick}' + source.slice(first + old.length) + `\n\n// ${marker}`;
    fs.writeFileSync(UI, updated);
    console.log(`[SMS-SIM] ${UI}: emergency stop handler fixed`);
  } else {
    console.log(`[SMS-SIM] ${UI}: emergency stop handler already fixed`);
  }
}

// Defensive cleanup for any legacy build that may already have produced duplicate JSX.
{
  let source = fs.readFileSync(UI, 'utf8');
  const duplicate = 'onClick={handleEmergencyStopClick}onClick={onEmergencyStopToggle}';
  if (source.includes(duplicate)) {
    source = source.replaceAll(duplicate, 'onClick={handleEmergencyStopClick}');
    fs.writeFileSync(UI, source);
    console.log(`[SMS-SIM] ${UI}: removed duplicate emergency stop onClick`);
  }
}

console.log('[SMS-SIM] Auto Reply SIM selector + native killswitch synchronization ready.');
