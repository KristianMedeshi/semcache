# SemCache Mobile — Customer Support Knowledge Base

Document ID: KB-TELECOM-001
Language: English
Version: 1.0
Last reviewed: 2026-11-23
Audience: Telecom Assistant (AI customer support) and human agents
Currency: Euro (EUR, €). All prices include VAT unless stated otherwise.

> NOTE FOR MAINTAINERS: All plans, prices, limits, phone numbers, and policies in this document are illustrative sample data for a fictional operator called "SemCache Mobile". Replace them with real values before production use. Each section is written to be self-contained so that it can be retrieved independently (chunked) without losing meaning.

---

# 0. Assistant Guidelines

## 0.1 Role and tone

Telecom Assistant is the official AI support assistant of SemCache Mobile. It answers questions about mobile plans, data usage, payments, roaming, SIM and eSIM, network troubleshooting, and account management.

- Be friendly, concise, and clear. Use plain language and avoid technical jargon unless the customer asks for it.
- Give step-by-step instructions as numbered lists.
- Always answer using information from this knowledge base. If the information is not available, say so honestly and offer to connect the customer with a human agent.
- Never invent prices, dates, coverage promises, or policies.
- Ask one short clarifying question when the request is ambiguous (for example: "Are you on a prepaid or a monthly plan?").

## 0.2 Security rules

- SemCache Mobile staff and the assistant NEVER ask for the customer's account password, full card number, card CVV, or one-time verification codes in chat.
- Never ask the customer to share a one-time code (OTP) with anyone. If a customer reports that someone asked for their code, treat it as possible fraud and advise them to contact a human agent immediately.
- The assistant cannot change account ownership, cancel a contract, or approve refunds. These actions require a human agent and identity verification.

## 0.3 Customer-facing transparency rule

The assistant must not mention internal technology such as caching, similarity scores, embeddings, token counts, model names, or response timings. Answers should read as natural support replies from the official SemCache Mobile assistant.

## 0.4 When to escalate to a human agent

Offer escalation to a human agent when:

1. The customer explicitly asks for a human.
2. The customer reports suspected fraud, a stolen phone or SIM, or unauthorized charges.
3. The customer disputes a bill or requests a refund or compensation.
4. The customer wants to cancel a contract, port out their number, or transfer ownership.
5. The problem remains unresolved after the troubleshooting steps in this document.
6. The customer is distressed or has an urgent safety-related issue.

---

# 1. Company and Contact Overview

## 1.1 About SemCache Mobile

SemCache Mobile is a mobile network operator offering 5G and 4G (LTE) services, prepaid and monthly (postpaid) plans, family plans, eSIM, and international roaming.

## 1.2 Contact channels

| Channel                  | Details                                                           | Availability             |
| ------------------------ | ----------------------------------------------------------------- | ------------------------ |
| Telecom Assistant (chat) | In the SemCache Support web app and mobile app                    | 24/7                     |
| Human agents (chat)      | "Talk to a human agent" button in chat                            | Daily 07:00–23:00 CET    |
| Phone support            | Dial 1234 from a SemCache number, or +00 800 123 4567 from abroad | Daily 07:00–23:00 CET    |
| Shops                    | Store locator in the app                                          | Store opening hours vary |

## 1.3 Human agent wait times

Typical estimated wait time to reach a human agent is 2–8 minutes during opening hours. During peak times (weekdays 17:00–20:00) it can be up to 15 minutes. When the customer asks for a human agent, a summary of the conversation is handed over so the customer does not have to repeat the issue.

## 1.4 Self-service tools

- My SemCache app (iOS and Android) and the web account portal: check usage, pay bills, change plans, buy add-ons, manage eSIM, manage roaming.
- USSD short codes (work on any phone, no internet needed):
  - *123# — check balance and remaining allowances
  - *124# — buy add-ons
  - *125# — roaming menu
- SMS keywords sent to 1234: DATA (data left), BALANCE (prepaid balance), BILL (current bill amount).

---

# 2. Mobile Plans and Subscriptions

## 2.1 Plan overview (monthly / postpaid, 12-month or no-commitment options)

### 5G Essential — €25 per month

- 30 GB of 5G/4G data per month
- Unlimited calls and SMS within the country
- EU roaming: 10 GB per month
- Hotspot (tethering): 10 GB
- Best for: light and moderate users who mostly use Wi-Fi at home.

### 5G Unlimited — €40 per month

- Unlimited data: 100 GB at full 5G/4G speed, then speed reduced to 3 Mbps for the rest of the billing cycle
- Unlimited calls and SMS within the country
- EU roaming: 30 GB per month
- Hotspot: 30 GB
- Best for: heavy users, streaming, remote work, and gaming.

### 5G Unlimited Premium — €55 per month

- Unlimited data: 300 GB at priority speed, then 5 Mbps
- Unlimited calls and SMS within the country, plus 100 minutes per month to EU countries
- EU roaming: 50 GB per month, plus 5 GB in Zone 2 and Zone 3 countries
- Hotspot: 100 GB
- Video streaming up to 4K, priority network access during congestion
- Best for: frequent travelers, professionals, and customers who want the best speeds.

## 2.2 Prepaid plans (no contract)

### Flex Prepaid — €10 per 30 days

- 10 GB of data
- 100 minutes of calls and unlimited SMS
- Best for: occasional use or a secondary SIM.

### Prepaid Plus — €20 per 30 days

- 40 GB of data (5G where available)
- Unlimited calls and SMS
- EU roaming: 5 GB
- Best for: regular users who prefer no contract.

How prepaid works: the customer tops up their balance and the plan package renews automatically every 30 days if there is enough balance. If the balance is insufficient on the renewal date, the package is not renewed and only pay-as-you-go rates apply until the balance is topped up (data €0.02 per MB, calls €0.15 per minute, SMS €0.10 each).

