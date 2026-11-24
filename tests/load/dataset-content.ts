/**
 * Hand-authored telecom content for the SemCache benchmark dataset.
 *
 * This file contains ONLY static data and types (no randomness, no I/O) so that
 * `generate-dataset.ts` stays a small deterministic pipeline.
 *
 *  - 42 core intents (7 categories x 6), each with 4 EN + 4 UK phrasings and 2 "near-duplicate traps"
 *    (same wording, but a critical condition changes -> a cached answer would be WRONG).
 *  - 21 knowledge-base sources (3 per category).
 *  - 26 "unique edge" templates x 8 slot values (one record per slot value and language).
 *  - 5 KB-update scenarios for the post-load invalidation phase.
 *
 * NOTE: `import type` is mandatory here (and in the generator) so the files run directly with
 * Node's native TypeScript type stripping (`node tests/load/generate-dataset.ts`).
 */

export type Language = 'uk' | 'en';
export type TelecomCategory =
  | 'billing'
  | 'roaming'
  | 'tariff_plan'
  | 'sim_esim'
  | 'technical_support'
  | 'outage_incident'
  | 'contract_termination';
export type ClusterDensity = 'high' | 'medium' | 'low';
export type SourceIndex = 0 | 1 | 2;

export const CATEGORIES: readonly TelecomCategory[] = [
  'billing',
  'roaming',
  'tariff_plan',
  'sim_esim',
  'technical_support',
  'outage_incident',
  'contract_termination',
];

/** A near-duplicate trap: lexically close to its base intent, semantically different. */
export interface TrapDef {
  reason: string;
  en: string;
  uk: string;
}

export interface IntentDef {
  id: string;
  category: TelecomCategory;
  density: ClusterDensity;
  /** Index (0..2) into the category's three KB sources. */
  sourceIdx: SourceIndex;
  /** Exactly 4 phrasings; index 0 is the canonical seed. */
  en: string[];
  uk: string[];
  /** Exactly 2 traps. */
  traps: TrapDef[];
}

export interface KbSourceDef {
  id: string;
  category: TelecomCategory;
  title: string;
  summary: string;
  contentEn: string;
  contentUk: string;
}

export interface EdgeTemplate {
  id: string;
  category: TelecomCategory;
  density: ClusterDensity;
  sourceIdx: SourceIndex;
  /** Templates contain a single `{x}` placeholder. */
  en: string;
  uk: string;
  /** Exactly 8 `[en, uk]` slot values. */
  slots: ReadonlyArray<readonly [string, string]>;
}

export interface ScenarioDef {
  id: string;
  kbSourceId: string;
  intentId: string;
  title: string;
  changeReason: string;
  previousFact: string;
  updatedFact: string;
  staleMarkers: string[];
  freshMarkers: string[];
  newVersion: string;
  newContentEn: string;
  newContentUk: string;
  newSummary: string;
  probes: { en: string; uk: string };
}

const same = (...values: string[]): Array<readonly [string, string]> =>
  values.map((v) => [v, v] as const);

// ---------------------------------------------------------------------------
// Knowledge-base sources (3 per category). Facts marked (v1) are changed by SCENARIOS below.
// ---------------------------------------------------------------------------
export const KB_SOURCES: KbSourceDef[] = [
  // billing
  {
    id: 'kb-billing-autopay-01',
    category: 'billing',
    title: 'Autopay setup and card management',
    summary: 'How to enable autopay, change the card, and the autopay discount.',
    contentEn:
      'Autopay is enabled in the app under Payments > Autopay. Customers with autopay receive a 3% monthly discount on the plan fee. The card can be replaced in the same menu.',
    contentUk:
      'Автоплатіж вмикається в застосунку: Платежі > Автоплатіж. Клієнти з автоплатежем отримують знижку 3% на абонплату щомісяця. Картку можна замінити в тому самому меню.',
  },
  {
    id: 'kb-billing-disputes-01',
    category: 'billing',
    title: 'Billing disputes, double charges and refunds',
    summary: 'How to dispute an unknown or duplicate charge and get a refund.',
    contentEn:
      'Duplicate or unrecognized charges can be disputed in the app (Payments > Dispute) within 60 days. Confirmed duplicate charges are refunded to the original card within 5 business days.',
    contentUk:
      'Дубльовані або невідомі списання можна оскаржити в застосунку (Платежі > Оскарження) протягом 60 днів. Підтверджені подвійні списання повертаються на ту ж картку протягом 5 робочих днів.',
  },
  {
    id: 'kb-billing-statements-01',
    category: 'billing',
    title: 'Invoices, itemized bills and due dates',
    summary: 'Where to find invoices and when payment is due.',
    contentEn:
      'Invoices and itemized call lists are available as PDF in the personal account for the last 12 months. Postpaid invoices are due on the 20th day of the month.',
    contentUk:
      'Рахунки та деталізація дзвінків доступні у PDF в особистому кабінеті за останні 12 місяців. Постоплатні рахунки потрібно сплатити до 20 числа місяця.',
  },
  // roaming
  {
    id: 'kb-roaming-eu-01',
    category: 'roaming',
    title: 'EU/EEA roaming and call rates',
    summary: 'Roaming conditions in the EU/EEA and call prices abroad.',
    contentEn:
      'Within the EU/EEA the plan can be used like at home with a fair-use limit of 15 GB of roaming data per month; calls are charged as domestic. Outside the EU/EEA, standard roaming rates apply.',
    contentUk:
      'У країнах ЄС/ЄЕЗ тариф працює як вдома з лімітом чесного використання 15 ГБ роумінгового інтернету на місяць; дзвінки тарифікуються як у межах країни. Поза ЄС/ЄЕЗ діють стандартні роумінгові тарифи.',
  },
  {
    id: 'kb-roaming-charges-01',
    category: 'roaming',
    title: 'Non-EU roaming, spending caps and coverage issues',
    summary: 'Roaming outside the EU, cost control and connection troubleshooting.',
    contentEn:
      'Outside the EU/EEA data costs 5 EUR per 1 GB. A spending cap can be set in the app (Roaming > Limit). If no network is found after landing, enable automatic network selection and restart the phone.',
    contentUk:
      'Поза ЄС/ЄЕЗ інтернет коштує 5 EUR за 1 ГБ. Ліміт витрат встановлюється в застосунку (Роумінг > Ліміт). Якщо після прильоту мережі немає, увімкніть автоматичний вибір мережі та перезавантажте телефон.',
  },
  {
    id: 'kb-roaming-packs-01',
    category: 'roaming',
    title: 'Roaming data packs',
    summary: 'Buying, activating and tracking travel data packs.',
    contentEn:
      'Travel packs of 7 or 30 days are activated in the app (Roaming > Packs) or via USSD *111#. Remaining roaming traffic is shown in the same section.',
    contentUk:
      'Travel-пакети на 7 або 30 днів активуються в застосунку (Роумінг > Пакети) або через USSD *111#. Залишок роумінгового трафіку показано в тому ж розділі.',
  },
  // tariff_plan
  {
    id: 'kb-tariff-catalog-01',
    category: 'tariff_plan',
    title: 'Plan catalog, prices and fair use',
    summary: 'Current plans, monthly fees and the unlimited fair-use policy.',
    contentEn:
      'Start 15GB costs 250 UAH per month; Unlimited 5G costs 650 UAH per month. On Unlimited 5G speed is reduced to 3 Mbps after 500 GB per month; hotspot is limited to 100 GB.',
    contentUk:
      'Start 15GB коштує 250 грн на місяць; Unlimited 5G коштує 650 грн на місяць. На Unlimited 5G швидкість знижується до 3 Мбіт/с після 500 ГБ на місяць; роздача (хотспот) обмежена 100 ГБ.',
  },
  {
    id: 'kb-tariff-switch-01',
    category: 'tariff_plan',
    title: 'Changing plans',
    summary: 'How and when a plan change takes effect and what it costs.',
    contentEn:
      'Plan change is processed in 15 minutes and costs 0 UAH once per 30 days; the new plan applies immediately. Upgrades and downgrades use the same flow in the app.',
    contentUk:
      'Зміна тарифу виконується за 15 хвилин і коштує 0 грн один раз на 30 днів; новий тариф діє одразу. Підвищення та зниження тарифу виконуються в застосунку однаково.',
  },
  {
    id: 'kb-tariff-bundles-01',
    category: 'tariff_plan',
    title: 'Extra data bundles and family plans',
    summary: 'Extra gigabytes and family plan sharing rules.',
    contentEn:
      'Extra data bundles of 1 GB (25 UAH) and 10 GB (150 UAH) can be added anytime. A family plan shares one data pool between up to 5 numbers of the same household.',
    contentUk:
      'Додаткові пакети інтернету 1 ГБ (25 грн) і 10 ГБ (150 грн) можна підключити будь-коли. Сімейний тариф ділить один пакет інтернету між п’ятьма номерами однієї домогосподарки.',
  },
  // sim_esim
  {
    id: 'kb-sim-replacement-01',
    category: 'sim_esim',
    title: 'SIM replacement and activation',
    summary: 'Replacing a damaged SIM, activating a new SIM and its price.',
    contentEn:
      'A replacement SIM with the same number costs 100 UAH and is issued at a store with a passport or Diia ID, or delivered by courier within 3 business days. New SIM cards are activated after registration with a passport.',
    contentUk:
      'Заміна SIM із збереженням номера коштує 100 грн і виконується в магазині за паспортом або Дія.ID чи кур’єром протягом 3 робочих днів. Нові SIM-картки активуються після реєстрації за паспортом.',
  },
  {
    id: 'kb-esim-activation-01',
    category: 'sim_esim',
    title: 'eSIM activation and transfer',
    summary: 'Installing an eSIM profile and moving it between devices.',
    contentEn:
      'An eSIM is installed by scanning the QR code from the app on a compatible phone. To move an eSIM to another device, request a new QR code in the app; the old profile is deactivated.',
    contentUk:
      'eSIM встановлюється скануванням QR-коду із застосунку на сумісному телефоні. Щоб перенести eSIM на інший пристрій, запросіть новий QR-код у застосунку; старий профіль деактивується.',
  },
  {
    id: 'kb-sim-security-01',
    category: 'sim_esim',
    title: 'SIM blocking, PIN and PUK',
    summary: 'Blocking a lost SIM and unlocking with PUK.',
    contentEn:
      'A lost SIM can be blocked 24/7 via the app or the hotline; the number is kept for 6 months. The PUK code is printed on the SIM carrier card and is available in the personal account.',
    contentUk:
      'Загублену SIM можна заблокувати цілодобово через застосунок або гарячу лінію; номер зберігається 6 місяців. PUK-код надруковано на картці SIM і доступний в особистому кабінеті.',
  },
  // technical_support
  {
    id: 'kb-tech-apn-01',
    category: 'technical_support',
    title: 'Mobile data, APN and SMS settings',
    summary: 'APN parameters and SMS troubleshooting.',
    contentEn:
      'Internet APN: internet.telco.example, no username or password. MMS APN: mms.telco.example. If SMS are not received, check the SMS center number +380000000000 and free phone memory.',
    contentUk:
      'APN для інтернету: internet.telco.example, без логіна та пароля. APN для MMS: mms.telco.example. Якщо SMS не надходять, перевірте номер SMS-центру +380000000000 і вільну пам’ять телефону.',
  },
  {
    id: 'kb-tech-router-01',
    category: 'technical_support',
    title: 'Home router configuration',
    summary: 'Reset, Wi-Fi password, PPPoE and bridge mode.',
    contentEn:
      'Hold the reset button for 10 seconds to restore factory settings. Wi-Fi name and password are changed at 192.168.1.1 > Wireless. Fiber routers use PPPoE credentials from the contract.',
    contentUk:
      'Утримуйте кнопку reset 10 секунд для скидання до заводських налаштувань. Назву та пароль Wi-Fi змінюють на 192.168.1.1 > Wireless. Оптичні роутери використовують PPPoE-дані з договору.',
  },
  {
    id: 'kb-tech-quality-01',
    category: 'technical_support',
    title: 'Network quality, speed and voice',
    summary: 'Troubleshooting slow data, dropped calls and VoLTE.',
    contentEn:
      'For slow data, switch airplane mode on and off and select 5G/4G automatic mode. VoLTE and Wi-Fi calling are enabled in phone settings under Mobile network > VoLTE.',
    contentUk:
      'За повільного інтернету увімкніть і вимкніть режим польоту та оберіть автоматичний режим 5G/4G. VoLTE і Wi-Fi calling вмикаються в налаштуваннях телефону: Мобільна мережа > VoLTE.',
  },
  // outage_incident
  {
    id: 'kb-outage-status-01',
    category: 'outage_incident',
    title: 'Outage status and restoration times',
    summary: 'Where to check outages and typical restoration times.',
    contentEn:
      'Current incidents are listed on the status page and in the app. Typical restoration time is 4 to 24 hours depending on cause; planned maintenance is announced 48 hours in advance.',
    contentUk:
      'Поточні інциденти відображаються на сторінці статусу та в застосунку. Типовий час відновлення — від 4 до 24 годин залежно від причини; планові роботи анонсуються за 48 годин.',
  },
  {
    id: 'kb-outage-compensation-01',
    category: 'outage_incident',
    title: 'Outage compensation and notifications',
    summary: 'When compensation is due and how to subscribe to alerts.',
    contentEn:
      'Compensation is provided for outages longer than 24 hours as a proportional fee recalculation. Outage alerts can be enabled in the app under Notifications.',
    contentUk:
      'Компенсація надається за збої довші за 24 години у вигляді пропорційного перерахунку абонплати. Сповіщення про збої вмикаються в застосунку: Сповіщення.',
  },
  {
    id: 'kb-outage-reporting-01',
    category: 'outage_incident',
    title: 'Reporting incidents and ticket tracking',
    summary: 'How to open and track outage tickets.',
    contentEn:
      'Outages are reported in the app (Help > Report a problem) or by hotline 0 800 000 000. Ticket status is visible in Help > My requests; unresolved tickets are escalated after 72 hours.',
    contentUk:
      'Про збої повідомляють у застосунку (Допомога > Повідомити про проблему) або за гарячою лінією 0 800 000 000. Статус заявки видно в розділі Допомога > Мої звернення; невирішені заявки ескалюються через 72 години.',
  },
  // contract_termination
  {
    id: 'kb-contract-cancel-01',
    category: 'contract_termination',
    title: 'Contract cancellation procedure',
    summary: 'Notice period, documents and channels for cancelling a contract.',
    contentEn:
      'To cancel a contract, submit a written notice 30 days in advance via the app, a store, or registered mail; outstanding balances must be settled. A passport is required for in-store cancellation.',
    contentUk:
      'Щоб розірвати контракт, подайте письмове повідомлення за 30 днів через застосунок, магазин або рекомендований лист; заборгованість потрібно погасити. Для розірвання в магазині потрібен паспорт.',
  },
  {
    id: 'kb-contract-portout-01',
    category: 'contract_termination',
    title: 'Number portability and early termination fees',
    summary: 'Porting a number to another operator and early termination charges.',
    contentEn:
      'Number porting takes up to 3 business days and requires no outstanding debt. Early termination during the minimum term is charged at 50% of the remaining monthly fees.',
    contentUk:
      'Перенесення номера триває до 3 робочих днів і вимагає відсутності заборгованості. Дострокове розірвання протягом мінімального терміну оплачується у розмірі 50% залишкових абонплат.',
  },
  {
    id: 'kb-contract-suspension-01',
    category: 'contract_termination',
    title: 'Number suspension and final billing',
    summary: 'Temporary suspension and how the last invoice is calculated.',
    contentEn:
      'A number can be suspended for up to 6 months for 20 UAH per month. The final invoice is prorated by day and unused prepaid balance is refunded within 30 days.',
    contentUk:
      'Номер можна призупинити до 6 місяців за 20 грн на місяць. Останній рахунок розраховується пропорційно дням, а невикористаний передоплачений залишок повертається протягом 30 днів.',
  },
];

