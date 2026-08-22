const fs = require('fs');

function patch(path, marker, insertBefore, block) {
  let text = fs.readFileSync(path, 'utf8');
  if (text.includes(marker)) {
    console.log(`[SMS] ${path}: already patched`);
    return;
  }
  const index = text.indexOf(insertBefore);
  if (index < 0) throw new Error(`[SMS] ${path}: insertion point not found`);
  text = text.slice(0, index) + block + text.slice(index);
  fs.writeFileSync(path, text);
  console.log(`[SMS] ${path}: patched`);
}

patch(
  'src/App.tsx',
  'MKUU_NATIVE_SMS_COMMAND_V2',
  "    if (!text.trim() && attachments.length === 0) return;",
  `    if (!text.trim() && attachments.length === 0) return;\n\n    // MKUU_NATIVE_SMS_COMMAND_V2\n    const smsCommand = !attachments.length ? text.trim().match(/^(?:mkuu[,:]?\\s*)?(?:mtumie|tuma|send)\\s+(.+?)\\s+(?:sms|ujumbe)(?:\\s*[:\\-]\\s*|\\s+)(.+)$/i) : null;\n    if (smsCommand) {\n      const target = smsCommand[1].trim();\n      const smsBody = smsCommand[2].trim();\n      const person = people.find((p) => p.name.toLowerCase() === target.toLowerCase() || p.nickname?.toLowerCase() === target.toLowerCase());\n      const numberMatch = target.match(/[+\\d][\\d\\s().-]{6,}/);\n      const receiver = person?.phone || (numberMatch ? numberMatch[0].replace(/[\\s().-]/g, '') : '');\n      if (!receiver) return { reply: 'Sijaweza kupata namba ya ' + target + '. Weka mtu huyo kwenye Watu Wangu au tumia namba moja kwa moja.', cleanSpeechText: 'Sijaweza kupata namba ya ' + target + '.' };\n      try {\n        const { sendNativeSms, getSimCards } = await import('./services/smsService');\n        const sims = await getSimCards();\n        await sendNativeSms(receiver, smsBody, sims[0]?.subscriptionId);\n        return { reply: 'SMS imetumwa kwa ' + (person?.name || receiver) + '. Hali ya kwanza: Sending; nitasubiri Sent/Delivered.', cleanSpeechText: 'SMS imetumwa kwa ' + (person?.name || receiver) + '.' };\n      } catch (error) {\n        console.error('[MKUU_SMS_COMMAND]', error);\n        return { reply: 'Nimeshindwa kutuma SMS. Hakikisha ruhusa ya SMS na SIM yenye huduma viko sawa.', cleanSpeechText: 'Nimeshindwa kutuma SMS.' };\n      }\n    }\n\n`
);

const peoplePath = 'src/components/PeopleCenter.tsx';
let peopleSource = fs.readFileSync(peoplePath, 'utf8');

if (!peopleSource.includes("../services/smsService")) {
  peopleSource = peopleSource.replace(
    "import { Person } from '../types';",
    "import { Person } from '../types';\nimport { getSimCards, sendNativeSms, SmsSender } from '../services/smsService';"
  );
}

if (!peopleSource.includes('MKUU_PEOPLE_SMS_STATE_V1')) {
  const stateAnchor = '  const [deletingId, setDeletingId] = useState<string | null>(null);';
  const stateBlock = `  const [deletingId, setDeletingId] = useState<string | null>(null);\n\n  // MKUU_PEOPLE_SMS_STATE_V1\n  const [smsModalPerson, setSmsModalPerson] = useState<Person | null>(null);\n  const [smsSender, setSmsSender] = useState('');\n  const [smsReceiver, setSmsReceiver] = useState('');\n  const [smsMessage, setSmsMessage] = useState('');\n  const [smsSims, setSmsSims] = useState<Array<{subscriptionId:number;slotIndex:number;displayName:string;number:string}>>([]);\n  const [smsStatus, setSmsStatus] = useState('');\n  const [smsSending, setSmsSending] = useState(false);`;
  if (!peopleSource.includes(stateAnchor)) throw new Error('[SMS] PeopleCenter state anchor not found.');
  peopleSource = peopleSource.replace(stateAnchor, stateBlock);
}