## 2.3 Family plans

- 2 lines — €60 per month
- 3 lines — €85 per month
- 4 lines — €105 per month
- Each additional line (up to 6 lines total) — €15 per month
- Each line gets the same benefits as 5G Unlimited (100 GB full-speed data per line).
- One account owner manages and pays for all lines. Lines can be added or removed in the app under Plans > Family.
- Family members can live at different addresses. A multi-line discount applies automatically.

## 2.4 Which plan is right for me? (decision guide)

Use these questions to recommend a plan:

1. How much mobile data do you use per month? Under 10 GB: Flex Prepaid. 10–40 GB: Prepaid Plus or 5G Essential. Over 40 GB: 5G Unlimited or Premium.
2. Do you want a contract? If no: prepaid. If yes: postpaid is cheaper per GB.
3. Do you travel abroad often? Frequent travelers benefit from 5G Unlimited Premium or a Travel Pass add-on.
4. Do you need to share with family? Choose a Family plan for 2 or more lines.
5. Do you use hotspot or tethering for work? Choose 5G Unlimited or higher.

Quick recommendations:

- Student on a budget, mostly Wi-Fi: Flex Prepaid or 5G Essential.
- Daily streaming and social media: 5G Unlimited.
- Remote worker using hotspot: 5G Unlimited or Premium.
- Couple or family: Family plan.

## 2.5 Add-ons

| Add-on                    | Price        | Details                                                                          |
| ------------------------- | ------------ | -------------------------------------------------------------------------------- |
| Extra Data 5 GB           | €5           | Valid until the end of the current billing cycle (postpaid) or 30 days (prepaid) |
| Extra Data 20 GB          | €15          | Same validity                                                                    |
| Hotspot Boost 20 GB       | €7           | Extra tethering allowance                                                        |
| International Minutes 100 | €6           | Calls to EU countries                                                            |
| Device Insurance          | €6 per month | Covers accidental damage and theft; deductible applies                           |

Add-ons can be purchased in the app, by dialing *124#, or in the web portal.

## 2.6 Changing or canceling a plan

- Upgrade: takes effect immediately, charges are pro-rated.
- Downgrade: takes effect at the start of the next billing cycle.
- No-commitment plans can be changed at any time. Customers on a 12-month contract may be charged an early termination fee equal to the remaining discounts; the exact amount is shown in the app under Plans > Contract details.
- Cancellation and number porting must be handled by a human agent. A 30-day notice period may apply for postpaid plans.

## 2.7 Plan FAQ

**Q: Is 5G included in all plans?**
A: Yes. 5G is included in all plans in areas with 5G coverage and on 5G-compatible devices. No extra fee applies.

**Q: What happens after I use all my full-speed data on an unlimited plan?**
A: You can keep using data, but the speed is reduced (3 Mbps on 5G Unlimited, 5 Mbps on Premium) until the next billing cycle starts. You can buy Extra Data to restore full speed.

**Q: Is there a contract?**
A: Postpaid plans are available with no commitment or with a 12-month commitment, which gives a €5 per month discount. Prepaid plans have no contract.

**Q: Can I keep my current phone number?**
A: Yes. Number porting is free and usually takes 1 business day. Contact a human agent or visit a shop.

---

# 3. Mobile Internet and Data Usage

## 3.1 How to check remaining data

Choose any of these methods:

1. **My SemCache app:** open the app and go to Home > Usage. You will see data used, data remaining, and the date the allowance resets.
2. **Web portal:** sign in and open Usage.
3. **USSD:** dial *123# and choose "Data".
4. **SMS:** send the word DATA to 1234. A reply with the remaining data arrives within a minute.

## 3.2 When does my data reset?

- Postpaid: data resets on the first day of your billing cycle. The billing cycle date is shown in the app under Billing > Billing cycle. It does not change unless you request it.
- Prepaid: data resets every 30 days from the date the package was activated or renewed.
- Unused data does not roll over to the next cycle, except when the customer has the "Data Rollover" add-on (€2 per month, rolls over up to 10 GB).

## 3.3 Speed reduction after the data allowance

- 5G Essential: after the 30 GB limit, speed is limited to 1 Mbps (or the customer can buy Extra Data).
- 5G Unlimited: after 100 GB, speed is limited to 3 Mbps.
- 5G Unlimited Premium: after 300 GB, speed is limited to 5 Mbps.
- Prepaid: after the data package is used, data stops unless the customer buys an add-on or has pay-as-you-go balance.

## 3.4 Data usage alerts

SemCache Mobile sends an SMS and an app notification when 80% and 100% of the data allowance has been used. Alerts can be configured in the app under Settings > Notifications > Data alerts.

## 3.5 Tips to reduce data usage

1. Connect to Wi-Fi when available.
2. Turn off automatic app updates on mobile data.
3. Set streaming quality to "Standard" or "Data saver".
4. Turn on Data Saver mode (Android) or Low Data Mode (iPhone).
5. Disable background app refresh for apps you rarely use.
6. Download playlists, maps, and videos over Wi-Fi.

## 3.6 Why is my data usage higher than expected?

Common reasons are video streaming and video calls, automatic cloud photo backups, system and app updates, hotspot use by other devices, and background app refresh. The Usage screen in the app shows data usage by day. If the usage appears incorrect, the customer should contact a human agent with the date and amount in question.

## 3.7 Data usage FAQ

**Q: Does hotspot data count toward my data allowance?**
A: Hotspot uses the same data, but each plan has a separate hotspot limit (for example 30 GB on 5G Unlimited). When the hotspot limit is reached, hotspot speed is reduced to 1 Mbps while normal data on the phone continues to work.

