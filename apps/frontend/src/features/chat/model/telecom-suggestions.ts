import {
  Smartphone,
  CreditCard,
  Wifi,
  Globe,
  FileText,
  Headphones,
  type LucideIcon,
} from 'lucide-react';

export interface TelecomSuggestion {
  id: string;
  category: string;
  prompt: string;
  subtitle: string;
  icon: LucideIcon;
}

export const TELECOM_SUGGESTIONS: TelecomSuggestion[] = [
  {
    id: 'plans',
    category: 'Plans & Pricing',
    prompt: 'What mobile plans, offers and discounts are available?',
    subtitle: 'Explore plans, data packages, pricing and promotions.',
    icon: Smartphone,
  },
  {
    id: 'billing',
    category: 'Billing & Payments',
    prompt: 'Can you help me understand my bill or a payment issue?',
    subtitle: 'Get help with invoices, unexpected charges and refunds.',
    icon: CreditCard,
  },
  {
    id: 'technical',
    category: 'Technical Support',
    prompt: "I'm experiencing problems with my mobile network or internet.",
    subtitle: 'Troubleshoot connectivity, SIM cards, eSIM and Wi-Fi.',
    icon: Headphones,
  },
  {
    id: 'roaming',
    category: 'Roaming & Travel',
    prompt: 'How can I use my mobile services while travelling abroad?',
    subtitle: 'Learn about roaming, international rates and data packages.',
    icon: Globe,
  },
  {
    id: 'contracts',
    category: 'Contracts & Services',
    prompt: 'How can I manage, change or cancel my contract?',
    subtitle: 'Get assistance with subscriptions and number portability.',
    icon: FileText,
  },
  {
    id: 'network',
    category: 'Network & Wi-Fi',
    prompt: 'Is there a network outage or a problem with my connection?',
    subtitle: 'Check connectivity issues, router problems and service interruptions.',
    icon: Wifi,
  },
] as const;
