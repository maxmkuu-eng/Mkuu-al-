import { registerPlugin } from '@capacitor/core';

export type SimCard = {
  subscriptionId: number;
  slotIndex: number;
  displayName: string;
  number: string;
};

export type SmsStatus = {
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  to: string;
  part?: number;
  total?: number;
  resultCode?: number;
  timestamp: number;
};

interface SmsSenderPlugin {
  getSimCards(): Promise<{ sims: SimCard[] }>;
  sendSms(options: { to: string; message: string; subscriptionId?: number }): Promise<{ status: string; to: string; parts: number; timestamp: number }>;
  addListener(eventName: 'smsStatus', listenerFunc: (status: SmsStatus) => void): Promise<{ remove: () => Promise<void> }>;
}

export const SmsSender = registerPlugin<SmsSenderPlugin>('SmsSender');

export async function getSimCards(): Promise<SimCard[]> {
  try {
    const result = await SmsSender.getSimCards();
    return result.sims || [];
  } catch {
    return [];
  }
}

export async function sendNativeSms(to: string, message: string, subscriptionId?: number) {
  return SmsSender.sendSms({ to, message, subscriptionId });
}