**Q: Does Wi-Fi calling or Wi-Fi usage count as mobile data?**
A: No. Data used over Wi-Fi is not counted.

**Q: Is there a data speed difference between 4G and 5G?**
A: 5G can reach typical speeds of 150–600 Mbps in good coverage, and 4G typically 20–100 Mbps. Real speeds depend on location, device, signal, and network load.

---

# 4. Account Balance, Billing and Payments

## 4.1 How to pay my bill

Customers can pay a SemCache Mobile bill in these ways:

1. **AutoPay (recommended):** the bill is charged automatically to a saved card or bank account on the due date.
2. **Card payment in the app or web portal:** go to Billing > Pay now, choose a card (Visa, Mastercard, or Maestro), and confirm. Apple Pay and Google Pay are supported.
3. **Bank transfer:** use the payment reference on the bill. Transfers usually take 1–2 business days to appear.
4. **In a shop:** pay by card or cash at any SemCache Mobile store.

## 4.2 How to set up AutoPay

1. Open the My SemCache app and go to Billing > AutoPay.
2. Tap "Set up AutoPay".
3. Add a payment card or bank account (SEPA direct debit).
4. Confirm with a one-time code sent to your phone, or with your card's 3-D Secure check.
5. AutoPay is now active. The bill is charged on the due date. A confirmation message is sent after each payment.

AutoPay customers receive a €2 monthly discount on postpaid plans. To change or update an expired payment card, go to Billing > AutoPay > Update card and save the new card. AutoPay can be turned off at any time under Billing > AutoPay > Turn off.

## 4.3 Billing cycle and due date

- Bills are issued once per month on the billing cycle date.
- The payment due date is 14 days after the bill is issued.
- Bills are delivered electronically (e-bill) in the app and by email. Paper bills cost €2 extra per month.

## 4.4 Late payments

- A grace period of 7 days after the due date applies with no penalty.
- After the grace period, a late fee of €5 is added.
- If the bill remains unpaid for 30 days after the due date, outgoing services may be restricted (incoming calls still work). After 60 days the service may be suspended.
- Once the bill is paid, service is restored within 1 hour in most cases.
- Customers who have trouble paying on time can request a payment plan from a human agent.

## 4.5 Checking my bill and balance

- Postpaid: Billing > Current bill shows the amount, itemized charges, and the due date. Send BILL to 1234 for a quick SMS summary.
- Prepaid: dial *123# or send BALANCE to 1234 to see the balance and package expiry.

## 4.6 Prepaid top-up

Ways to top up: the My SemCache app (card, Apple Pay, Google Pay), the web portal, top-up vouchers sold in shops and kiosks, or bank transfer. Minimum top-up is €5, maximum is €100 per transaction. The balance is valid for 12 months after the last top-up.

## 4.7 Understanding my bill

A typical bill contains:

- Monthly plan fee
- Add-ons and one-time purchases
- Usage outside the plan (premium-rate numbers, roaming outside included zones)
- Discounts (AutoPay, loyalty, multi-line)
- VAT

Charges unfamiliar to the customer can be reviewed under Billing > Itemized charges. Premium-rate SMS subscriptions and third-party content can be blocked under Settings > Services > Block third-party charges.

## 4.8 Disputing a charge, double charges, and refunds

- Duplicate or double charges and unrecognized line items can be disputed in the app under Billing > Dispute or via a human agent.
- Customers should provide the bill date, the amount, and a short description.
- Refund processing time: approved refunds for confirmed double charges or billing errors are returned to the original payment method within 5–10 business days.
- Disputes must be submitted within 60 days of the bill date.

## 4.9 Payment troubleshooting

**Card payment declined:**

1. Check that the card number, expiry date, and CVV are correct.
2. Make sure the card allows online payments and has sufficient funds.
3. Complete the 3-D Secure check with the bank app or SMS.
4. Try another card or Apple Pay / Google Pay.
5. If the problem continues, contact the card issuer or a human agent.

**Payment made, but service not restored:** wait up to 1 hour. If the service is still restricted, restart the phone and contact a human agent.

## 4.10 Billing FAQ

**Q: Can I change my billing date?**
A: Yes, once every 6 months. A human agent can change it; the next bill will be pro-rated.

**Q: Can I get an invoice for my company?**
A: Yes. Business invoices with a VAT ID can be requested under Billing > Invoice details or through a human agent.

**Q: Will I be charged for using the app?**
A: No. The My SemCache app does not use your data allowance when used on SemCache Mobile's network (zero-rated).

---

# 5. Roaming and International Services

## 5.1 How roaming works

Roaming means using your phone abroad on a partner operator's network. SemCache Mobile divides countries into three zones.

| Zone                    | Countries (examples)                                                   | How it works                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Zone 1: EU/EEA          | All EU countries, Iceland, Norway, Liechtenstein                       | "Roam like at home": use your plan's included minutes, SMS, and roaming data at no extra cost (fair use policy applies) |
| Zone 2: Extended Europe | United Kingdom, Switzerland, Turkey, Western Balkans, Ukraine, Moldova | Use a Travel Pass for predictable pricing. Without a pass, pay-as-you-go rates apply                                    |
| Zone 3: Worldwide       | USA, Canada, Asia, Middle East, Africa, South America, Oceania         | Use a Travel Pass. Without a pass, pay-as-you-go rates apply                                                            |

The EU/EEA zone is based on the European "Roam like at home" rules. Zone assignments can change; the current list is in the app under Roaming > Country list.

## 5.2 EU roaming data allowance by plan

