import { CreditCard, Globe, QrCode, Signal, Smartphone, Wifi, type LucideIcon } from 'lucide-react';

export interface TelecomSuggestion {
  id: string;
  category: string;
  prompt: string;
  subtitle: string;
  icon: LucideIcon;
}

export const TELECOM_SUGGESTIONS: readonly TelecomSuggestion[] = [
  {
    id: 'mobile-plans',
    category: 'Mobile Plans',
    prompt: 'Which mobile plan is right for me?',
    subtitle: 'Compare 5G unlimited, family, and prepaid plans',
    icon: Smartphone,
  },
  {
    id: 'internet-usage',
    category: 'Internet Usage',
    prompt: 'How much mobile data do I have left?',
    subtitle: 'Check remaining high-speed data and cycle reset',
    icon: Wifi,
  },
  {
    id: 'payments',
    category: 'Payments',
    prompt: 'How can I pay my bill?',
    subtitle: 'AutoPay, card payments, and billing balance',
    icon: CreditCard,
  },
  {
    id: 'roaming',
    category: 'Roaming',
    prompt: 'How does international roaming work?',
    subtitle: 'Travel passes, EU/global zones, and daily rates',
    icon: Globe,
  },
  {
    id: 'sim-esim',
    category: 'SIM & eSIM',
    prompt: 'How do I activate my eSIM?',
    subtitle: 'Instant QR setup and device transfer guide',
    icon: QrCode,
  },
  {
    id: 'technical-support',
    category: 'Technical Support',
    prompt: "My mobile internet isn't working.",
    subtitle: 'APN settings, 5G coverage, and connectivity fixes',
    icon: Signal,
  },
] as const;