// ---------------------------------------------------------------------------
// 42 core intents. Per category the order is: high, high, medium, medium, low, low.
// ---------------------------------------------------------------------------
export const INTENTS: IntentDef[] = [
  // ============================== BILLING ==============================
  {
    id: 'bill_autopay_enable',
    category: 'billing',
    density: 'high',
    sourceIdx: 0,
    en: [
      'How do I turn on autopay for my mobile plan?',
      'I want my monthly bill to be paid automatically from my card, how do I set that up?',
      'Where can I enable automatic payment for my subscription?',
      "Can you help me set up auto-pay so I don't miss the due date?",
    ],
    uk: [
      'Як підключити автоплатіж за мій тариф?',
      'Хочу, щоб абонплата списувалась з картки автоматично, як це налаштувати?',
      'Де увімкнути автоматичну оплату послуг?',
      'Допоможіть налаштувати автопоповнення, щоб не прострочити оплату.',
    ],
    traps: [
      {
        reason: 'Corporate postpaid contracts use a different (invoice-based) autopay procedure.',
        en: 'How do I turn on autopay for my corporate postpaid plan?',
        uk: 'Як підключити автоплатіж за мій корпоративний постоплатний тариф?',
      },
      {
        reason: 'Opposite action: disabling autopay instead of enabling it.',
        en: 'How do I turn off autopay for my mobile plan?',
        uk: 'Як вимкнути автоплатіж за мій тариф?',
      },
    ],
  },
  {
    id: 'bill_double_charge_refund',
    category: 'billing',
    density: 'high',
    sourceIdx: 1,
    en: [
      'I was charged twice for my plan this month, how do I get a refund?',
      'My card got billed two times for the same subscription fee, I need the extra payment returned.',
      'Why was the monthly fee deducted twice and how can I get my money back?',
      'Double payment on my account, how to request a refund?',
    ],
    uk: [
      'З мене двічі списали абонплату цього місяця, як повернути гроші?',
      'Картку списали два рази за один тариф, потрібно повернення зайвого платежу.',
      'Чому абонплату зняли двічі і як повернути кошти?',
      'Подвійне списання на рахунку, як подати запит на повернення?',
    ],
    traps: [
      {
        reason:
          'Third-party premium subscription is a different dispute flow than a duplicate fee.',
        en: 'I was charged for a premium SMS subscription I never ordered, how do I get a refund?',
        uk: 'З мене списали за платну SMS-підписку, яку я не замовляв, як повернути гроші?',
      },
      {
        reason: 'Duplicate top-up (customer error) is refunded differently than a duplicate fee.',
        en: 'I topped up twice by mistake, how do I get one top-up refunded?',
        uk: 'Я випадково двічі поповнив рахунок, як повернути один платіж?',
      },
    ],
  },
  {
    id: 'bill_unknown_charge',
    category: 'billing',
    density: 'medium',
    sourceIdx: 1,
    en: [
      "There is a charge on my bill I don't recognize, what is it for?",
      'What is this unknown service fee on my invoice?',
      'I see a strange deduction from my balance, how can I find out what it is?',
      'Can you explain an unfamiliar line item on my bill?',
    ],
    uk: [
      'У рахунку є списання, яке я не впізнаю, за що воно?',
      'Що за незрозуміла плата за послугу в моєму рахунку?',
      'Бачу дивне списання з балансу, як дізнатись за що?',
      'Поясніть невідомий пункт у моєму рахунку.',
    ],
    traps: [
      {
        reason: 'Roaming charges require roaming CDR lookup, not generic line-item explanation.',
        en: "There is a roaming charge on my bill I don't recognize, what is it for?",
        uk: 'У рахунку є списання за роумінг, яке я не впізнаю, за що воно?',
      },
      {
        reason: 'Prepaid USSD deductions are explained via USSD history, not invoices.',
        en: 'There is a charge on my prepaid balance after I dialed a USSD code, what is it for?',
        uk: 'З мого передоплаченого балансу списали гроші після USSD-коду, за що?',
      },
    ],
  },
  {
    id: 'bill_invoice_download',
    category: 'billing',
    density: 'medium',
    sourceIdx: 2,
    en: [
      'Where can I download my invoice for last month?',
      'How do I get a PDF copy of my monthly bill?',
      'I need the itemized bill for my number, where is it?',
      'Can I get my billing statement by email?',
    ],
    uk: [
      'Де завантажити рахунок за минулий місяць?',
      'Як отримати PDF-копію мого місячного рахунку?',
      'Мені потрібна деталізація рахунку по номеру, де її знайти?',
      'Чи можна отримувати виписку з рахунку на пошту?',
    ],
    traps: [
      {
        reason: 'A VAT tax invoice for a legal entity is issued through a different channel.',
        en: 'Where can I download a tax invoice with VAT for my company for last month?',
        uk: 'Де завантажити податкову накладну з ПДВ для моєї компанії за минулий місяць?',
      },
      {
        reason: 'Itemization older than 12 months is not self-service (archive request).',
        en: 'Where can I download the itemized call list from two years ago?',
        uk: 'Де завантажити деталізацію дзвінків дворічної давності?',
      },
    ],
  },
  {
    id: 'bill_autopay_change_card',
    category: 'billing',
    density: 'low',
    sourceIdx: 0,
    en: [
      'How can I change the card used for autopay?',
      'I got a new bank card, how do I replace the old one in automatic payments?',
      'Update payment card for recurring charges, where?',
      'My autopay card expired, what should I do?',
    ],
    uk: [
      'Як змінити картку для автоплатежу?',
      'У мене нова банківська картка, як замінити стару в автоплатежах?',
      'Де оновити картку для регулярних списань?',
      'Картка для автоплатежу прострочена, що робити?',
    ],
    traps: [
      {
        reason: 'Adding a backup card is a different feature than replacing the primary card.',
        en: 'How can I add a second backup card for autopay?',
        uk: 'Як додати другу резервну картку для автоплатежу?',
      },
      {
        reason: 'Home internet contract has a separate billing account and autopay.',
        en: 'How can I change the card used for autopay of my home internet contract?',
        uk: 'Як змінити картку для автоплатежу за домашній інтернет?',
      },
    ],
  },
  {
    id: 'bill_payment_due_date',
    category: 'billing',
    density: 'low',
    sourceIdx: 2,
    en: [
      'When is my payment due each month?',
      "What's the deadline to pay my bill?",
      'By which date should I pay for my plan to avoid disconnection?',
      'How can I check my billing day?',
    ],
    uk: [
      'До якого числа потрібно оплатити рахунок щомісяця?',
      'Який кінцевий термін оплати мого тарифу?',
      'До якої дати слід заплатити, щоб не відключили?',
      'Як дізнатись мій розрахунковий день?',
    ],
    traps: [
      {
        reason: 'Late-fee / grace-period policy is a different answer than the due date.',
        en: 'What happens if I pay my bill after the due date, is there a late fee?',
        uk: 'Що буде, якщо оплатити рахунок після кінцевої дати, чи є штраф?',
      },
      {
        reason: 'Prepaid plans have no monthly due date.',
        en: 'When is my payment due each month on a prepaid plan?',
        uk: 'До якого числа потрібно платити щомісяця на передоплаченому тарифі?',
      },
    ],
  },

  // ============================== ROAMING ==============================
  {
    id: 'roam_eu_usage',
    category: 'roaming',
    density: 'high',
    sourceIdx: 0,
    en: [
      'Can I use my mobile data in EU countries at no extra charge?',
      'Do I pay extra for calls and internet while traveling in Europe?',
      'Is roaming in the European Union included in my plan?',
      'What are the conditions for using my plan in the EU?',
    ],
    uk: [
      'Чи можна користуватись мобільним інтернетом у країнах ЄС без додаткової плати?',
      'Чи доплачую я за дзвінки та інтернет під час подорожі Європою?',
      'Чи входить роумінг в Європейському Союзі в мій тариф?',
      'Які умови використання мого тарифу в ЄС?',
    ],
    traps: [
      {
        reason: 'Turkey is NOT in the EU: standard (paid) roaming rates apply.',
        en: 'Can I use my mobile data in Turkey at no extra charge?',
        uk: 'Чи можна користуватись мобільним інтернетом у Туреччині без додаткової плати?',
      },
      {
        reason: 'Switzerland is not in the EU/EEA: standard roaming rates apply.',
        en: 'Can I use my mobile data in Switzerland at no extra charge?',
        uk: 'Чи можна користуватись мобільним інтернетом у Швейцарії без додаткової плати?',
      },
    ],
  },
  {
    id: 'roam_activate_pack',
    category: 'roaming',
    density: 'high',
    sourceIdx: 2,
    en: [
      'How do I activate a roaming data pack before my trip?',
      "I'm traveling abroad next week, how can I buy an internet package for roaming?",
      'Where do I connect a roaming bundle?',
      'What do I need to dial or tap to enable a travel data pack?',
    ],
    uk: [
      'Як активувати роумінговий пакет інтернету перед поїздкою?',
      'Наступного тижня їду за кордон, як купити пакет інтернету для роумінгу?',
      'Де підключити роумінговий бандл?',
      'Що потрібно набрати чи натиснути, щоб увімкнути travel-пакет?',
    ],
    traps: [
      {
        reason: 'A 30-day pack has different price/validity than the default short pack.',
        en: 'How do I activate a 30-day roaming data pack before my trip?',
        uk: 'Як активувати 30-денний роумінговий пакет інтернету перед поїздкою?',
      },
      {
        reason: 'Corporate SIMs activate packs through the corporate account manager.',
        en: 'How do I activate a roaming data pack for a corporate SIM before my trip?',
        uk: 'Як активувати роумінговий пакет інтернету на корпоративній SIM перед поїздкою?',
      },
    ],
  },
  {
    id: 'roam_spend_limit',
    category: 'roaming',
    density: 'medium',
    sourceIdx: 1,
    en: [
      'How can I set a limit on roaming spending?',
      "I'm afraid of bill shock abroad, can I cap my roaming costs?",
      'Is there a way to block roaming data after a certain amount?',
      'How do I avoid huge charges while roaming?',
    ],
    uk: [
      'Як встановити ліміт витрат у роумінгу?',
      'Боюсь величезних рахунків за кордоном, чи можна обмежити витрати в роумінгу?',
      'Чи можна блокувати роумінговий інтернет після певної суми?',
      'Як уникнути величезних списань у роумінгу?',
    ],
    traps: [
      {
        reason: 'Disabling data roaming on the phone is a device setting, not an account cap.',
        en: 'How can I completely disable data roaming on my phone?',
        uk: 'Як повністю вимкнути передачу даних у роумінгу на телефоні?',
      },
      {
        reason: 'Maritime (satellite) roaming is not covered by the standard spending cap.',
        en: 'How can I set a limit on roaming spending on a cruise ship?',
        uk: 'Як встановити ліміт витрат у роумінгу на круїзному лайнері?',
      },
    ],
  },
  {
    id: 'roam_no_signal_abroad',
    category: 'roaming',
    density: 'medium',
    sourceIdx: 1,
    en: [
      'I arrived abroad and have no network, what should I do?',
      "My phone doesn't connect to a local network in another country.",
      'No signal after landing, how to fix roaming?',
      'Phone shows emergency calls only while traveling, help.',
    ],
    uk: [
      'Приїхав за кордон і немає мережі, що робити?',
      'Телефон не підключається до місцевої мережі в іншій країні.',
      'Після прильоту немає сигналу, як налаштувати роумінг?',
      'За кордоном телефон показує лише екстрені виклики, допоможіть.',
    ],
    traps: [
      {
        reason: 'Network present but no data session is an APN/data-roaming issue.',
        en: 'I arrived abroad and have network but no mobile internet, what should I do?',
        uk: 'Приїхав за кордон, мережа є, але немає мобільного інтернету, що робити?',
      },
      {
        reason: 'Accidental border roaming at home needs manual network selection.',
        en: "I'm at home near the border and my phone connects to a foreign network, what should I do?",
        uk: 'Я вдома біля кордону, і телефон підключається до іноземної мережі, що робити?',
      },
    ],
  },
  {
    id: 'roam_call_cost',
    category: 'roaming',
    density: 'low',
    sourceIdx: 0,
    en: [
      'How much do calls cost when I am roaming?',
      'What is the per-minute rate for calling from abroad?',
      'Price of incoming and outgoing calls in roaming?',
      'Are incoming calls free while traveling?',
    ],
    uk: [
      'Скільки коштують дзвінки в роумінгу?',
      'Яка вартість хвилини розмови з-за кордону?',
      'Ціна вхідних і вихідних дзвінків у роумінгу?',
      'Чи безкоштовні вхідні дзвінки під час подорожі?',
    ],
    traps: [
      {
        reason: 'SMS tariffs differ from call tariffs.',
        en: 'How much do SMS cost when I am roaming?',
        uk: 'Скільки коштують SMS у роумінгу?',
      },
      {
        reason: 'Calls home from non-EU Egypt use the non-EU tariff, not the EU domestic rate.',
        en: 'How much do calls to Ukraine cost when I am roaming in Egypt?',
        uk: 'Скільки коштують дзвінки в Україну, коли я в роумінгу в Єгипті?',
      },
    ],
  },
  {
    id: 'roam_pack_remaining',
    category: 'roaming',
    density: 'low',
    sourceIdx: 2,
    en: [
      'How can I check how much roaming data I have left?',
      'Where do I see remaining roaming gigabytes?',
      'How do I know my travel pack usage?',
      'Check remaining roaming traffic, please.',
    ],
    uk: [
      'Як перевірити залишок роумінгового трафіку?',
      'Де побачити залишок гігабайтів у роумінгу?',
      'Як дізнатися, скільки використано travel-пакета?',
      'Перевірте, будь ласка, залишок роумінгового трафіку.',
    ],
    traps: [
      {
        reason: 'Home (domestic) data balance is checked via a different USSD/menu.',
        en: 'How can I check how much home data I have left?',
        uk: 'Як перевірити залишок трафіку вдома?',
      },
      {
        reason: 'Extending a pack is a purchase flow, not a balance lookup.',
        en: 'How can I extend my roaming data pack when it runs out?',
        uk: 'Як продовжити роумінговий пакет, коли він закінчується?',
      },
    ],
  },

  // ============================== TARIFF PLAN ==============================
  {
    id: 'plan_upgrade_bigger',
    category: 'tariff_plan',
    density: 'high',
    sourceIdx: 1,
    en: [
      'How can I upgrade my plan to one with more data?',
      'I want to switch to a bigger tariff, what are the steps?',
      'Is it possible to move to the Unlimited 5G plan right now?',
      'How do I change my current plan to a higher one?',
    ],
    uk: [
      'Як перейти на тариф з більшим обсягом інтернету?',
      'Хочу змінити тариф на більший, які кроки?',
      'Чи можна зараз перейти на безлімітний 5G тариф?',
      'Як змінити мій тариф на вищий?',
    ],
    traps: [
      {
        reason: 'Downgrade has different restrictions (e.g. next billing day) than an upgrade.',
        en: 'How can I downgrade my plan to one with less data?',
        uk: 'Як перейти на тариф з меншим обсягом інтернету?',
      },
      {
        reason: 'Device installment contracts restrict plan changes.',
        en: "How can I upgrade my plan to one with more data while I'm paying a phone in installments?",
        uk: 'Як перейти на тариф з більшим обсягом інтернету, якщо я виплачую телефон у розстрочку?',
      },
    ],
  },
  {
    id: 'plan_price_unlimited',
    category: 'tariff_plan',
    density: 'high',
    sourceIdx: 0,
    en: [
      'How much does the Unlimited 5G plan cost per month?',
      'What is the monthly fee for your top plan?',
      'Price of the Unlimited plan, please.',
      'How much will I pay each month on the unlimited tariff?',
    ],
    uk: [
      'Скільки коштує тариф Unlimited 5G на місяць?',
      'Яка абонплата за ваш топовий тариф?',
      'Вартість тарифу Unlimited, будь ласка.',
      'Скільки я платитиму щомісяця на безлімітному тарифі?',
    ],
    traps: [
      {
        reason: 'Different plan (Start 15GB) has a different price (250 vs 650 UAH).',
        en: 'How much does the Start 15GB plan cost per month?',
        uk: 'Скільки коштує тариф Start 15GB на місяць?',
      },
      {
        reason: 'Post-promo price differs from the standard catalog price.',
        en: 'How much does the Unlimited 5G plan cost per month after the promo period ends?',
        uk: 'Скільки коштує тариф Unlimited 5G на місяць після завершення акційного періоду?',
      },
    ],
  },
  {
    id: 'plan_extra_data',
    category: 'tariff_plan',
    density: 'medium',
    sourceIdx: 2,
    en: [
      'How can I buy extra data when my gigabytes run out?',
      'My internet package is finished, can I top it up with more GB?',
      'Where do I add an additional data bundle?',
      'What is the cheapest way to get more mobile data this month?',
    ],
    uk: [
      'Як докупити інтернет, коли закінчились гігабайти?',
      'Мій пакет інтернету закінчився, чи можна додати ще ГБ?',
      'Де підключити додатковий пакет інтернету?',
      'Який найдешевший спосіб отримати більше мобільного інтернету цього місяця?',
    ],
    traps: [
      {
        reason: 'Home 5G router data is topped up on a different account/product.',
        en: 'How can I buy extra data for my home 5G router when the gigabytes run out?',
        uk: 'Як докупити інтернет для домашнього 5G-роутера, коли закінчились гігабайти?',
      },
      {
        reason: 'A specific bundle size/price (10 GB for 150 UAH) changes the answer.',
        en: 'How can I buy 10 GB of extra data for 150 UAH when my gigabytes run out?',
        uk: 'Як докупити 10 ГБ інтернету за 150 грн, коли закінчились гігабайти?',
      },
    ],
  },
  {
    id: 'plan_family_share',
    category: 'tariff_plan',
    density: 'medium',
    sourceIdx: 2,
    en: [
      'Can I share my data with family members?',
      'Is there a family plan where gigabytes are shared?',
      "How do I add my wife's number to my plan?",
      'Can several SIMs use one data bundle?',
    ],
    uk: [
      'Чи можна ділитися інтернетом з родиною?',
      'Чи є сімейний тариф зі спільними гігабайтами?',
      'Як додати номер дружини до мого тарифу?',
      'Чи можуть кілька SIM використовувати один пакет інтернету?',
    ],
    traps: [
      {
        reason: 'Sharing with company employees is a business product, not a family plan.',
        en: 'Can I share my data with employees of my company?',
        uk: 'Чи можна ділитися інтернетом із працівниками моєї компанії?',
      },
      {
        reason: "A child's number with parental controls is a separate add-on.",
        en: "Can I add my child's number to my plan with parental controls?",
        uk: 'Чи можна додати номер дитини до мого тарифу з батьківським контролем?',
      },
    ],
  },
  {
    id: 'plan_change_effective',
    category: 'tariff_plan',
    density: 'low',
    sourceIdx: 1,
    en: [
      'When will my plan change take effect?',
      'If I switch tariffs today, from which date does the new one start?',
      'Does the new plan apply immediately or from next month?',
      'How soon after switching does the new tariff start?',
    ],
    uk: [
      'Коли набуде чинності зміна мого тарифу?',
      'Якщо я змінюю тариф сьогодні, з якої дати діє новий?',
      'Новий тариф діє одразу чи з наступного місяця?',
      'Як швидко після переходу починає діяти новий тариф?',
    ],
    traps: [
      {
        reason: 'Carry-over of leftover gigabytes is a separate policy question.',
        en: 'Do my remaining gigabytes carry over when my plan change takes effect?',
        uk: 'Чи переносяться мої залишки гігабайтів, коли набуває чинності зміна тарифу?',
      },
      {
        reason: 'Number of free plan changes per month is a limit question, not timing.',
        en: 'How many times per month can I change my plan for free?',
        uk: 'Скільки разів на місяць можна безкоштовно змінювати тариф?',
      },
    ],
  },
  {
    id: 'plan_fair_use',
    category: 'tariff_plan',
    density: 'low',
    sourceIdx: 0,
    en: [
      'Is there a fair-use limit on the unlimited plan?',
      'Does the speed drop after a certain amount of data on Unlimited?',
      'What happens when I use too much data on the unlimited tariff?',
      'Are there any speed restrictions on the unlimited plan?',
    ],
    uk: [
      'Чи є ліміт чесного використання на безлімітному тарифі?',
      'Чи падає швидкість після певного обсягу даних на Unlimited?',
      'Що буде, якщо витратити забагато трафіку на безлімітному тарифі?',
      'Чи є обмеження швидкості на безлімітному тарифі?',
    ],
    traps: [
      {
        reason: 'Hotspot/tethering has its own, lower limit.',
        en: 'Is there a hotspot tethering limit on the unlimited plan?',
        uk: 'Чи є ліміт роздачі інтернету (хотспот) на безлімітному тарифі?',
      },
      {
        reason: 'Roaming fair-use is governed by roaming rules, not domestic fair use.',
        en: 'Is there a fair-use limit on the unlimited plan while roaming?',
        uk: 'Чи є ліміт чесного використання на безлімітному тарифі в роумінгу?',
      },
    ],
  },

  // ============================== SIM / eSIM ==============================
  {
    id: 'sim_esim_activate',
    category: 'sim_esim',
    density: 'high',
    sourceIdx: 1,
    en: [
      'How do I activate an eSIM on my phone?',
      'I got a QR code for eSIM, what do I do next?',
      'Steps to install an eSIM profile, please.',
      'Can I switch my number to an eSIM?',
    ],
    uk: [
      'Як активувати eSIM на моєму телефоні?',
      'Отримав QR-код для eSIM, що робити далі?',
      'Покрокова інструкція зі встановлення eSIM профілю.',
      'Чи можна перенести мій номер на eSIM?',
    ],
    traps: [
      {
        reason: 'Smartwatch eSIM uses a separate companion-plan activation.',
        en: 'How do I activate an eSIM on my smartwatch?',
        uk: 'Як активувати eSIM на моєму смарт-годиннику?',
      },
      {
        reason: 'Getting a brand-new number on eSIM differs from migrating the current number.',
        en: 'How do I get a brand new number on an eSIM instead of moving my current one?',
        uk: 'Як отримати новий номер на eSIM замість перенесення поточного?',
      },
    ],
  },
  {
    id: 'sim_lost_block',
    category: 'sim_esim',
    density: 'high',
    sourceIdx: 2,
    en: [
      'I lost my phone, how do I block my SIM card?',
      'My phone was stolen, please block my number.',
      'How to urgently disable a lost SIM?',
      'Need to suspend my SIM because I lost my phone.',
    ],
    uk: [
      'Я загубив телефон, як заблокувати SIM-картку?',
      'Мій телефон вкрали, заблокуйте номер, будь ласка.',
      'Як терміново вимкнути загублену SIM?',
      'Потрібно призупинити SIM, бо я загубив телефон.',
    ],
    traps: [
      {
        reason: 'Unblocking a previously blocked SIM is the opposite procedure.',
        en: 'I found my phone, how do I unblock my SIM card?',
        uk: 'Я знайшов телефон, як розблокувати SIM-картку?',
      },
      {
        reason: 'Blocking the device by IMEI is a different action than blocking the SIM.',
        en: 'My phone was stolen, how do I block the device by IMEI?',
        uk: 'Мій телефон вкрали, як заблокувати пристрій за IMEI?',
      },
    ],
  },
  {
    id: 'sim_replace_physical',
    category: 'sim_esim',
    density: 'medium',
    sourceIdx: 0,
    en: [
      'How do I replace my damaged SIM card?',
      'My SIM card is broken, where can I get a new one with the same number?',
      'I need a SIM replacement, what documents are required?',
      'How much does a new SIM card cost if I keep my number?',
    ],
    uk: [
      'Як замінити пошкоджену SIM-картку?',
      'Моя SIM зламалась, де отримати нову з тим самим номером?',
      'Потрібна заміна SIM, які документи потрібні?',
      'Скільки коштує нова SIM-картка, якщо залишити номер?',
    ],
    traps: [
      {
        reason: 'SIMs registered to a legal entity require an authorized representative.',
        en: 'How do I replace a damaged SIM card registered to my company?',
        uk: 'Як замінити пошкоджену SIM-картку, оформлену на мою компанію?',
      },
      {
        reason: 'Courier delivery has its own identification and timing rules.',
        en: 'How do I get my damaged SIM card replaced by courier delivery?',
        uk: 'Як замінити пошкоджену SIM-картку з доставкою кур’єром?',
      },
    ],
  },
  {
    id: 'sim_puk_unlock',
    category: 'sim_esim',
    density: 'medium',
    sourceIdx: 2,
    en: [
      'My SIM is locked and asks for a PUK code, where do I find it?',
      'I entered the wrong PIN three times, how to unlock my SIM?',
      'Phone says enter PUK, what now?',
      'How can I get my PUK code?',
    ],
    uk: [
      'Моя SIM заблокована і просить PUK-код, де його знайти?',
      'Тричі ввів неправильний PIN, як розблокувати SIM?',
      'Телефон просить ввести PUK, що тепер?',
      'Як отримати мій PUK-код?',
    ],
    traps: [
      {
        reason: 'After 10 wrong PUK attempts the SIM is permanently dead and must be replaced.',
        en: 'I entered the wrong PUK code ten times, how do I unlock my SIM?',
        uk: 'Я ввів неправильний PUK-код десять разів, як розблокувати SIM?',
      },
      {
        reason: 'An eSIM has no printed PUK card.',
        en: 'My eSIM is locked and asks for a PUK code, where do I find it?',
        uk: 'Моя eSIM заблокована і просить PUK-код, де його знайти?',
      },
    ],
  },
  {
    id: 'sim_activate_new',
    category: 'sim_esim',
    density: 'low',
    sourceIdx: 0,
    en: [
      'How do I activate a new SIM card I just bought?',
      'Steps to register and activate my starter pack SIM.',
      'My new SIM has no network, how do I activate it?',
      'Do I need to register my new SIM card?',
    ],
    uk: [
      'Як активувати нову SIM-картку, яку щойно купив?',
      'Кроки для реєстрації та активації SIM зі стартового пакета.',
      'Нова SIM без мережі, як її активувати?',
      'Чи потрібно реєструвати нову SIM-картку?',
    ],
    traps: [
      {
        reason: 'Foreign tourists register with a passport under a different procedure.',
        en: 'How do I activate a new SIM card as a foreign tourist with a passport?',
        uk: 'Як активувати нову SIM-картку іноземному туристу за паспортом?',
      },
      {
        reason: 'Data-only SIMs for routers are provisioned differently than voice SIMs.',
        en: 'How do I activate a new data-only SIM card for my router?',
        uk: 'Як активувати нову SIM-картку лише для даних для мого роутера?',
      },
    ],
  },
  {
    id: 'sim_esim_transfer_phone',
    category: 'sim_esim',
    density: 'low',
    sourceIdx: 1,
    en: [
      'How do I move my eSIM to a new phone?',
      'I bought a new phone, how to transfer my eSIM profile?',
      'Can I use the same eSIM on two devices?',
      'Transfer eSIM from iPhone to Android, possible?',
    ],
    uk: [
      'Як перенести eSIM на новий телефон?',
      'Купив новий телефон, як перенести профіль eSIM?',
      'Чи можна використовувати одну eSIM на двох пристроях?',
      'Перенесення eSIM з iPhone на Android, чи можливо?',
    ],
    traps: [
      {
        reason: 'Moving a physical SIM number to an eSIM requires a re-issue, not a transfer.',
        en: 'How do I move my physical SIM number to an eSIM on my new phone?',
        uk: 'Як перенести номер з фізичної SIM на eSIM на новому телефоні?',
      },
      {
        reason: 'A lost old phone requires identity verification before re-issuing the profile.',
        en: 'How do I get my eSIM back on a new phone if my old phone is lost?',
        uk: 'Як відновити eSIM на новому телефоні, якщо старий телефон загублено?',
      },
    ],
  },

  // ============================== TECHNICAL SUPPORT ==============================
  {
    id: 'tech_apn_settings',
    category: 'technical_support',
    density: 'high',
    sourceIdx: 0,
    en: [
      'What are the APN settings for mobile internet?',
      'My mobile data does not work, which APN should I use?',
      'How do I configure APN on my Android phone?',
      'Please send me the internet APN name and parameters.',
    ],
    uk: [
      'Які налаштування APN для мобільного інтернету?',
      'Мобільний інтернет не працює, який APN вводити?',
      'Як налаштувати APN на Android телефоні?',
      'Надішліть, будь ласка, назву APN та параметри для інтернету.',
    ],
    traps: [
      {
        reason: 'MMS uses a different APN than internet.',
        en: 'What are the APN settings for MMS on iPhone?',
        uk: 'Які налаштування APN для MMS на iPhone?',
      },
      {
        reason: 'The 5G home router uses a dedicated APN profile.',
        en: 'What are the APN settings for the 5G home router?',
        uk: 'Які налаштування APN для домашнього 5G-роутера?',
      },
    ],
  },
  {
    id: 'tech_slow_internet',
    category: 'technical_support',
    density: 'high',
    sourceIdx: 2,
    en: [
      'My mobile internet is very slow, what can I do?',
      'Why is the speed so low on my phone today?',
      'Mobile data crawling, how can I fix it?',
      'Internet speed dropped, please help me troubleshoot.',
    ],
    uk: [
      'Мобільний інтернет дуже повільний, що можна зробити?',
      'Чому сьогодні така низька швидкість на телефоні?',
      'Мобільні дані ледь працюють, як це виправити?',
      'Швидкість інтернету впала, допоможіть розібратись.',
    ],
    traps: [
      {
        reason: 'Home Wi-Fi/fiber slowness is diagnosed on the router, not on the phone.',
        en: 'My home Wi-Fi internet is very slow, what can I do?',
        uk: 'Мій домашній Wi-Fi інтернет дуже повільний, що можна зробити?',
      },
      {
        reason: 'Indoor-only slowness points to coverage / Wi-Fi calling, not device settings.',
        en: 'My mobile internet is very slow only inside my apartment building, what can I do?',
        uk: 'Мобільний інтернет дуже повільний лише всередині мого будинку, що можна зробити?',
      },
    ],
  },
  {
    id: 'tech_router_reset',
    category: 'technical_support',
    density: 'medium',
    sourceIdx: 1,
    en: [
      'How do I reset my router to factory settings?',
      'My Wi-Fi router is not working, how to restart and reconfigure it?',
      'Where is the reset button on the router and how long do I hold it?',
      'I need to set up my home router from scratch.',
    ],
    uk: [
      'Як скинути роутер до заводських налаштувань?',
      'Wi-Fi роутер не працює, як його перезавантажити та налаштувати?',
      'Де кнопка reset на роутері і скільки її тримати?',
      'Мені потрібно налаштувати домашній роутер з нуля.',
    ],
    traps: [
      {
        reason: 'Entering PPPoE credentials is a provisioning step, not a factory reset.',
        en: 'How do I enter my PPPoE login and password on my fiber router?',
        uk: 'Як ввести PPPoE логін і пароль на оптичному роутері?',
      },
      {
        reason: 'Bridge mode is an advanced configuration, not a reset.',
        en: 'How do I put my router in bridge mode?',
        uk: 'Як перевести роутер у режим моста (bridge)?',
      },
    ],
  },
  {
    id: 'tech_volte_calls',
    category: 'technical_support',
    density: 'medium',
    sourceIdx: 2,
    en: [
      "I can't make or receive calls, how do I enable VoLTE?",
      'Calls drop all the time on my phone, what should I check?',
      'How can I turn on Wi-Fi calling or VoLTE?',
      "People can't hear me during calls, what's wrong?",
    ],
    uk: [
      'Не можу телефонувати і приймати дзвінки, як увімкнути VoLTE?',
      'Дзвінки постійно обриваються, що перевірити?',
      'Як увімкнути Wi-Fi calling або VoLTE?',
      'Мене не чути під час розмови, що не так?',
    ],
    traps: [
      {
        reason: 'Dual-SIM phones allow VoLTE on only one SIM slot at a time.',
        en: 'How do I enable VoLTE when I use two SIM cards at the same time?',
        uk: 'Як увімкнути VoLTE, коли я використовую дві SIM-картки одночасно?',
      },
      {
        reason: 'Phones without VoLTE support need a device replacement after 3G shutdown.',
        en: 'Does my old phone without VoLTE support still work for calls after the 3G shutdown?',
        uk: 'Чи працюватиме мій старий телефон без VoLTE для дзвінків після відключення 3G?',
      },
    ],
  },
  {
    id: 'tech_sms_not_received',
    category: 'technical_support',
    density: 'low',
    sourceIdx: 0,
    en: [
      "I'm not receiving SMS verification codes, what should I do?",
      "Text messages don't arrive on my number.",
      'Bank codes by SMS are not coming, how to fix?',
      "Why can't I get SMS on my phone?",
    ],
    uk: [
      'Не приходять SMS з кодами підтвердження, що робити?',
      'Текстові повідомлення не надходять на мій номер.',
      'SMS-коди від банку не приходять, як виправити?',
      'Чому я не отримую SMS на телефон?',
    ],
    traps: [
      {
        reason: 'International sender IDs are filtered differently from local codes.',
        en: "I'm not receiving SMS verification codes from foreign services, what should I do?",
        uk: 'Не приходять SMS з кодами від іноземних сервісів, що робити?',
      },
      {
        reason: 'Sending SMS fails for different reasons (SMS center, balance) than receiving.',
        en: "I can't send SMS messages, what should I do?",
        uk: 'Я не можу надсилати SMS, що робити?',
      },
    ],
  },
  {
    id: 'tech_wifi_password',
    category: 'technical_support',
    density: 'low',
    sourceIdx: 1,
    en: [
      'How do I change my Wi-Fi password?',
      'Where can I set a new Wi-Fi name and password?',
      'Someone is using my Wi-Fi, how can I change the password?',
      'Change wifi key on home router, steps?',
    ],
    uk: [
      'Як змінити пароль Wi-Fi?',
      'Де встановити нову назву та пароль Wi-Fi?',
      'Хтось користується моїм Wi-Fi, як змінити пароль?',
      'Змінити ключ wifi на домашньому роутері, які кроки?',
    ],
    traps: [
      {
        reason: 'Router admin password is a different credential than the Wi-Fi key.',
        en: 'How do I change the admin password of my router?',
        uk: 'Як змінити адмін-пароль мого роутера?',
      },
      {
        reason: 'A guest network is a separate SSID configuration.',
        en: 'How do I set up a guest Wi-Fi network?',
        uk: 'Як налаштувати гостьову Wi-Fi мережу?',
      },
    ],
  },

  // ============================== OUTAGE / INCIDENT ==============================
  {
    id: 'out_area_outage',
    category: 'outage_incident',
    density: 'high',
    sourceIdx: 0,
    en: [
      'Is there a network outage in my area right now?',
      'Mobile network is down in my neighborhood, is this a known issue?',
      'No signal at all in my district, what is happening?',
      'Why is there no connection in my area today?',
    ],
    uk: [
      'Чи є зараз збій мережі в моєму районі?',
      "Мобільний зв'язок не працює в моєму районі, це відома проблема?",
      'Взагалі немає сигналу в моєму районі, що відбувається?',
      'Чому сьогодні немає зв’язку в моєму районі?',
    ],
    traps: [
      {
        reason: 'Planned maintenance is announced separately from incidents.',
        en: 'Is there planned maintenance in my area tonight?',
        uk: 'Чи є сьогодні вночі планові роботи в моєму районі?',
      },
      {
        reason: 'Fiber/home internet outages are tracked separately from the mobile network.',
        en: 'Is there a home internet outage in my area right now?',
        uk: 'Чи є зараз збій домашнього інтернету в моєму районі?',
      },
    ],
  },
  {
    id: 'out_eta_restore',
    category: 'outage_incident',
    density: 'high',
    sourceIdx: 0,
    en: [
      'When will the connection be restored?',
      'What is the estimated time to fix the outage?',
      'How long will the network be down?',
      'Any ETA on service recovery?',
    ],
    uk: [
      'Коли відновлять зв’язок?',
      'Який орієнтовний час усунення збою?',
      'Як довго не буде мережі?',
      'Чи є прогноз щодо відновлення послуг?',
    ],
    traps: [
      {
        reason: 'Blackouts depend on the power grid, not on operator repair ETA.',
        en: 'When will the connection be restored after the power blackout in my area?',
        uk: 'Коли відновлять зв’язок після блекауту в моєму районі?',
      },
      {
        reason: 'Fiber cable repairs have a different ETA than mobile network incidents.',
        en: 'When will my fiber internet be restored after the cable damage?',
        uk: 'Коли відновлять мій оптичний інтернет після пошкодження кабелю?',
      },
    ],
  },
  {
    id: 'out_compensation',
    category: 'outage_incident',
    density: 'medium',
    sourceIdx: 1,
    en: [
      'Will I get compensation for the days without service?',
      'Can I get a discount for the outage period?',
      'Do you recalculate the fee after a long network failure?',
      'How do I claim compensation for the outage?',
    ],
    uk: [
      'Чи отримаю я компенсацію за дні без зв’язку?',
      'Чи можна отримати знижку за період збою?',
      'Чи робите ви перерахунок абонплати після тривалого збою?',
      'Як подати заявку на компенсацію за збій?',
    ],
    traps: [
      {
        reason: 'Outages shorter than 24 hours are not compensated.',
        en: 'Will I get compensation for an outage shorter than 24 hours?',
        uk: 'Чи отримаю я компенсацію за збій менше ніж 24 години?',
      },
      {
        reason: 'Business customers are covered by SLA credits, not consumer recalculation.',
        en: 'Will my business get SLA compensation for the days without service?',
        uk: 'Чи отримає мій бізнес SLA-компенсацію за дні без зв’язку?',
      },
    ],
  },
  {
    id: 'out_report_issue',
    category: 'outage_incident',
    density: 'medium',
    sourceIdx: 2,
    en: [
      'How do I report a network problem in my area?',
      'Where can I open a ticket about no service?',
      'I want to report a damaged cable near my house.',
      'How can I notify support about the outage?',
    ],
    uk: [
      'Як повідомити про проблему з мережею в моєму районі?',
      'Де створити заявку про відсутність зв’язку?',
      'Хочу повідомити про пошкоджений кабель біля мого будинку.',
      'Як повідомити підтримку про збій?',
    ],
    traps: [
      {
        reason: 'Safety hazards (fallen tower) go to the emergency line, not the ticket flow.',
        en: 'How do I report a fallen cell tower or safety hazard near my house?',
        uk: 'Як повідомити про падіння вежі зв’язку або небезпеку біля мого будинку?',
      },
      {
        reason: 'Business office outages are reported to the B2B desk.',
        en: "How do I report a network problem for my company's office?",
        uk: 'Як повідомити про проблему з мережею в офісі моєї компанії?',
      },
    ],
  },
  {
    id: 'out_ticket_status',
    category: 'outage_incident',
    density: 'low',
    sourceIdx: 2,
    en: [
      'What is the status of my outage ticket?',
      'I opened a request yesterday, any update?',
      'How can I track my repair request?',
      'Check my trouble ticket number status.',
    ],
    uk: [
      'Який статус моєї заявки про збій?',
      'Вчора створив звернення, є якісь новини?',
      'Як відстежити мою заявку на ремонт?',
      'Перевірте статус моєї заявки.',
    ],
    traps: [
      {
        reason: 'Escalation is a different action than checking status.',
        en: 'How do I escalate my outage ticket that has not been solved for a week?',
        uk: 'Як ескалувати мою заявку про збій, яка не вирішена вже тиждень?',
      },
      {
        reason: 'Technician visit scheduling is a separate workflow.',
        en: 'When will the technician visit for my repair request?',
        uk: 'Коли прийде майстер за моєю заявкою на ремонт?',
      },
    ],
  },
  {
    id: 'out_alerts_subscribe',
    category: 'outage_incident',
    density: 'low',
    sourceIdx: 1,
    en: [
      'How can I get notifications about outages in my area?',
      'Is there an SMS alert for network incidents?',
      'Subscribe me to outage notifications, please.',
      'Can the app push me a message when service is restored?',
    ],
    uk: [
      'Як отримувати сповіщення про збої в моєму районі?',
      'Чи є SMS-сповіщення про інциденти в мережі?',
      'Підпишіть мене на сповіщення про збої, будь ласка.',
      'Чи може застосунок надіслати пуш, коли послугу відновлять?',
    ],
    traps: [
      {
        reason: 'Unsubscribing is the opposite action.',
        en: 'How can I stop notifications about outages in my area?',
        uk: 'Як відписатися від сповіщень про збої в моєму районі?',
      },
      {
        reason: 'Marketing SMS opt-out is a different consent setting than outage alerts.',
        en: 'How can I stop marketing SMS messages from the operator?',
        uk: 'Як відписатися від рекламних SMS від оператора?',
      },
    ],
  },

  // ============================== CONTRACT TERMINATION ==============================
  {
    id: 'contract_cancel',
    category: 'contract_termination',
    density: 'high',
    sourceIdx: 0,
    en: [
      'How do I cancel my mobile contract?',
      'I want to terminate my subscription, what is the procedure?',
      'What steps do I need to take to end my contract?',
      'Can I close my account and stop paying for the plan?',
    ],
    uk: [
      'Як розірвати мій мобільний контракт?',
      'Хочу відмовитися від послуг, яка процедура?',
      'Які кроки потрібно виконати, щоб припинити дію контракту?',
      'Чи можна закрити рахунок і більше не платити за тариф?',
    ],
    traps: [
      {
        reason: 'Cancelling during the minimum term triggers an early termination penalty.',
        en: 'How do I cancel my mobile contract during the minimum term, what is the penalty?',
        uk: 'Як розірвати мобільний контракт протягом мінімального терміну, який штраф?',
      },
      {
        reason: 'Home internet contracts require equipment return and a technician visit.',
        en: 'How do I cancel my home internet contract?',
        uk: 'Як розірвати договір на домашній інтернет?',
      },
    ],
  },
  {
    id: 'contract_port_out',
    category: 'contract_termination',
    density: 'high',
    sourceIdx: 1,
    en: [
      'How can I switch to another operator and keep my number?',
      "I want to port my number to a different carrier, what's the process?",
      'Number portability: how long does it take?',
      'What do I need to transfer my number to another provider?',
    ],
    uk: [
      'Як перейти до іншого оператора зі збереженням номера?',
      'Хочу перенести номер до іншого оператора, яка процедура?',
      'Перенесення номера: скільки це триває?',
      'Що потрібно, щоб перенести номер до іншого провайдера?',
    ],
    traps: [
      {
        reason:
          'Porting IN from another operator is a different (acquisition) flow than porting out.',
        en: 'How can I switch to your network from another operator and keep my number?',
        uk: 'Як перейти до вашої мережі від іншого оператора зі збереженням номера?',
      },
      {
        reason: 'Prepaid numbers have different porting requirements than postpaid contracts.',
        en: 'How can I port my prepaid number to another operator?',
        uk: 'Як перенести мій передоплачений номер до іншого оператора?',
      },
    ],
  },
  {
    id: 'contract_early_fee',
    category: 'contract_termination',
    density: 'medium',
    sourceIdx: 1,
    en: [
      'Is there a fee for terminating the contract early?',
      'How much do I pay if I leave before the minimum term ends?',
      'Do I need to pay a penalty for cancelling earlier?',
      'What is the early cancellation charge?',
    ],
    uk: [
      'Чи є плата за дострокове розірвання контракту?',
      'Скільки я заплачу, якщо піду до завершення мінімального терміну?',
      'Чи потрібно платити штраф за дострокове розірвання?',
      'Яка вартість дострокового розірвання?',
    ],
    traps: [
      {
        reason: 'Outstanding phone installments are added to the termination amount.',
        en: 'How much do I owe if I terminate while still paying my phone installments?',
        uk: 'Скільки я винен, якщо розриваю контракт, поки ще виплачую телефон у розстрочку?',
      },
      {
        reason: 'Relocation abroad is a specific waiver case with its own conditions.',
        en: 'Is the early termination fee waived if I relocate abroad?',
        uk: 'Чи скасовується плата за дострокове розірвання, якщо я переїжджаю за кордон?',
      },
    ],
  },
  {
    id: 'contract_suspension',
    category: 'contract_termination',
    density: 'medium',
    sourceIdx: 2,
    en: [
      'Can I temporarily suspend my number while I am away?',
      'Is it possible to freeze my plan for a few months?',
      "I'm leaving the country for 3 months, can I pause my subscription?",
      'How do I put my line on hold without losing the number?',
    ],
    uk: [
      'Чи можна тимчасово призупинити мій номер, поки мене немає?',
      'Чи можна заморозити тариф на кілька місяців?',
      'Виїжджаю з країни на 3 місяці, чи можна призупинити підписку?',
      'Як поставити лінію на паузу, не втрачаючи номер?',
    ],
    traps: [
      {
        reason: 'Permanent closure releases the number, unlike suspension.',
        en: 'Can I permanently close my number while I am away?',
        uk: 'Чи можна остаточно закрити мій номер, поки мене немає?',
      },
      {
        reason: 'Corporate lines are suspended by the account administrator only.',
        en: "Can I temporarily suspend the numbers of my company's employees?",
        uk: 'Чи можна тимчасово призупинити номери працівників моєї компанії?',
      },
    ],
  },
  {
    id: 'contract_cancel_documents',
    category: 'contract_termination',
    density: 'low',
    sourceIdx: 0,
    en: [
      'What documents do I need to terminate my contract?',
      'Do I have to come in person to cancel the service?',
      'Can I cancel the contract online without visiting a store?',
      'Is a written application needed to end my subscription?',
    ],
    uk: [
      'Які документи потрібні для розірвання контракту?',
      'Чи потрібно приходити особисто, щоб відмовитись від послуг?',
      'Чи можна розірвати контракт онлайн без візиту в магазин?',
      'Чи потрібна письмова заява для припинення підписки?',
    ],
    traps: [
      {
        reason: 'Deceased-subscriber cases require a death certificate and heir documents.',
        en: 'What documents do I need to terminate the contract of a deceased family member?',
        uk: 'Які документи потрібні для розірвання контракту померлого члена родини?',
      },
      {
        reason: 'A representative needs a notarized power of attorney.',
        en: 'What documents does my representative need to terminate my contract on my behalf?',
        uk: 'Які документи потрібні моєму представнику, щоб розірвати контракт від мого імені?',
      },
    ],
  },
  {
    id: 'contract_final_bill',
    category: 'contract_termination',
    density: 'low',
    sourceIdx: 2,
    en: [
      'When will I get my final bill after cancelling?',
      'Do I pay for the rest of the month after termination?',
      'How is the last invoice calculated when I leave?',
      'Will unused balance be refunded after I close my number?',
    ],
    uk: [
      'Коли я отримаю останній рахунок після розірвання?',
      'Чи плачу я за решту місяця після розірвання?',
      'Як розраховується останній рахунок при відході?',
      'Чи повернуть невикористаний залишок після закриття номера?',
    ],
    traps: [
      {
        reason: 'When leaving through number porting the final bill follows the porting date.',
        en: 'How is the final bill calculated when I leave through number portability?',
        uk: 'Як розраховується останній рахунок, коли я йду через перенесення номера?',
      },
      {
        reason: 'Leased equipment return changes the final invoice.',
        en: 'How is the last invoice calculated if I return the leased router when I leave?',
        uk: 'Як розраховується останній рахунок, якщо я повертаю орендований роутер при відході?',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 26 unique-edge templates x 8 slot values = 208 records per language.
// ---------------------------------------------------------------------------
export const EDGE_TEMPLATES: EdgeTemplate[] = [
  // billing (4)
  {
    id: 'bill_err_code',
    category: 'billing',
    density: 'medium',
    sourceIdx: 0,
    en: 'I got a payment error code {x} in the app when paying my invoice, what does it mean?',
    uk: 'У застосунку при оплаті рахунку з’явилась помилка {x}, що це означає?',
    slots: same(
      'E-4021',
      'E-4107',
      'PAY-502',
      'PAY-731',
      'ERR_3DS_12',
      'E-9008',
      'BNK-118',
      'ERR_LIMIT_4',
    ),
  },
  {
    id: 'bill_tax_invoice_fix',
    category: 'billing',
    density: 'medium',
    sourceIdx: 2,
    en: 'I need a tax invoice correction: the company code on invoice #{x} is wrong.',
    uk: 'Потрібно виправити податковий рахунок: у рахунку №{x} неправильний код компанії.',
    slots: same('10482', '20917', '33150', '40226', '51873', '62094', '70431', '85512'),
  },
  {
    id: 'bill_onetime_fee',
    category: 'billing',
    density: 'low',
    sourceIdx: 1,
    en: 'I was charged {x} UAH for a one-time connection fee but nobody told me, I want a breakdown.',
    uk: 'З мене списали {x} грн за разове підключення, а мене не попередили, потрібна розшифровка.',
    slots: same('49', '75', '99', '120', '199', '250', '320', '480'),
  },
  {
    id: 'bill_pay_method',
    category: 'billing',
    density: 'low',
    sourceIdx: 2,
    en: 'Can I pay my bill with {x} and will there be any commission?',
    uk: 'Чи можна оплатити рахунок через {x} і чи буде комісія?',
    slots: same(
      'Apple Pay',
      'Google Pay',
      'PayPal',
      'Monobank',
      'PrivatBank',
      'Binance Pay',
      'Revolut',
      'Wise',
    ),
  },
  // roaming (4)
  {
    id: 'roam_price_country',
    category: 'roaming',
    density: 'medium',
    sourceIdx: 1,
    en: 'What is the roaming price per 1 GB of data in {x}?',
    uk: 'Яка ціна 1 ГБ інтернету в роумінгу в країні: {x}?',
    slots: [
      ['Turkey', 'Туреччина'],
      ['Egypt', 'Єгипет'],
      ['the UAE', 'ОАЕ'],
      ['the USA', 'США'],
      ['Thailand', 'Таїланд'],
      ['Japan', 'Японія'],
      ['Georgia', 'Грузія'],
      ['Morocco', 'Марокко'],
    ],
  },
  {
    id: 'roam_cruise',
    category: 'roaming',
    density: 'low',
    sourceIdx: 1,
    en: "I'm going on a cruise in the {x}, will my phone work at sea and how much will it cost?",
    uk: 'Їду в круїз ({x}), чи працюватиме телефон у морі і скільки це коштуватиме?',
    slots: [
      ['Mediterranean', 'Середземне море'],
      ['Baltic Sea', 'Балтійське море'],
      ['Caribbean', 'Карибське море'],
      ['Black Sea', 'Чорне море'],
      ['Red Sea', 'Червоне море'],
      ['Adriatic', 'Адріатика'],
      ['North Sea', 'Північне море'],
      ['Atlantic', 'Атлантика'],
    ],
  },
  {
    id: 'roam_pack_stopped',
    category: 'roaming',
    density: 'low',
    sourceIdx: 2,
    en: 'My roaming pack was activated for {x} days but it stopped working after day 2, why?',
    uk: 'Роумінговий пакет активовано на {x} днів, але він перестав працювати після 2-го дня, чому?',
    slots: same('7', '10', '14', '15', '21', '30', '45', '60'),
  },
  {
    id: 'roam_inflight',
    category: 'roaming',
    density: 'low',
    sourceIdx: 1,
    en: 'Will I be charged for in-flight mobile roaming on a {x} flight?',
    uk: 'Чи спишуть кошти за роумінг у польоті на рейсі {x}?',
    slots: same(
      'Ryanair',
      'Wizz Air',
      'Lufthansa',
      'Emirates',
      'Turkish Airlines',
      'LOT',
      'Air France',
      'Qatar Airways',
    ),
  },
  // tariff_plan (4)
  {
    id: 'plan_keep_price',
    category: 'tariff_plan',
    density: 'medium',
    sourceIdx: 1,
    en: 'Can I keep my old price if I move from the {x} plan to the new Unlimited 5G plan?',
    uk: 'Чи збережеться стара ціна, якщо перейти з тарифу {x} на новий Unlimited 5G?',
    slots: same(
      'Start 15GB',
      'Smart 30GB',
      'Max 60GB',
      'Family 100GB',
      'Youth 25GB',
      'Senior 10GB',
      'Business 80GB',
      'Night 40GB',
    ),
  },
  {
    id: 'plan_streaming',
    category: 'tariff_plan',
    density: 'low',
    sourceIdx: 2,
    en: 'Does my plan include free {x} and for how long?',
    uk: 'Чи включає мій тариф безкоштовний {x} і на який термін?',
    slots: same(
      'Netflix',
      'Megogo',
      'YouTube Premium',
      'Spotify',
      'Apple Music',
      'HBO Max',
      'Disney+',
      'Amazon Prime',
    ),
  },
  {
    id: 'plan_student_discount',
    category: 'tariff_plan',
    density: 'low',
    sourceIdx: 0,
    en: "I'm a student, is there a discount on {x}?",
    uk: 'Я студент, чи є знижка на {x}?',
    slots: [
      ['Unlimited 5G', 'Unlimited 5G'],
      ['the Start 15GB plan', 'тариф Start 15GB'],
      ['home internet', 'домашній інтернет'],
      ['a family plan', 'сімейний тариф'],
      ['eSIM lines', 'eSIM-лінії'],
      ['data packs', 'пакети інтернету'],
      ['the youth tariff', 'молодіжний тариф'],
      ['router rental', 'оренду роутера'],
    ],
  },
  {
    id: 'plan_exact_gb',
    category: 'tariff_plan',
    density: 'low',
    sourceIdx: 0,
    en: 'Is there a plan with exactly {x} GB and unlimited social networks?',
    uk: 'Чи є тариф рівно на {x} ГБ з безлімітними соцмережами?',
    slots: same('5', '12', '20', '35', '50', '75', '100', '150'),
  },
  // sim_esim (4)
  {
    id: 'sim_esim_error',
    category: 'sim_esim',
    density: 'low',
    sourceIdx: 1,
    en: "My eSIM profile installation fails with the message '{x}'.",
    uk: "Встановлення профілю eSIM завершується помилкою '{x}'.",
    slots: same(
      'Unable to complete cellular plan change',
      'This code is no longer valid',
      'EID not eligible',
      'Activation limit reached',
      'Confirmation code required',
      'Cellular plan cannot be added',
      'SM-DP+ unreachable',
      'Profile download failed 0x5',
    ),
  },
  {
    id: 'sim_vanity_number',
    category: 'sim_esim',
    density: 'low',
    sourceIdx: 0,
    en: 'Can I get a SIM card with a number ending in {x}?',
    uk: 'Чи можна отримати SIM-картку з номером, що закінчується на {x}?',
    slots: same('77', '007', '555', '1234', '888', '000', '999', '2024'),
  },
  {
    id: 'sim_second_esim',
    category: 'sim_esim',
    density: 'medium',
    sourceIdx: 1,
    en: 'Can I get a second eSIM line for my {x}?',
    uk: 'Чи можна підключити другу eSIM-лінію для {x}?',
    slots: [
      ['iPad', 'iPad'],
      ['smartwatch', 'смарт-годинника'],
      ['laptop', 'ноутбука'],
      ['tablet', 'планшета'],
      ['car', 'автомобіля'],
      ['drone', 'дрона'],
      ['e-reader', 'e-book'],
      ['GPS tracker', 'GPS-трекера'],
    ],
  },
  {
    id: 'sim_swap_fraud',
    category: 'sim_esim',
    density: 'medium',
    sourceIdx: 2,
    en: 'My SIM was swapped without my consent and I got logged out of {x}, what should I do?',
    uk: 'Мою SIM замінили без моєї згоди, і мене розлогінило з {x}, що робити?',
    slots: same(
      'Telegram',
      'my bank app',
      'Viber',
      'WhatsApp',
      'Instagram',
      'Gmail',
      'Diia',
      'Monobank',
    ),
  },
  // technical_support (4)
  {
    id: 'tech_router_led',
    category: 'technical_support',
    density: 'medium',
    sourceIdx: 1,
    en: 'My router shows a red {x} light, what does it mean?',
    uk: 'На роутері горить червоний індикатор {x}, що це означає?',
    slots: same('LOS', 'PON', 'WAN', 'Internet', 'Alarm', 'Power', 'LAN1', 'DSL'),
  },
  {
    id: 'tech_vowifi_error',
    category: 'technical_support',
    density: 'medium',
    sourceIdx: 2,
    en: 'Error code {x} appears when I try to make a VoWiFi call.',
    uk: 'Помилка {x} при спробі зробити дзвінок через VoWiFi.',
    slots: same(
      'SIP 403',
      'SIP 408',
      'SIP 503',
      'SIP 487',
      'IMS 2001',
      'IMS 3105',
      'E911-17',
      'VoWiFi 24',
    ),
  },
  {
    id: 'tech_5g_device',
    category: 'technical_support',
    density: 'low',
    sourceIdx: 0,
    en: 'My {x} cannot connect to the 5G network, but other phones can.',
    uk: 'Мій {x} не підключається до 5G, хоча інші телефони підключаються.',
    slots: same(
      'Pixel 8',
      'Galaxy S24',
      'iPhone 15',
      'Xiaomi 13T',
      'OnePlus 12',
      'Motorola Edge 40',
      'Nothing Phone 2',
      'Realme GT 5',
    ),
  },
  {
    id: 'tech_port_forward',
    category: 'technical_support',
    density: 'low',
    sourceIdx: 1,
    en: 'How do I configure port forwarding for {x} on my home router?',
    uk: 'Як налаштувати проброс портів для {x} на домашньому роутері?',
    slots: [
      ['a Minecraft server', 'сервера Minecraft'],
      ['a CCTV camera', 'камери відеоспостереження'],
      ['Plex', 'Plex'],
      ['a NAS', 'NAS'],
      ['an SSH server', 'SSH-сервера'],
      ['a game console', 'ігрової консолі'],
      ['Home Assistant', 'Home Assistant'],
      ['a VPN server', 'VPN-сервера'],
    ],
  },
  // outage_incident (3)
  {
    id: 'out_cause_city',
    category: 'outage_incident',
    density: 'low',
    sourceIdx: 0,
    en: 'Is the outage in {x} caused by a damaged fiber line or a power failure?',
    uk: 'Збій у місті {x} спричинений пошкодженням оптики чи відсутністю електропостачання?',
    slots: [
      ['Kharkiv', 'Харків'],
      ['Lviv', 'Львів'],
      ['Odesa', 'Одеса'],
      ['Dnipro', 'Дніпро'],
      ['Kyiv', 'Київ'],
      ['Zaporizhzhia', 'Запоріжжя'],
      ['Poltava', 'Полтава'],
      ['Vinnytsia', 'Вінниця'],
    ],
  },
  {
    id: 'out_sla_credit',
    category: 'outage_incident',
    density: 'medium',
    sourceIdx: 1,
    en: 'I work from home and had no internet for {x} hours, can I request an SLA credit?',
    uk: 'Я працюю вдома і не мав інтернету {x} год, чи можна запросити SLA-кредит?',
    slots: same('6', '12', '18', '30', '36', '48', '72', '96'),
  },
  {
    id: 'out_evening_drop',
    category: 'outage_incident',
    density: 'low',
    sourceIdx: 2,
    en: 'Why does my {x} drop every evening between 7 and 10 pm?',
    uk: 'Чому в мене щовечора з 19 до 22 пропадає {x}?',
    slots: [
      ['mobile internet', 'мобільний інтернет'],
      ['Wi-Fi', 'Wi-Fi'],
      ['video call', 'відеодзвінок'],
      ['online game connection', 'зʼєднання в онлайн-грі'],
      ['IPTV stream', 'IPTV-потік'],
      ['VoLTE call', 'VoLTE-дзвінок'],
      ['VPN', 'VPN'],
      ['5G signal', 'сигнал 5G'],
    ],
  },
  // contract_termination (3)
  {
    id: 'contract_transfer_owner',
    category: 'contract_termination',
    density: 'low',
    sourceIdx: 0,
    en: 'How can I transfer the contract of my {x} to my own name?',
    uk: 'Як переоформити контракт {x} на себе?',
    slots: [
      ['late father', 'покійного батька'],
      ['late mother', 'покійної матері'],
      ['spouse who moved abroad', 'чоловіка, який виїхав за кордон'],
      ['business partner', 'бізнес-партнера'],
      ['elderly grandmother', 'літньої бабусі'],
      ['adult son', 'дорослого сина'],
      ['former employee', 'колишнього працівника'],
      ['ex-husband', 'колишнього чоловіка'],
    ],
  },
  {
    id: 'contract_mnp_reject',
    category: 'contract_termination',
    density: 'low',
    sourceIdx: 1,
    en: 'My number port-out request was rejected with reason code {x}, what now?',
    uk: 'Мій запит на перенесення номера відхилено з кодом {x}, що робити?',
    slots: same('R-01', 'R-07', 'R-12', 'MNP-203', 'MNP-415', 'REJ-33', 'REJ-08', 'DEBT-02'),
  },
  {
    id: 'contract_kiosk_promise',
    category: 'contract_termination',
    density: 'low',
    sourceIdx: 0,
    en: 'I signed up at a kiosk and was promised {x} months free, but it is not in the contract. Can I cancel without penalty?',
    uk: 'Підписав контракт у кіоску, обіцяли {x} міс. безкоштовно, але цього немає в договорі. Чи можна розірвати без штрафу?',
    slots: same('2', '3', '4', '5', '6', '9', '10', '12'),
  },
];

// ---------------------------------------------------------------------------
// KB-update scenarios used by the post-load invalidation phase.
// ---------------------------------------------------------------------------
export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'kbu-roaming-eu-fair-use',
    kbSourceId: 'kb-roaming-eu-01',
    intentId: 'roam_eu_usage',
    title: 'EU roaming fair-use limit reduced',
    changeReason: 'Regulatory/commercial change: EU fair-use roaming data cap lowered.',
    previousFact: 'EU/EEA roaming fair-use limit is 15 GB per month.',
    updatedFact: 'EU/EEA roaming fair-use limit is 10 GB per month; extra data costs 3 EUR per GB.',
    staleMarkers: ['15 GB', '15 ГБ'],
    freshMarkers: ['10 GB', '10 ГБ'],
    newVersion: 'v2',
    newContentEn:
      'Within the EU/EEA the plan can be used like at home with a fair-use limit of 10 GB of roaming data per month; after that data costs 3 EUR per GB. Calls are charged as domestic. Outside the EU/EEA, standard roaming rates apply.',
    newContentUk:
      'У країнах ЄС/ЄЕЗ тариф працює як вдома з лімітом чесного використання 10 ГБ роумінгового інтернету на місяць; після цього інтернет коштує 3 EUR за 1 ГБ. Дзвінки тарифікуються як у межах країни. Поза ЄС/ЄЕЗ діють стандартні роумінгові тарифи.',
    newSummary: 'EU/EEA roaming fair-use limit lowered to 10 GB per month.',
    probes: {
      en: 'What is the monthly fair-use limit for roaming data in the EU?',
      uk: 'Який місячний ліміт роумінгового інтернету в ЄС?',
    },
  },
  {
    id: 'kbu-tariff-switch-fee',
    kbSourceId: 'kb-tariff-switch-01',
    intentId: 'plan_upgrade_bigger',
    title: 'Plan change becomes paid and delayed',
    changeReason: 'Plan change policy: fee introduced and changes apply from the next billing day.',
    previousFact: 'Plan change takes 15 minutes, costs 0 UAH and applies immediately.',
    updatedFact: 'Plan change costs 50 UAH and applies from the next billing day.',
    staleMarkers: ['15 minutes', '15 хвилин', '0 UAH', '0 грн'],
    freshMarkers: ['50 UAH', '50 грн'],
    newVersion: 'v2',
    newContentEn:
      'Plan change costs 50 UAH and is applied from the next billing day. Upgrades and downgrades use the same flow in the app.',
    newContentUk:
      'Зміна тарифу коштує 50 грн і застосовується з наступного розрахункового дня. Підвищення та зниження тарифу виконуються в застосунку однаково.',
    newSummary: 'Plan change now costs 50 UAH and applies from the next billing day.',
    probes: {
      en: 'How much does a plan change cost and when does it apply?',
      uk: 'Скільки коштує зміна тарифу і коли вона починає діяти?',
    },
  },
  {
    id: 'kbu-sim-replacement-price',
    kbSourceId: 'kb-sim-replacement-01',
    intentId: 'sim_replace_physical',
    title: 'SIM replacement price increased',
    changeReason: 'Price change: SIM replacement fee raised from 100 to 150 UAH.',
    previousFact: 'SIM replacement costs 100 UAH.',
    updatedFact: 'SIM replacement costs 150 UAH.',
    staleMarkers: ['100 UAH', '100 грн'],
    freshMarkers: ['150 UAH', '150 грн'],
    newVersion: 'v2',
    newContentEn:
      'A replacement SIM with the same number costs 150 UAH and is issued at a store with a passport or Diia ID, or delivered by courier within 3 business days. New SIM cards are activated after registration with a passport.',
    newContentUk:
      'Заміна SIM із збереженням номера коштує 150 грн і виконується в магазині за паспортом або Дія.ID чи кур’єром протягом 3 робочих днів. Нові SIM-картки активуються після реєстрації за паспортом.',
    newSummary: 'SIM replacement fee is now 150 UAH.',
    probes: {
      en: 'How much does a replacement SIM card cost?',
      uk: 'Скільки коштує заміна SIM-картки?',
    },
  },
  {
    id: 'kbu-billing-autopay-discount',
    kbSourceId: 'kb-billing-autopay-01',
    intentId: 'bill_autopay_enable',
    title: 'Autopay discount increased',
    changeReason: 'Promotion policy: autopay discount raised from 3% to 5%.',
    previousFact: 'Autopay gives a 3% monthly discount.',
    updatedFact: 'Autopay gives a 5% monthly discount.',
    staleMarkers: ['3%'],
    freshMarkers: ['5%'],
    newVersion: 'v2',
    newContentEn:
      'Autopay is enabled in the app under Payments > Autopay. Customers with autopay receive a 5% monthly discount on the plan fee. The card can be replaced in the same menu.',
    newContentUk:
      'Автоплатіж вмикається в застосунку: Платежі > Автоплатіж. Клієнти з автоплатежем отримують знижку 5% на абонплату щомісяця. Картку можна замінити в тому самому меню.',
    newSummary: 'Autopay discount raised to 5%.',
    probes: {
      en: 'What discount do I get for enabling autopay?',
      uk: 'Яку знижку я отримаю за підключення автоплатежу?',
    },
  },
  {
    id: 'kbu-contract-notice-period',
    kbSourceId: 'kb-contract-cancel-01',
    intentId: 'contract_cancel',
    title: 'Contract cancellation notice period shortened',
    changeReason: 'Consumer-protection update: notice period reduced from 30 to 14 days.',
    previousFact: 'Cancellation requires a 30-day written notice.',
    updatedFact: 'Cancellation requires a 14-day written notice.',
    staleMarkers: ['30 days', '30 днів'],
    freshMarkers: ['14 days', '14 днів'],
    newVersion: 'v2',
    newContentEn:
      'To cancel a contract, submit a written notice 14 days in advance via the app, a store, or registered mail; outstanding balances must be settled. A passport is required for in-store cancellation.',
    newContentUk:
      'Щоб розірвати контракт, подайте письмове повідомлення за 14 днів через застосунок, магазин або рекомендований лист; заборгованість потрібно погасити. Для розірвання в магазині потрібен паспорт.',
    newSummary: 'Contract cancellation notice period is now 14 days.',
    probes: {
      en: 'How many days in advance must I notify you to cancel my contract?',
      uk: 'За скільки днів потрібно повідомити про розірвання контракту?',
    },
  },
];