- 5G Essential: 10 GB per month
- 5G Unlimited: 30 GB per month
- 5G Unlimited Premium: 50 GB per month
- Prepaid Plus: 5 GB per 30 days
- Flex Prepaid: no included EU roaming data; use a Travel Pass or pay-as-you-go
  After the EU roaming allowance is used, data costs €0.005 per MB (€5 per GB), or the customer can buy a Roaming Data Booster.

## 5.3 Travel Passes

Travel Passes give a fixed data, call, and SMS bundle for a fixed number of days, which avoids surprise charges.

### Zone 2 Travel Pass

| Pass       | Price           | Includes                                                                       |
| ---------- | --------------- | ------------------------------------------------------------------------------ |
| Day Pass   | €5 per day      | 1 GB data per day, unlimited incoming calls, 30 minutes outgoing calls, 30 SMS |
| Week Pass  | €25 for 7 days  | 8 GB total, 150 minutes, 100 SMS                                               |
| Month Pass | €60 for 30 days | 25 GB total, 300 minutes, 300 SMS                                              |

### Zone 3 (Worldwide) Travel Pass

| Pass       | Price            | Includes                                                                         |
| ---------- | ---------------- | -------------------------------------------------------------------------------- |
| Day Pass   | €10 per day      | 500 MB data per day, unlimited incoming calls, 20 minutes outgoing calls, 20 SMS |
| Week Pass  | €45 for 7 days   | 5 GB total, 100 minutes, 100 SMS                                                 |
| Month Pass | €100 for 30 days | 15 GB total, 200 minutes, 200 SMS                                                |

How a Day Pass works: a Day Pass is activated automatically on the first use of roaming data in that 24-hour period if the customer has enabled "Auto Day Pass" in the app. Otherwise, the customer must buy it manually. Pass validity is counted in 24-hour periods starting from activation.

## 5.4 How to prepare for travel (checklist)

1. Check whether your destination is in Zone 1, 2, or 3 in the app under Roaming > Country list.
2. Buy a Travel Pass if traveling outside the EU/EEA, before departure or on arrival with Wi-Fi.
3. Make sure your phone is unlocked and compatible with local networks.
4. Turn on Data roaming in your phone settings (iPhone: Settings > Mobile Service > Mobile Data Options > Data Roaming; Android: Settings > Network > SIM > Roaming).
5. Set a roaming spending cap (see 5.6).
6. Download offline maps and enable Wi-Fi calling for cheaper calls.
7. Remember that voicemail retrieval abroad is charged as an outgoing call.

## 5.5 How to activate roaming

- Roaming is enabled by default for postpaid plans in Zone 1.
- For Zone 2 and Zone 3 roaming, enable it in the app under Roaming > Settings, or dial *125#.
- Prepaid customers need a minimum balance of €5 to use roaming outside Zone 1.
- After landing, switch off Airplane mode and wait up to 2 minutes for the phone to connect to a partner network. A welcome SMS confirms the connection and shows the zone.

## 5.6 Roaming spending cap and alerts

- A default spending limit of €50 per billing cycle applies to out-of-plan roaming charges. When the limit is reached, roaming data is paused.
- Customers get alerts at 80% and 100% of the cap by SMS.
- The cap can be raised or removed under Roaming > Settings > Spending limit.
- Out-of-plan roaming data is also blocked automatically when a Travel Pass is not active in Zone 3, unless the customer opts in.

## 5.7 Roaming pay-as-you-go rates (without a pass)

| Service        | Zone 2           | Zone 3           |
| -------------- | ---------------- | ---------------- |
| Data           | €0.015 per MB    | €0.03 per MB     |
| Outgoing calls | €0.40 per minute | €1.20 per minute |
| Incoming calls | €0.20 per minute | €0.80 per minute |
| SMS (outgoing) | €0.15            | €0.30            |
| SMS (incoming) | Free             | Free             |

## 5.8 Fair use policy in the EU/EEA

Roam-like-at-home applies to customers who live in the home country or have stable links to it. If a customer spends more time abroad than at home over a 4-month period and mostly uses roaming, SemCache Mobile may contact the customer and apply a small surcharge on roaming data (up to €0.005 per MB) after a notice period.

## 5.9 Roaming troubleshooting

**No signal or no data abroad:**

1. Make sure Data roaming is turned on.
2. Restart the phone or toggle Airplane mode on and off for 10 seconds.
3. Select the network manually: Settings > Mobile Network > Network selection > choose a partner operator (if more than one is available, try another).
4. Check that your plan or Travel Pass is active in the app.
5. Check that you are not over the roaming spending cap.
6. If you still cannot connect, contact support. Calls to support from abroad are free via +00 800 123 4567 (or via the chat in the app over Wi-Fi).

**Unexpected roaming charges:** check Billing > Itemized charges and ask a human agent to review them. Common reasons: connecting to a ship or airplane network (not covered by passes), calls to premium numbers, and the phone connecting to a network in a bordering country by mistake. When near borders, set the network to manual selection.

## 5.11 Calling home and international calls

- To call abroad from the home network, dial + followed by the country code and number, for example +49 for Germany.
- International calls from the home country to EU countries are included in the Premium plan up to 100 minutes. On other plans, they cost €0.10 per minute to Zone 1 and €0.50 per minute to Zone 2/3.
- International Minutes 100 add-on (€6) adds 100 minutes to EU countries.

## 5.12 Roaming FAQ

**Q: Do I need to pay extra for roaming in the EU?**
A: No, within your plan's EU roaming allowance there are no extra charges.

**Q: Can I use my Travel Pass in several countries?**
A: A pass works within its zone. For example, a Zone 3 pass works in all Zone 3 countries during its validity.

**Q: Does using Wi-Fi abroad cost anything?**
A: No. Wi-Fi does not use roaming data.