if (!peopleSource.includes('MKUU_PEOPLE_SMS_HANDLERS_V1')) {
  const handlerAnchor = '  const handleAddSubmit = async';
  const handlerBlock = `  // MKUU_PEOPLE_SMS_HANDLERS_V1\n  const openSmsModal = async (person?: Person) => {\n    setSmsModalPerson(person || null);\n    setSmsReceiver(person?.phone || '');\n    setSmsMessage('');\n    setSmsStatus('');\n    const sims = await getSimCards();\n    setSmsSims(sims);\n    setSmsSender(sims[0]?.number || 'SIM 1');\n  };\n\n  const handleSendSms = async () => {\n    const receiver = smsReceiver.trim();\n    if (!receiver || !smsMessage.trim()) return;\n    setSmsSending(true);\n    setSmsStatus('Sending');\n    try {\n      const sim = smsSims.find((x) => x.number === smsSender) || smsSims[0];\n      await sendNativeSms(receiver, smsMessage.trim(), sim?.subscriptionId);\n      setSmsStatus('Sent');\n    } catch (error) {\n      console.error('[MKUU_SMS_UI]', error);\n      setSmsStatus('Failed');\n    } finally {\n      setSmsSending(false);\n    }\n  };\n\n  React.useEffect(() => {\n    let active = true;\n    let subscription: { remove: () => Promise<void> } | null = null;\n    SmsSender.addListener('smsStatus', (event) => {\n      if (!active) return;\n      if (event.status === 'delivered') setSmsStatus('Delivered');\n      else if (event.status === 'sent') setSmsStatus('Sent');\n      else if (event.status === 'failed') setSmsStatus('Failed');\n    }).then((handle) => {\n      if (active) subscription = handle;\n      else handle.remove();\n    }).catch((error) => console.warn('[MKUU_SMS_UI] listener unavailable', error));\n    return () => {\n      active = false;\n      if (subscription) subscription.remove();\n    };\n  }, []);\n\n  const handleAddSubmit = async`;
  if (!peopleSource.includes(handlerAnchor)) throw new Error('[SMS] PeopleCenter handler anchor not found.');
  peopleSource = peopleSource.replace(handlerAnchor, handlerBlock);
}

if (!peopleSource.includes('id={`send-sms-${person.id}`}')) {
  const buttonAnchor = '                <div className="flex items-center space-x-1.5">';
  const buttonBlock = `                <div className="flex items-center space-x-1.5">\n                  <button id={\`send-sms-${person.id}\`} onClick={() => openSmsModal(person)} className="px-2.5 py-1.5 rounded-lg bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold flex items-center space-x-1 transition cursor-pointer">\n                    <MessageSquare className="w-3.5 h-3.5" /><span>SMS</span>\n                  </button>`;
  if (!peopleSource.includes(buttonAnchor)) throw new Error('[SMS] PeopleCenter button anchor not found.');
  peopleSource = peopleSource.replace(buttonAnchor, buttonBlock);
}

if (!peopleSource.includes('id="mkuu-send-sms-modal"')) {
  const modalAnchor = '      {/* VIEW PERSON FULL PROFILE MODAL (OPEN) */}';
  const modalBlock = `      {/* DIRECT SMS MODAL */}\n      {smsModalPerson && (\n        <div id="mkuu-send-sms-modal" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">\n          <div className="w-full max-w-lg rounded-3xl bg-[#0d0d0d] border border-[#222222] p-6 shadow-2xl space-y-5">\n            <div className="flex items-center justify-between">\n              <div><h3 className="text-xl font-bold text-[#F5F2ED]">Send Message</h3><p className="text-xs text-[#888888]">Tuma SMS moja kwa moja kupitia SIM ya simu.</p></div>\n              <button onClick={() => setSmsModalPerson(null)} className="text-[#888888] hover:text-white text-xl">✕</button>\n            </div>\n            <label className="block text-xs text-[#888888]">Sender Number</label>\n            <select value={smsSender} onChange={(e) => setSmsSender(e.target.value)} className="w-full p-3 rounded-xl bg-[#050505] border border-[#222222] text-white">\n              {smsSims.length ? smsSims.map((sim) => <option key={sim.subscriptionId} value={sim.number}>{sim.number || sim.displayName || ('SIM ' + (sim.slotIndex + 1))}</option>) : <option>SIM 1</option>}\n            </select>\n            <label className="block text-xs text-[#888888]">Receiver Number</label>\n            <input value={smsReceiver} onChange={(e) => setSmsReceiver(e.target.value)} className="w-full p-3 rounded-xl bg-[#050505] border border-[#222222] text-white" placeholder="+255..." />\n            <label className="block text-xs text-[#888888]">Message</label>\n            <textarea value={smsMessage} onChange={(e) => setSmsMessage(e.target.value)} rows={4} className="w-full p-3 rounded-xl bg-[#050505] border border-[#222222] text-white" placeholder="Andika ujumbe..." />\n            <button disabled={smsSending || !smsReceiver.trim() || !smsMessage.trim()} onClick={handleSendSms} className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-bold disabled:opacity-40">{smsSending ? 'SENDING...' : 'SEND MESSAGE'}</button>\n            {smsStatus && <div className="text-center text-sm font-semibold text-[#D4AF37]">Status: {smsStatus === 'Delivered' ? '✓✓ Delivered' : smsStatus === 'Sent' ? '✓ Sent' : smsStatus}</div>}\n          </div>\n        </div>\n      )}\n\n`;
  if (!peopleSource.includes(modalAnchor)) throw new Error('[SMS] PeopleCenter modal anchor not found.');
  peopleSource = peopleSource.replace(modalAnchor, modalBlock + modalAnchor);
}

fs.writeFileSync(peoplePath, peopleSource);
console.log('[SMS] PeopleCenter patch verified');
