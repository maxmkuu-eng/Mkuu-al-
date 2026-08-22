import React, { useEffect, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { MessageSquare, Send, Check, CheckCheck, Smartphone } from 'lucide-react';

type SimCard = { subscriptionId: number; slotIndex: number; displayName: string; number?: string };
type SmsStatus = { status: 'sent' | 'delivered'; to?: string; timestamp?: number; resultCode?: number };

type SmsSenderPlugin = {
  getSimCards(): Promise<{ sims: SimCard[] }>;
  sendSms(options: { to: string; message: string; subscriptionId?: number }): Promise<{ status: string; to: string; timestamp: number }>;
  addListener(eventName: 'smsStatus', listenerFunc: (data: SmsStatus) => void): Promise<{ remove: () => Promise<void> }>;
};

const SmsSender = registerPlugin<SmsSenderPlugin>('SmsSender');

export const SmsCenter: React.FC = () => {
  const [sims, setSims] = useState<SimCard[]>([]);
  const [senderId, setSenderId] = useState<number | undefined>();
  const [receiver, setReceiver] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'delivered' | 'failed'>('idle');
  const [statusTime, setStatusTime] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let listener: { remove: () => Promise<void> } | null = null;
    (async () => {
      try {
        const result = await SmsSender.getSimCards();
        setSims(result.sims || []);
        if (result.sims?.length) setSenderId(result.sims[0].subscriptionId);
        listener = await SmsSender.addListener('smsStatus', (data) => {
          if (data.status === 'delivered') setStatus('delivered');
          else if (data.status === 'sent') setStatus('sent');
          setStatusTime(data.timestamp || Date.now());
        });
      } catch (e) {
        console.warn('[SMS] Native plugin unavailable:', e);
      }
    })();
    return () => { listener?.remove(); };
  }, []);

  const send = async () => {
    const to = receiver.trim();
    const body = message.trim();
    if (!to || !body) { setError('Weka namba ya mpokeaji na ujumbe.'); return; }
    setError(''); setStatus('sending'); setStatusTime(Date.now());
    try {
      await SmsSender.sendSms({ to, message: body, subscriptionId: senderId });
      setStatus('sent');
      setStatusTime(Date.now());
      setMessage('');
    } catch (e: any) {
      setStatus('failed');
      setError(e?.message || 'SMS imeshindikana kutumwa. Hakikisha ruhusa ya SMS imeruhusiwa.');
    }
  };

  return (
    <section className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#07090e]">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center border border-[#D4AF37]/25"><MessageSquare className="w-5 h-5" /></div>
          <div><h2 className="text-xl sm:text-2xl font-bold text-[#F5F2ED]">SMS</h2><p className="text-xs text-[#888]">Tuma SMS moja kwa moja kupitia SIM ya simu hii</p></div>
        </div>

        <div className="rounded-2xl border border-[#252525] bg-[#0d0f14] p-5 sm:p-6 space-y-5 shadow-xl">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#aaa] mb-2">Sender / SIM</label>
            <select value={senderId ?? ''} onChange={e => setSenderId(e.target.value ? Number(e.target.value) : undefined)} className="w-full rounded-xl bg-[#080a0e] border border-[#292929] text-white px-4 py-3 outline-none focus:border-[#D4AF37]">
              {sims.length === 0 && <option value="">SIM haijapatikana</option>}
              {sims.map(sim => <option key={sim.subscriptionId} value={sim.subscriptionId}>SIM {sim.slotIndex + 1} — {sim.displayName}{sim.number ? ` (${sim.number})` : ''}</option>)}
            </select>
            <p className="text-[11px] text-[#666] mt-2 flex items-center gap-1"><Smartphone className="w-3 h-3" /> Sender ni SIM inayotumika kwenye simu, si namba ya kutengenezwa na app.</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#aaa] mb-2">Receiver Number</label>
            <input value={receiver} onChange={e => setReceiver(e.target.value)} inputMode="tel" placeholder="Mfano: 0712345678" className="w-full rounded-xl bg-[#080a0e] border border-[#292929] text-white px-4 py-3 outline-none focus:border-[#D4AF37]" />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#aaa] mb-2">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6} placeholder="Andika ujumbe wako hapa..." className="w-full resize-none rounded-xl bg-[#080a0e] border border-[#292929] text-white px-4 py-3 outline-none focus:border-[#D4AF37]" />
          </div>

          <button onClick={send} disabled={status === 'sending'} className="w-full rounded-xl py-3.5 bg-[#D4AF37] hover:bg-[#c59f2e] disabled:opacity-50 text-black font-extrabold flex items-center justify-center gap-2"><Send className="w-4 h-4" /> {status === 'sending' ? 'INATUMA...' : 'SEND SMS'}</button>

          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm p-3">{error}</div>}
          {status !== 'idle' && !error && <div className="rounded-xl border border-[#292929] bg-[#080a0e] p-4 flex items-center justify-between">
            <div><div className="text-xs uppercase tracking-wider text-[#777]">SMS Status</div><div className="text-sm font-bold text-white mt-1">{status === 'sending' && 'Inatuma...'}{status === 'sent' && '✓ Sent'}{status === 'delivered' && '✓✓ Delivered'}{status === 'failed' && 'Failed'}</div></div>
            <div className="text-[#D4AF37]">{status === 'delivered' ? <CheckCheck className="w-6 h-6" /> : <Check className="w-6 h-6" />}</div>
            {statusTime && <div className="text-[10px] text-[#666]">{new Date(statusTime).toLocaleTimeString('sw-TZ')}</div>}
          </div>}
        </div>
      </div>
    </section>
  );
};

export default SmsCenter;