**Q: What if I lose my phone abroad?**
A: Contact a human agent immediately. The SIM can be blocked right away and a replacement eSIM or SIM can be arranged.

---

# 6. SIM Cards and eSIM

## 6.1 SIM vs eSIM

- A physical SIM is a small card inserted into the phone. SemCache Mobile supplies a combined Nano/Micro/Mini SIM.
- An eSIM is a digital SIM built into the device. It is activated by scanning a QR code or through the app. No plastic card is needed.
- Most phones can hold both a physical SIM and an eSIM (dual SIM).

## 6.2 eSIM-compatible devices

Compatible devices include (examples; the full list is in the app):

- Apple iPhone XS, XR and newer (iPhone 14 and newer in some countries are eSIM-only)
- Samsung Galaxy S20 and newer, Galaxy Z Flip/Fold series
- Google Pixel 3 and newer
- Many recent Xiaomi, Oppo, Motorola, and Huawei models
- Some smartwatches and tablets with cellular
  The phone must be network-unlocked (not locked to another operator). Check by dialing *#06# and looking for an EID number; if an EID is shown, the device supports eSIM.

## 6.3 How to activate an eSIM (new customer or new eSIM)

You need: an eSIM-compatible, unlocked phone, a stable Wi-Fi connection, and the QR code or activation details from SemCache Mobile (shown in the app, web portal, or email).

**iPhone:**

1. Connect to Wi-Fi.
2. Go to Settings > Mobile Service (or Cellular) > Add eSIM.
3. Choose "Use QR Code" and scan the QR code.
4. Follow the prompts, give the line a label (for example "Personal"), and choose which line to use for calls and data.
5. Wait for the activation to finish (up to 5 minutes). A message "Cellular plan activated" appears.

**Android (Samsung example):**

1. Connect to Wi-Fi.
2. Go to Settings > Connections > SIM manager > Add eSIM > Scan QR code from service provider.
3. Scan the QR code and follow the on-screen instructions.
4. Choose which SIM is used for calls, messages, and data.
5. Wait for activation. Restart the phone if the network name does not appear.

If the QR code cannot be scanned, enter the details manually: SM-DP+ address and activation code are displayed under the QR code in the app (Manage eSIM > Manual setup).

Important: A QR code works only once. After it has been installed, it cannot be used again. If the installation failed midway or the QR code does not work, do not delete the partially installed profile; contact support to get a new QR code.

## 6.4 How to get an eSIM from the app (existing customers)

1. Open the My SemCache app and sign in.
2. Go to Account > SIM & eSIM > Get eSIM.
3. Verify your identity with an SMS code.
4. Scan or tap the QR code on a second device, or tap "Install on this device" (supported on iPhone with iOS 17.4 and newer, and on selected Android devices).
5. Your physical SIM is deactivated when the eSIM becomes active.

## 6.5 Transferring an eSIM to a new phone

1. In the app go to Account > SIM & eSIM > Transfer eSIM to a new device and confirm with an SMS code.
2. A new QR code is generated.
3. On the new phone, follow the eSIM activation steps in section 6.3 using the new QR code.
4. After the new eSIM is activated, the eSIM on the old phone stops working.
   Alternative on iPhone: use "Transfer from nearby iPhone" in Settings > Mobile Service when setting up the new phone, or "Quick Transfer" if both phones are on iOS 16 or newer. A transfer is free. Keep both phones close and connected to Wi-Fi.

## 6.6 Moving from eSIM to a physical SIM, or ordering a replacement SIM

- A replacement SIM costs €5 (free if the SIM is faulty). It is delivered within 2–3 business days or can be collected in a shop immediately.
- To activate a new physical SIM: insert it, turn the phone on, and follow the activation SMS. You can also activate it in the app under Account > SIM & eSIM > Activate SIM by entering the ICCID printed on the card (19–20 digits).

## 6.7 Lost or stolen SIM or phone

1. Contact a human agent immediately, or block the SIM in the app under Account > SIM & eSIM > Block SIM.
2. The SIM is blocked within minutes to prevent misuse. Charges after the blocking request are not payable by the customer.
3. A new SIM or eSIM can be issued, and the phone number is kept.
4. Report the theft to the police and the device manufacturer. The IMEI number (dial *#06#) can be used to block the device.

## 6.7b PIN and PUK codes

- The SIM PIN protects the SIM. The default PIN is printed on the SIM card holder. After 3 wrong attempts the SIM is locked.
- To unlock, enter the 8-digit PUK code, which can be found in the app under Account > SIM & eSIM > PUK code. After 10 wrong PUK attempts the SIM is permanently blocked and has to be replaced.

## 6.8 eSIM troubleshooting

| Problem                                            | Solution                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| QR code will not scan                              | Increase screen brightness, try another screen, or use manual setup details                          |
| "Unable to complete cellular plan change" (iPhone) | Check Wi-Fi, update iOS, restart phone, retry. If it persists, request a new QR code                 |
| "This code is no longer valid"                     | The QR code has already been used. Request a new one in the app                                      |
| eSIM installed but no signal                       | Turn on the eSIM line under Mobile Service, toggle Airplane mode, restart, and wait up to 15 minutes |
| Phone says SIM not supported                       | The phone may be network-locked or not eSIM compatible. Check with the manufacturer                  |
| Old SIM still active                               | The physical SIM is deactivated automatically after eSIM activation. Remove it or turn the line off  |

## 6.9 SIM and eSIM FAQ

**Q: Does an eSIM cost extra?**
A: No. eSIM activation is free for new and existing customers. Only a replacement physical SIM has a €5 fee.

**Q: How long does eSIM activation take?**
A: Usually 2–5 minutes. Rarely up to 15 minutes.

**Q: Can I have two numbers on one phone?**
A: Yes, on dual SIM phones you can use one eSIM and one physical SIM, or two eSIMs on some devices. Each number needs its own plan.

**Q: Can I use eSIM for roaming?**
A: Yes. Your SemCache Mobile eSIM works in the same way as a physical SIM for roaming.

**Q: Will I lose my number when I switch to eSIM?**
A: No. The phone number stays the same.

---

# 7. Network Connectivity and Technical Support

## 7.1 "My mobile internet isn't working" — step-by-step troubleshooting

Follow the steps in order and check after each step whether the problem is solved.

1. **Check the signal indicator.** If there are no bars or "No service" appears, go to section 7.2.
2. **Toggle Airplane mode.** Turn it on for 15 seconds and off again.
3. **Check that mobile data is on.** iPhone: Settings > Mobile Service > Mobile Data. Android: Settings > Network > Mobile data.
4. **Check data allowance and balance.** Open the My SemCache app (works over Wi-Fi) or dial *123#. If the data allowance is used up on a prepaid plan or the bill is unpaid, mobile data is blocked.
5. **Restart the phone.**
6. **Check for a network outage** in the app under Network status, or on the coverage page. If there is an outage in your area, service is usually restored within a few hours.
7. **Check data roaming.** Roaming can be accidentally enabled or disabled. At home, roaming should be off for normal use unless you are at a border.
8. **Check APN settings** (see 7.4).
9. **Update the phone software** (iOS or Android carrier settings).
10. **Remove and reinsert the SIM** (or toggle the eSIM line off and on).
11. **Reset network settings.** iPhone: Settings > General > Transfer or Reset iPhone > Reset > Reset Network Settings. Android: Settings > System > Reset options > Reset Wi-Fi, mobile and Bluetooth. Saved Wi-Fi passwords will be removed.
12. **Try the SIM in another phone** (or another SIM in your phone) to find out whether the problem is the SIM or the device.
    If the problem remains, offer to connect the customer with a human agent and provide a short summary of the steps already tried.

## 7.2 No signal / "No service"

1. Move to a different location. Basements, elevators, thick walls, and some buildings block the signal.
2. Check Airplane mode is off.
3. Set the network mode to Automatic (5G/4G/3G) and choose "Automatic" in Network selection.
4. Make sure the SIM is inserted correctly and clean, or the eSIM line is turned on.
5. Check the SIM is not locked: if the phone asks for a PIN, enter it. If the SIM is locked, use the PUK (see 6.7b).
6. Check that the account is active and the bill is paid.
7. Restart the phone.
8. If many users in your area have the same issue, there may be an outage.

## 7.3 Slow internet speed

1. Run a speed test at the same place several times (typical 5G speed is 150–600 Mbps, 4G 20–100 Mbps).
2. Check whether the data limit has been reached and the speed is reduced (see section 3.3).
3. Move close to a window or outside; indoor coverage is often weaker.
4. Avoid peak hours (18:00–22:00) when networks are busiest. Premium customers get priority.
5. Turn off VPN and battery saver or Data Saver while testing.
6. Close apps running in the background and downloads.
7. Toggle Airplane mode, restart the phone, and switch network mode between 5G and 4G (LTE) to see which is better in your location.
8. Update the phone software and carrier settings.

## 7.4 APN settings

APN (Access Point Name) settings tell the phone how to connect to mobile data. They are configured automatically in most cases. If mobile data fails, check or enter them manually.

**Internet APN:**

- Name: SemCache Internet
- APN: internet.semcache.mobile
- Username: (leave empty)
- Password: (leave empty)
- MCC: 001
- MNC: 01
- Authentication type: None (or PAP)
- APN type: default,supl
- APN protocol: IPv4/IPv6
- APN roaming protocol: IPv4/IPv6
- Bearer: Unspecified

**MMS APN (picture messages):**

- Name: SemCache MMS
- APN: mms.semcache.mobile
- MMSC: http://mms.semcache.mobile/servlets/mms
- MMS proxy: 10.10.10.10
- MMS port: 8080
- APN type: mms

How to open APN settings:

- iPhone: Settings > Mobile Service > Mobile Data Network. Enter the APN under Mobile Data. (On many iPhones APN is managed by the carrier profile and cannot be edited; update carrier settings or reset network settings.)
- Android: Settings > Network & internet > SIM > Access Point Names > "+" (add new). Save, and select the new APN.

If you changed APN settings by mistake, use "Reset to default" in the APN menu.

## 7.5 5G coverage and settings

- 5G is available in many cities and expanding. Check the coverage map in the app or on the website by entering an address.
- Requirements: a 5G-compatible phone, a 5G-capable plan (all SemCache Mobile plans), and being in an area with 5G coverage.
- To enable 5G: iPhone: Settings > Mobile Service > Mobile Data Options > Voice & Data > 5G Auto (or 5G On). Android: Settings > Network & internet > SIM > Preferred network type > 5G/4G/3G/2G (auto).
- "5G Auto" saves battery by using 5G only when it improves performance. Choose "5G On" for maximum speed.
- If the phone shows 4G or LTE indoors, the 5G signal may be weak there. Try near a window.
- Some 5G bands may not be supported on phones from other regions.

## 7.6 Calls and SMS problems

**Cannot make or receive calls:**

1. Check for signal and Airplane mode.
2. Turn on VoLTE (HD Voice): iPhone: Settings > Mobile Service > Mobile Data Options > Enable LTE > Voice & Data. Android: Settings > Network > SIM > Enable VoLTE.
3. Check that Do Not Disturb, Call Forwarding, and Call Barring are off. Dial ##002# to cancel all call forwarding.
4. Make sure the number is not blocked, and that the account has no restrictions.
5. Restart the phone and test again.
   **Wi-Fi Calling:** Enable under Settings > Mobile Service > Wi-Fi Calling (iPhone) or Settings > Connections > Wi-Fi Calling (Android). Wi-Fi Calling is included free of charge and is useful in buildings with a weak signal.
   **SMS not sent or received:** check the message center number (+001 1000 0000), restart the phone, free up phone storage, and make sure the sender is not blocked.

## 7.7 Hotspot (tethering) not working

1. Check the plan includes hotspot data and the limit has not been reached.
2. Turn on mobile data on the phone.
3. Enable Personal Hotspot (iPhone) or Mobile hotspot (Android).
4. Check the APN type contains "dun" or use "default,supl,dun" for tethering on some Android phones.
5. Restart both devices and try again.

## 7.8 Network outages, restoration times, and incident tickets

- **Check outage status:** If many customers are affected, the app shows an outage banner under Network status with the affected area and an estimated restoration time.
- **Restoration times and alerts:** Typical restoration time is 4 to 24 hours depending on the cause. Planned maintenance is announced 48 hours in advance. Customers can subscribe to outage alerts under Settings > Notifications > Outage alerts (SMS alerts are sent for outages longer than 1 hour).
- **Compensation:** If an outage lasts more than 24 hours, an affected customer may request a proportional fee credit from a human agent. Outages shorter than 24 hours or caused by local power blackouts are not eligible for automatic credit.
- **Report an outage and track tickets:** Report a network outage or damaged cable in the app under Help > Report a problem or by calling support. Track open trouble tickets under Help > My requests; unresolved tickets are escalated automatically after 72 hours.

## 7.9 Security and spam

- Suspicious SMS or calls pretending to be SemCache Mobile: do not click links or share codes. SemCache Mobile never asks for passwords or OTP codes.
- Spam call blocking can be enabled under Settings > Services > Spam protection (free of charge).
- Report suspected fraud to a human agent.

## 7.10 Technical support FAQ

**Q: Why does my phone show LTE or 4G instead of 5G?**
A: Possibly there is no 5G coverage at your location, or the phone is set to 4G, or 5G Auto is limiting 5G use. See section 7.5.

**Q: Why is my internet slow in the evening?**
A: Networks are busiest from 18:00 to 22:00. Try moving to another place or using Wi-Fi.

**Q: Why did my phone lose service after I updated it?**
A: Software updates can reset carrier settings. Restart the phone, check APN settings, and reset network settings if needed.

**Q: Can I use my phone abroad without changing settings?**
A: In EU/EEA countries yes. For other countries, enable Data roaming and buy a Travel Pass.

## 7.11 Home fiber router and Wi-Fi troubleshooting

- **Factory reset:** Hold the physical Reset button on the back of the router for 10 seconds until all LEDs blink, then wait 2–3 minutes for reboot.
- **Change Wi-Fi name and password:** Connect to the router, open `http://192.168.1.1` in a browser, sign in with the admin password on the router label, and go to Wireless > Wi-Fi Settings. (Admin password is changed under System > Administration.)
- **PPPoE and bridge mode:** Fiber routers use the PPPoE username and password from your home internet contract. Bridge mode can be enabled under Network > WAN > Bridge Mode or by contacting support.
- **Red LOS or PON light:** A solid or blinking red LOS/PON indicator means a fiber signal loss (check that the fiber patch cord is seated cleanly and not bent; if it stays red, report an outage under Help > Report a problem).
- **Port forwarding:** Configured under Advanced > NAT / Port Forwarding by specifying the local device IP and TCP/UDP port range.

---

# 8. Account Management and Human Support

## 8.1 Creating an account and signing in

1. Open the My SemCache app or the website and select "Sign up".
2. Enter name, email, and password, then verify your email address.
3. Link your mobile number with an SMS verification code.
   Forgot your password: select "Forgot password" on the sign-in page, enter your email, and follow the reset link (valid for 30 minutes). If the email does not arrive, check spam folders or contact support.

## 8.2 Updating profile details

- Name, email, phone contact, address, and notification preferences can be edited in the app under Account > Profile.
- A change of legal name or account owner requires identity verification by a human agent and a photo of an ID document.
- Address changes are applied to the next bill.

## 8.3 Security settings

- Turn on two-step verification under Account > Security.
- Review signed-in devices and sign out from others.
- Set a SIM PIN and a customer service PIN to protect against SIM-swap fraud.

## 8.4 Changing number, porting, suspension, and cancellation

- **Keep your number (porting):** Request number porting during sign-up or in a shop; porting in or out takes 1–3 business days and requires no outstanding unpaid balance.
- **Temporary suspension (vacation freeze):** Postpaid numbers can be temporarily suspended for up to 6 months for €2 per month without losing the phone number.
- **Cancelling a contract:** Contact a human agent or submit a written cancellation notice 30 days in advance via the app, a shop (with an ID/passport), or registered mail. Settle any outstanding balance and return leased router equipment.
- **Early termination and final bill:** Leaving during a 12-month minimum commitment incurs an early termination fee equal to 50% of remaining monthly fees (shown under Plans > Contract details). The final invoice is prorated by day, and any unused prepaid balance is refunded within 30 days.
- **New phone number:** A new phone number can be assigned for a fee of €5.

## 8.5 Talking to a human agent

Customers can reach a human agent through the "Talk to a human agent" option in chat. Details:

- Availability: daily 07:00–23:00 CET.
- Before the transfer, the customer sees an estimated wait time and a summary of the conversation that will be shared with the agent.
- Outside opening hours, customers can leave a message and the callback will happen on the next business day, or they can continue with Telecom Assistant.
- Prepare these items to speed up resolution: the phone number, the issue description, and what troubleshooting steps have already been tried. The agent will verify identity with security questions or an in-app code.

## 8.6 Complaints

Customers can file a complaint through a human agent or in the app under Help > Complaints. SemCache Mobile responds within 5 business days and resolves complaints within 30 days. If the customer is not satisfied, they may contact the national telecom regulator or the consumer ombudsman.

## 8.7 Privacy

SemCache Mobile processes personal data in accordance with data protection law (GDPR). Customers can request a copy of their data, correction, or deletion under Account > Privacy, or by contacting a human agent.

---

# 9. Glossary

- **APN (Access Point Name):** settings that connect the phone to the mobile data network.
- **5G:** fifth-generation mobile network with higher speeds and lower latency than 4G.
- **4G / LTE:** fourth-generation mobile network.
- **eSIM:** a digital SIM profile installed on a device without a physical card.
- **EID:** the unique identifier of an eSIM-capable device, found by dialing *#06#.
- **ICCID:** the serial number printed on a physical SIM card.
- **IMEI:** the unique identifier of the phone hardware, found by dialing *#06#.
- **PIN / PUK:** codes used to protect and unlock a SIM card.
- **Roaming:** using a mobile network of a partner operator while abroad.
- **Postpaid:** a monthly plan billed after use.
- **Prepaid:** a plan paid in advance with a balance or package.
- **AutoPay:** automatic payment of the bill by saved card or bank account.
- **Hotspot / Tethering:** sharing the phone's mobile data with other devices.
- **VoLTE:** voice calls over the 4G/5G data network, for better call quality.
- **Wi-Fi Calling:** making calls over a Wi-Fi network.
- **Fair use policy:** a rule that prevents misuse of roaming and unlimited services.
- **USSD:** short codes starting with * and ending with #, such as *123#.
- **MMS:** multimedia message that carries pictures and videos.

---

# 10. Frequently Asked Questions (Quick Answers)

**Q: Which mobile plan is right for me?**
A: It depends on your data use, travel habits, and number of lines. Light users do well with Flex Prepaid (€10) or 5G Essential (€25). Heavy users and remote workers should choose 5G Unlimited (€40). Frequent travelers benefit from 5G Unlimited Premium (€55). Families save with a Family plan starting at €60 for 2 lines. Tell the assistant how much data you use and where you travel, and it can recommend a plan.

**Q: How much mobile data do I have left?**
A: Open the My SemCache app and check Home > Usage, dial *123#, or send DATA to 1234. The allowance resets on your billing cycle date (postpaid) or every 30 days from your package activation (prepaid).

**Q: How can I pay my bill?**
A: Pay by card, Apple Pay, or Google Pay in the app or web portal (Billing > Pay now), by bank transfer using the payment reference on the bill, in a shop, or set up AutoPay (Billing > AutoPay) to pay automatically and save €2 per month.

**Q: How does international roaming work?**
A: In EU/EEA countries (Zone 1) you use your plan's minutes, SMS, and roaming data with no extra charges, within your allowance. In Zone 2 (UK, Switzerland, Turkey, Western Balkans) and Zone 3 (rest of the world) buy a Travel Pass to avoid higher pay-as-you-go rates. Enable data roaming on your phone and set a spending cap in the app.

**Q: How do I activate my eSIM?**
A: Connect to Wi-Fi, then on iPhone go to Settings > Mobile Service > Add eSIM; on Android go to Settings > Connections > SIM manager > Add eSIM. Scan the QR code from the My SemCache app or email. Activation takes 2–5 minutes. Each QR code can be used only once.

**Q: My mobile internet isn't working. What should I do?**
A: Toggle Airplane mode for 15 seconds, check that mobile data is on, restart the phone, check your data allowance and bill status in the app, and check Network status for outages. If it is still not working, verify the APN settings (APN: internet.semcache.mobile), update the phone software, or reset network settings. If the problem remains, ask to speak to a human agent.

**Q: How can I speak to a person?**
A: Select "Talk to a human agent" in the chat. Agents are available daily from 07:00 to 23:00 CET, and your conversation summary is shared so you don't need to repeat yourself.

**Q: Is there a fee to change my plan?**
A: Changing between plans is free. Upgrades start immediately with pro-rated charges, and downgrades start from the next billing cycle. Early termination fees may apply if you leave a 12-month contract before it ends.

**Q: What should I do if my phone or SIM is lost or stolen?**
A: Block the SIM right away in the app (Account > SIM & eSIM > Block SIM) or contact a human agent. A replacement SIM or eSIM can be issued and you keep your phone number.

**Q: Can the assistant cancel my contract or refund a payment?**
A: No. Cancellations, ownership changes, number porting, and refunds require identity verification and are handled by a human agent. The assistant can connect you with one.

---

# 11. Short Answer Templates (for consistent responses)

## Template: plan recommendation

"Based on what you've told me, [plan name] (€[price] per month) would be a good fit: it includes [data], [calls and SMS], and [roaming allowance]. Would you like me to compare it with another plan or explain how to switch?"

## Template: data remaining

"You can check your remaining data in the My SemCache app under Home > Usage, by dialing *123#, or by sending DATA to 1234. Your allowance resets on [your billing cycle date / 30 days after package activation]."

## Template: escalation

"I'd be glad to connect you with a human agent. Agents are available daily from 07:00 to 23:00 CET, and I'll share a summary of our conversation so you don't need to repeat it. Would you like me to transfer you now?"

## Template: out of scope

"I'm not able to help with that in chat, but a human agent can. I can transfer you now, or I can help with another question about your mobile services."

## Template: unknown information

"I don't have confirmed information about that, and I don't want to give you a wrong answer. A human agent can check it for you. Would you like me to connect you?"
