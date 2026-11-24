---
title: Customer Support Knowledge Base
version: 1.0
language: en
coverage: mobile, home internet, billing, contracts, roaming, SIM/eSIM, service incidents
intended_use: retrieval-augmented generation (RAG)
source_basis: dataset_2000.jsonl
---

# Customer Support Knowledge Base

## 1. Purpose and service scope

This guide supports customer-service conversations for a telecommunications provider offering mobile plans, SIM and eSIM services, roaming, home internet, router equipment, billing, contracts, and network support.

It is written as operational knowledge rather than a list of question-and-answer pairs. Customers may describe the same issue in different words, use English or Ukrainian, misspell technical terms, mention a device or city, or combine several requests in one message. Classify the underlying need before responding.

### 1.1 Important limits of this knowledge base

The source dataset identifies the topics customers ask about, but it does **not** provide a verified live tariff catalogue, current prices, exact APN strings, country-by-country roaming rates, payment fees, policy thresholds, router-specific LED definitions, outage ETAs, compensation formulas, or the meanings of individual payment/MNP/VoWiFi error codes.

Therefore:

- Do not invent a price, allowance, discount, fee, deadline, eligibility rule, coverage statement, or service-restoration time.
- Treat plan details, account status, payment status, service availability, and network incidents as time-sensitive or account-specific.
- Use the current customer account, official tariff catalogue, billing ledger, roaming price list, device documentation, outage system, and approved internal procedures when available.
- If authoritative information is not available, explain what must be checked and route the case to the relevant support team.
- Never imply that an action has been completed unless the relevant system confirms it.

### 1.2 Customer communication principles

- Respond in the language used by the customer where possible. The dataset contains both English and Ukrainian requests.
- Acknowledge urgency or inconvenience without promising an outcome.
- Ask only for information needed to identify the account or diagnose the issue. Do not request passwords, full payment-card details, one-time passcodes, or a full PUK code in chat.
- Do not repeat sensitive personal or payment information unnecessarily.
- Distinguish mobile data from home Wi-Fi, voice calls from SMS, SIM replacement from eSIM transfer, and service cancellation from number porting.
- If a customer has already tried the app, do not simply repeat “try the app.” Offer another approved route or collect the result of the attempted step.
- Location can help identify a local incident, but a city mentioned in a message is not proof of the customer’s service address or current location.

---

## 2. Plans, pricing, allowances, and plan changes

### 2.1 Understanding a plan and its monthly price

Customers may ask about the monthly cost of a named plan, the price after a promotional period, or the difference between plans. Explain that the applicable amount can depend on the exact plan, subscription type, active promotion, billing cycle, and account-specific terms.

Before quoting a price:

1. Confirm the exact plan name and whether the customer means a mobile or home-internet service.
2. Check the current official catalogue and the customer's active account.
3. Separate the standard recurring price from a temporary promotional price.
4. Explain when a promotion ends and what price applies afterward only when the current offer terms confirm it.
5. Clarify whether the displayed amount includes all recurring components and whether one-time charges are separate.

Do not infer the price of one plan from another plan with a similar name. A typo or near-match in a plan name should be clarified rather than silently corrected.

### 2.2 Unlimited plans and fair-use terms

“Unlimited” may describe the availability of a service without necessarily meaning that every use case is unrestricted. Customers may ask about speed management, fair-use conditions, tethering or hotspot use, and roaming.

Check the specific plan's current terms for:

- Any fair-use policy and the circumstances in which it applies.
- Whether speed management can occur and how it is described in the plan terms.
- Whether hotspot/tethering is included and whether separate conditions apply.
- Whether domestic use and roaming use have different allowances or restrictions.

Do not treat hotspot limits, roaming allowances, or fair-use rules as interchangeable. A domestic unlimited allowance should not be represented as an unlimited roaming allowance.

### 2.3 Finding a plan with a particular data allowance

Customers may request an exact data amount, sometimes together with unlimited access to selected social-network services. Search the current catalogue for the precise allowance and included features.

If no exact match is listed, explain the closest available alternatives only after checking the current catalogue. Do not claim that a plan exists simply because the requested data amount sounds plausible. Clarify whether “unlimited social networks” means zero-rated access to named applications and whether any exclusions apply under the offer terms.

### 2.4 Student, youth, and other discounts

A customer identifying as a student may ask about discounts on a mobile plan, eSIM line, home internet, data add-on, router rental, family plan, or youth plan. These are different products and should be checked separately.

The dataset does not establish a universal student discount. Verify:

- Whether a current discount exists for the specific product.
- Eligibility requirements and acceptable proof of status.
- Whether the offer is limited to new customers, selected plans, or a particular billing arrangement.
- Whether it can be combined with other promotions.
- Its validity period and what happens when eligibility expires.

Do not promise a discount based only on student status or assume that a discount on one service applies to another.

### 2.5 Buying extra data

When a customer's included data is exhausted, they may need a one-time data add-on or a plan change. First identify which allowance has run out: mobile data, a home 5G router allowance, or a roaming pack.

Explain how to locate eligible add-ons through the authenticated account/app or approved customer channel. Before purchase, confirm the add-on's data amount, price, validity period, eligible service, and whether it renews automatically. Do not invent a bundle size or price. A home-router add-on is not necessarily the same as a mobile-phone add-on.

### 2.6 Sharing data with family members

Customers may ask to share data with family members, add another line, or include a child's number. Confirm whether the current plan supports multi-line or family sharing and identify the line types that can participate.

Clarify:

- Whether the additional number must be on the same account or an eligible plan.
- Who controls the shared allowance and can view usage.
- Whether the feature has limits, charges, or account-owner approval requirements.
- Whether parental controls are a separate feature from data sharing.

A request to share data with employees or other business users is not automatically a family-sharing request. Route business-line and corporate-account cases through the business support process.

### 2.7 Streaming and entertainment benefits

Customers may ask whether a plan includes a streaming or music service, such as Netflix, Spotify, Apple Music, YouTube Premium, Disney+, HBO Max, Megogo, or another provider, and how long the benefit lasts.

Benefits can vary by plan, campaign, activation date, and eligibility. Check the customer's exact plan and the current partner-benefit terms. Confirm whether the service is included, whether the customer must activate it separately, the benefit period, what happens when the free period ends, and whether the partner may require a separate account.

Do not infer that a named service is included because another entertainment service is offered on a different plan. Do not describe a promotional benefit as permanently free unless the terms explicitly say so.

### 2.8 Upgrading, downgrading, and changing plans

A plan change may involve selecting a new plan, reviewing its terms, confirming the request, and waiting for the effective date shown by the account system.

For an upgrade or downgrade:

1. Confirm the current plan and the desired plan.
2. Check eligibility, availability, and any account restrictions.
3. Compare the new recurring price, included allowances, promotion terms, and features.
4. Explain the effective date and whether the current cycle is affected, using the account's displayed information.
5. Confirm how unused allowances are treated only if the applicable terms specify this.

A customer paying for a handset in instalments may still have a separate device-financing obligation. Do not assume that changing the service plan changes or cancels the instalment agreement.

### 2.9 Keeping an old price after moving to a new plan

A customer moving from a legacy, family, business, youth, senior, or data-specific plan to a new plan may ask to retain the old price. Explain that a plan change can move the customer to the new plan's current pricing and may end legacy or promotional terms.

Check the customer's account and the written offer terms. Never promise price protection unless an explicit retention or migration offer confirms it. Clearly distinguish a one-time migration offer from a permanent price guarantee.

### 2.10 Plan questions that need clarification

Do not confuse:

- An upgrade with a downgrade.
- A monthly plan price with the price after a promotion.
- A data add-on with a new tariff.
- Domestic fair use with roaming fair use.
- Family data sharing with corporate employee sharing.
- A plan's entertainment benefit with a separate paid subscription.
- The date a plan change is requested with the date it becomes effective.

---

## 3. Billing, payments, invoices, and refunds

### 3.1 Understanding an unfamiliar charge

Customers may notice an unfamiliar recurring charge, a one-time connection or activation fee, a roaming charge, or a deduction from prepaid balance. Begin by identifying the transaction rather than assuming it is an error.

Review the itemized bill or account transaction history and compare:

- Charge description and transaction date.
- Service or number associated with the charge.
- Whether it is recurring, one-time, usage-based, or third-party.
- Any recent plan change, add-on purchase, roaming usage, premium service, or account modification.
- Whether the amount is pending, posted, reversed, or duplicated.

If the description is unclear, explain the available line-item detail and open a billing investigation. A customer may ask for a breakdown of a one-time fee they say was not disclosed; capture the charge date, amount, service, and any relevant order or contract reference. Do not assume the fee is valid or invalid before reviewing the account and applicable terms.

### 3.2 Duplicate charges and refund requests

A customer may report two subscription charges in one month, two payments for the same invoice, or an accidental duplicate top-up. These situations are not identical.

Check whether both entries are completed transactions, whether one is pending, and whether the entries relate to the same service period. For duplicate payments, identify the payment references and the account to which each payment was applied.

Explain the applicable review and refund process based on the billing system. Do not promise an immediate refund or a fixed processing time unless the current policy confirms it. If the customer disputes a premium SMS or subscription they say they did not authorize, treat it as a separate third-party-service dispute and follow the approved investigation and blocking procedure.

### 3.3 Payment methods, fees, and failed payments

Customers may ask whether a bill can be paid using a bank, card wallet, payment app, or online payment provider, and whether a fee applies. Supported methods and commissions can change.

Before confirming a method:

- Check the currently approved payment channels.
- Confirm whether the method supports the customer's account or invoice type.
- Verify any fee shown by the provider and any fee disclosed by the payment processor.
- Explain how the customer can confirm that payment was credited.

Do not assume that support for one wallet or bank implies support for another. Do not guarantee that a third-party payment service is commission-free without current confirmation.

### 3.4 Payment errors in the app

A payment may fail with an alphanumeric error message. Record the exact code as displayed, the time of the attempt, the payment method, and whether the customer's bank shows a pending or completed transaction.

General triage:

1. Check whether the invoice is still unpaid in the account.
2. Check whether the payment provider shows a pending, declined, or completed transaction.
3. Avoid asking the customer to repeat a payment while the first attempt may still be processing.
4. If the account and payment provider disagree, refer the case to billing/payment operations with the transaction reference.
5. If the code is not documented in the approved error-code catalogue, do not guess what it means.

The dataset includes examples of payment error strings, but does not define their meanings. An error code must be looked up in the current internal code reference.

### 3.5 Automatic payments

Customers may want to enable, disable, or update the payment card used for automatic billing. Confirm whether the request concerns a mobile service, home internet, or a corporate account.

Use the authenticated billing settings or the approved support workflow. Explain how the customer can review the saved payment method and the next scheduled debit. For a card change, use the approved secure payment flow; never ask the customer to send full card details in a chat.

The dataset does not establish whether multiple backup cards are supported. Check the current billing feature set before promising a secondary payment method. A request to turn autopay off is different from a request to change its card.

### 3.6 Invoices, statements, and tax documents

Customers may need a monthly invoice, a VAT/tax invoice for a company, or an older itemized usage record. Clarify the document type, billing period, account holder, and whether it is a personal or business account.

Explain where authenticated customers can access available invoices and statements in the account portal or app. For company tax documents, verify the legal entity details and the document requirements. If the company code or other registered business information is wrong, route a correction request through the approved business-billing process.

An invoice is not the same as an itemized call list. Historical records may have different retention and retrieval rules; do not promise that records from an old period are still available unless the records system confirms it.

### 3.7 Due dates and late payments

The payment deadline depends on the service and billing arrangement. A postpaid invoice due date should not be applied to a prepaid account, where service use and balance top-ups work differently.

Check the invoice or account for the due date, accepted payment methods, and any consequences of late payment. Explain late fees, restrictions, or suspension only when the current contract and policy support them. Do not invent a universal monthly due date or penalty.

---

## 4. Contracts, cancellation, number portability, and suspension

### 4.1 Cancelling a mobile or home-internet contract

First establish which service the customer wants to end: mobile postpaid, prepaid service, home internet, or a bundled service. Cancellation requirements can differ by product and account ownership.

A typical case review includes:

- Verifying the account holder and the service to be terminated.
- Checking the minimum commitment period and contract terms.
- Identifying outstanding invoices, device instalments, equipment rental, or other obligations.
- Explaining the approved submission channel and required confirmation.
- Explaining when service ends and whether a final bill will be issued.

Do not say that a contract is cancelled until the cancellation request is accepted and the system confirms the effective date.

### 4.2 Documents and authorized representatives

The documents needed depend on the account type, ownership, and reason for termination. A personal customer, company account, estate representative, or person acting under authorization may have different requirements.

For a request made by someone other than the account holder, verify the approved authority or representation documents. For a deceased account holder, use the designated bereavement/estate process and request only the documentation required by that process. Do not disclose account information or transfer ownership based solely on a family relationship.

The dataset does not provide a definitive document checklist. Refer to the current contract-termination procedure for the exact list.

### 4.3 Early termination and device instalments

If a customer ends a contract during a minimum term, charges may depend on the agreement and applicable early-termination terms. A customer who is still paying for a handset may have a separate remaining device balance.

Review the signed agreement and account ledger before quoting any amount. Do not assume that moving abroad automatically waives a fee, or that a device instalment balance disappears when service is cancelled. Present service termination charges and device-financing obligations separately.

### 4.4 A sales promise that is missing from the contract

A customer may say that a kiosk or sales representative promised several free months, but the benefit is absent from the signed agreement. Treat this as a sales-disclosure or contract-dispute case, not as an ordinary cancellation request.

Collect the approximate sales date, location/channel, product, promised benefit, available receipt or promotional material, and the relevant contract reference. Refer it for review against the offer that was active at the time. Do not promise penalty-free cancellation or assert that the verbal promise is binding before the review is complete.

### 4.5 Transferring contract ownership

A customer may want to transfer a contract registered to a spouse, parent, adult child, former partner, former employee, or another person. This is an ownership-change request and requires identity and authorization checks.

The process may depend on whether the current account holder is available, whether the account is personal or corporate, and whether special circumstances apply. Do not treat possession of the SIM or payment of bills as proof of ownership. Follow the current ownership-transfer process and protect the account holder's information.

### 4.6 Keeping a number when moving to another operator

Number portability allows an eligible customer to request transfer of a number to another provider. It is distinct from cancelling a service and receiving a new number.

Explain the current portability process and eligibility checks. The receiving provider may coordinate parts of the request, while the existing provider may need to validate account details and resolve disqualifying conditions. Do not tell a customer to cancel the number first if they intend to port it; premature cancellation may affect the transfer.

If a port-out request is rejected, record the exact rejection reason or code and check it in the current MNP (mobile number portability) reference. The dataset contains sample rejection codes but does not define them. Never infer a rejection reason from the code alone.

A request to port a prepaid number is not automatically governed by the same workflow as a postpaid contract. Confirm the account type.

### 4.7 Temporary suspension versus permanent closure

A customer who will be away may want to pause service temporarily. Confirm whether the request is for a temporary suspension, a permanent disconnection, or a change to a lower-cost plan.

Check the product's suspension eligibility, duration, charges, reactivation requirements, and effects on bundled services. A request to pause several employee numbers should be handled as a corporate-account request. Do not treat “I am away” as an instruction to permanently close a number.

### 4.8 Final bill after cancellation or porting

A final statement may include charges accrued through the service end date, outstanding recurring amounts, usage, equipment or rental adjustments, and any applicable contract charges. The exact composition depends on the account and contract.

Explain that the final bill should be checked after the termination or porting event has been processed. If rented equipment is returned, confirm receipt and condition in the equipment system before explaining any related adjustment. Do not estimate a final balance without account data.

---

## 5. SIM cards, eSIM, activation, replacement, and account security

### 5.1 Activating a newly purchased physical SIM

Activation depends on the SIM type, account registration, and whether the SIM is intended for voice and data or data-only equipment. Guide the customer through the current activation flow and identity checks.

Clarify whether the customer is:

- Activating a new number.
- Replacing an existing SIM while keeping the number.
- Activating a data-only SIM for a router.
- Registering as a visitor or foreign customer using an accepted identity document.

Do not assume that the same activation process applies to tourists, corporate SIMs, and consumer voice SIMs. Use the current registration requirements.

### 5.2 Replacing a damaged physical SIM

A damaged SIM replacement is intended to restore service while retaining the customer's number, subject to account verification and the replacement policy.

Verify the account holder, affected number, and whether the SIM is personal or company-registered. Explain the available replacement channels and delivery or collection options only after checking what is currently supported. Do not promise courier delivery or a particular delivery time unless the service is confirmed for the customer's location.

A request for a replacement SIM registered to a company must be authorized by the business account's designated representative.

### 5.3 Choosing a specific or memorable number

Customers may ask for a number ending in a particular sequence. Explain that number selection depends on the available-number inventory and current number-selection rules. Do not guarantee a requested suffix or claim that a particular number is available without checking inventory.

### 5.4 Activating an eSIM

An eSIM is a digital SIM profile installed on a compatible device. Before guiding activation, confirm that the device supports eSIM and that the customer's plan and account are eligible.

A safe high-level activation flow is:

1. Confirm the device and operating-system compatibility using the manufacturer's current guidance.
2. Obtain the eSIM activation details through the provider's authenticated channel.
3. Ensure the device has a suitable internet connection for profile download.
4. Follow the device's cellular/mobile-plan installation flow.
5. Complete any provider confirmation or identity step.
6. Check that the correct line is enabled for calls, messages, and mobile data.

Activation codes and QR codes are sensitive and may be single-use. Do not ask the customer to post them in a public channel or share them with another person. Do not claim that a profile is active until the account and device status confirm it.

### 5.5 Moving an eSIM to a new phone

An eSIM transfer is not always the same as installing a second eSIM or converting a physical SIM. Confirm whether the customer still has access to the old phone and whether the old device is lost, damaged, or being replaced.

Use the provider's current eSIM reissue/transfer procedure. The old profile may need to be deactivated before a replacement profile can be used. If the old phone is lost, secure the number and account first; do not rely on access to the old device.

### 5.6 eSIM installation errors

A customer may report a message such as an unreachable SM-DP+ server, an ineligible EID, an expired or invalid code, an activation limit, a required confirmation code, or a generic profile-download failure.

Capture the exact message, device model, operating-system version, time of attempt, and whether the QR code/profile has already been used. Check device compatibility, internet connectivity, profile status, and the current eSIM provisioning record. Avoid repeated installation attempts if the activation code may be single-use.

The dataset lists example error messages but does not define their technical causes. Use the current eSIM troubleshooting reference or provisioning team rather than assigning a cause from the wording alone.

### 5.7 Additional eSIM lines and connected devices

A customer may ask for a second eSIM line for a tablet, watch, laptop, car, tracker, or another connected device. Compatibility and eligibility differ by device and service type.

Check whether the provider supports the device category, whether the plan allows an additional line, and whether the device requires a companion-number or shared-number feature. Do not assume that all eSIM-capable devices can use the same service.

### 5.8 Lost or stolen phone: secure the SIM and account

A lost or stolen phone is a security-sensitive case. Prioritize protecting the mobile number and customer accounts.

Recommended handling:

- Direct the customer to the provider's approved lost-device channel to request immediate SIM/line blocking.
- Verify identity using the approved secure process.
- Explain how to request a replacement SIM or eSIM after the account is secured.
- Encourage the customer to use the device manufacturer's official lost-device tools and contact relevant financial institutions if payment or banking apps may be exposed.
- If the customer reports unauthorized SIM replacement, treat it as suspected SIM-swap fraud and escalate urgently.

Blocking a SIM is not the same as remotely locking or erasing a handset by IMEI. Device blocking and SIM blocking are separate processes with separate eligibility and verification requirements.

### 5.9 Suspected unauthorized SIM swap

If a customer says their SIM was replaced without permission, or they were unexpectedly logged out of email, messaging, government, or banking applications, treat the case as a potential account-takeover incident.

Priorities:

1. Secure or suspend the affected mobile line through the approved fraud process.
2. Verify the customer's identity through a secure channel.
3. Escalate to the fraud/security team with the time of the suspected change and relevant account events.
4. Advise the customer to secure important online accounts through their official recovery channels, beginning with email and financial accounts where appropriate.
5. Do not request passwords, one-time codes, recovery codes, or banking credentials.
6. Preserve relevant case references and avoid disclosing information about any other account holder.

Do not treat this as a routine SIM replacement or merely an app-login problem.

### 5.10 PUK-locked SIMs

A SIM may request a PUK after repeated incorrect PIN entries. The PUK is a security credential associated with the SIM and must be retrieved only through the provider's approved authenticated process or original SIM documentation where applicable.

Warn customers not to guess the code or continue entering random values. Repeated incorrect PUK attempts can permanently disable the SIM profile and require replacement. If the allowed attempts have been exhausted, follow the SIM replacement/escalation procedure. Never ask a customer to send the full PUK in chat.

---

## 6. Mobile network, data, messaging, and calling support

### 6.1 Slow mobile internet

When mobile data is slow, first determine whether the issue affects one device, one location, a particular time, or all locations.

Collect:

- Device model and operating-system version.
- Approximate location and whether the customer is indoors, outdoors, or moving.
- Whether the issue affects all applications or only one service.
- Whether the device shows 4G/5G and whether signal strength changes.
- Whether the customer's data allowance or plan conditions may be relevant.
- Whether other devices on the same network are affected.

Basic checks may include toggling airplane mode, restarting the device, confirming mobile data is enabled, checking the selected network mode, and testing in another location. Use manufacturer-specific instructions where menu names differ.

If performance is poor only inside a building, distinguish indoor coverage from a general network outage. If it occurs repeatedly at a particular time, record the time window and affected service and investigate possible congestion or a recurring incident. Do not promise a speed or coverage level that is not documented for the customer's plan and location.

Slow mobile data is not the same issue as slow home Wi-Fi. Route home-router cases to the home-internet troubleshooting workflow.

### 6.2 Mobile APN settings

APN (Access Point Name) settings allow a device to connect to the provider's mobile data service. Customers may need settings after changing devices, resetting network settings, or inserting a new SIM.

Provide only the current approved APN profile for the correct service and device category. Confirm whether the request concerns:

- Mobile internet on a handset.
- MMS configuration.
- A home 5G router.
- A data-only SIM or another specialized device.

These configurations are not necessarily interchangeable. The dataset does not contain the actual APN values, so do not invent an APN name, username, password, authentication type, proxy, or protocol. Direct the customer to the current device- and service-specific configuration reference or technical support.

### 6.3 A device cannot connect to 5G while other devices can

If other phones connect to 5G but one handset does not, investigate device-specific compatibility and configuration before assuming a network-wide problem.

Check:

- Whether the exact device model and regional variant support the provider's 5G bands.
- Whether the software is current.
- Whether 5G is enabled in the device's preferred network settings.
- Whether the SIM, plan, and account are provisioned for 5G.
- Whether the customer is in a confirmed 5G coverage area.
- Whether dual-SIM settings or the selected data line affect connectivity.

A device name alone is not enough to confirm compatibility. Use the manufacturer's specification for the exact model/region and the provider's current compatibility list.

### 6.4 SMS verification codes not arriving

If verification messages from an online service are not received, establish whether ordinary person-to-person SMS works and whether the problem affects one sender or many senders.

Check basic signal and messaging status, blocked/spam message settings, device storage or filtering behavior, and whether the number can receive other SMS. If only international or short-code verification messages are affected, capture the service name, sender ID if visible, country, and approximate time. Escalate through the messaging team if routing or sender restrictions may be involved.

Do not confuse receiving SMS with sending SMS. If the customer cannot send messages, use the outgoing-SMS troubleshooting path.

### 6.5 VoLTE and voice-call problems

VoLTE allows compatible devices to place voice calls over the LTE network. If a customer cannot make or receive calls, first determine whether the issue is call setup, incoming calls, outgoing calls, or both.

Check device and regional compatibility, software version, VoLTE setting, SIM/account provisioning, network mode, and whether dual-SIM configuration affects the selected voice line. Use the manufacturer's instructions for enabling the feature.

An older device without VoLTE may be affected by network technology changes, but the dataset does not establish a specific 3G shutdown date or device compatibility outcome. Verify the current network migration notice and compatibility list before advising whether a particular handset will continue to make calls.

### 6.6 VoWiFi errors

VoWiFi (Wi-Fi Calling) enables supported devices to place calls using a Wi-Fi connection when the feature is available and provisioned. A customer may report SIP, IMS, E911, or a generic VoWiFi error code.

Record the exact code, device model, operating-system version, Wi-Fi network type, approximate location, and whether ordinary cellular calls work. Check feature eligibility, account provisioning, device software, Wi-Fi connectivity, and any emergency-address or regional requirements that apply.

The dataset contains example codes such as SIP and IMS values but does not map them to causes or remedies. Do not invent a code explanation. Consult the current VoWiFi error reference or escalate to the voice-network team.

---

## 7. Home internet, routers, Wi-Fi, and local connectivity

### 7.1 Changing the Wi-Fi password

A Wi-Fi password controls access to the wireless network. It is different from the router's administrator password, which controls access to router settings.

A general process is:

1. Connect to the customer's router using an authorized device.
2. Open the router's management interface or the provider's supported app.
3. Authenticate using the router's administrator credentials.
4. Locate the wireless/Wi-Fi security settings.
5. Update the network password and save the change.
6. Reconnect devices using the new password.

Menu names and access methods vary by router model and firmware. Use the model-specific guide. Do not ask the customer to share the administrator password in chat. Changing the Wi-Fi password may disconnect currently connected devices.

### 7.2 Router administrator password

The administrator password protects the router configuration interface; it is not the Wi-Fi password. Changing one does not necessarily change the other.

Use the model-specific instructions and the approved credential recovery process. Do not recommend using an unknown default credential or sharing administrative access with an untrusted person.

### 7.3 Factory reset

A factory reset restores a router to its default configuration. It may erase Wi-Fi names and passwords, internet access settings, custom configuration, and provider-specific settings.

Before recommending a reset:

- Confirm the router model and the reason for the reset.
- Explain that the customer may lose custom settings and need to reconfigure the connection.
- Confirm that the customer has any required provider configuration or can obtain it through the approved channel.
- Prefer a normal restart or targeted troubleshooting when a full reset is unnecessary.

Use the physical reset control and timing specified by the manufacturer's model-specific instructions. Do not give a universal press duration for all routers. If the router uses provider-managed credentials or fiber/PPPoE configuration, involve technical support before resetting.

### 7.4 Guest Wi-Fi

A guest network can provide visitors with internet access without giving them the primary Wi-Fi password. Availability depends on router model and firmware.

If supported, configure it through the router's approved interface, set a separate strong password, and review any guest isolation or access-duration options. Do not assume every router supports guest networking.

### 7.5 Router lights and warning indicators

Customers may report a red or flashing light labelled LOS, PON, DSL, WAN, Internet, Power, Alarm, or a LAN port. Indicator meaning varies by manufacturer, model, connection type, and light behavior.

Ask for the router model, exact label, color, whether the light is steady or flashing, and whether service is working. Consult the model-specific LED guide. Do not assign a universal meaning to a red light.

For fiber equipment, LOS/PON indicators may relate to optical link status; DSL indicators relate to a DSL line; WAN/Internet indicators may relate to the upstream connection; Power and LAN indicators have separate meanings. These are broad categories, not a diagnosis. If a fiber cable appears damaged or disconnected, advise the customer not to look into the optical connector or handle exposed fiber and route the case to technical support.

### 7.6 Home internet is slow

For slow home internet, distinguish Wi-Fi performance from the broadband connection itself.

Ask whether the issue affects all devices, whether a device connected by Ethernet is also slow, whether the router lights indicate a fault, and when the issue occurs. A speed test near the router and, where possible, over Ethernet can help separate Wi-Fi limitations from an upstream line issue.

Basic checks include restarting the router using the approved process, checking cable connections without disturbing fiber connectors, moving closer to the router, and testing another device. If only one room or one device is affected, investigate local Wi-Fi conditions before treating it as a network outage.

### 7.7 Bridge mode, PPPoE, and port forwarding

Bridge mode, PPPoE credentials, and port forwarding are advanced router configuration topics. They are not the same as changing the Wi-Fi password or resetting the router.

- **Bridge mode** changes how routing functions are handled and may affect the provider's managed configuration.
- **PPPoE** uses connection credentials on supported access types. Credentials must be supplied through an authenticated provider channel.
- **Port forwarding** directs incoming network traffic to a device or service inside the customer's network. The exact procedure depends on router model, network design, and whether the service uses a public/reachable IP address.

Use the provider's model-specific instructions and security guidance. Confirm that the customer is authorized to administer the router. Do not invent menu paths, credentials, port values, or guarantee that port forwarding will work on every access technology. If the customer is configuring a server, camera, NAS, VPN, game, or home-automation device, collect the router model and service context and route advanced cases appropriately.

---

## 8. Roaming, international use, and travel

### 8.1 Using data in another country

Roaming availability and charges depend on the destination, partner network, plan, roaming agreement, and any active travel pack. “Europe” or “nearby country” is not precise enough to establish the applicable price or allowance.

Before travel, confirm:

- The exact destination country.
- Whether the plan includes roaming there.
- Whether a roaming pack is available and active.
- The applicable data, call, and SMS rates.
- Any fair-use limit, validity period, or automatic-renewal condition.
- Whether the device's data-roaming setting must be enabled.

Do not assume that EU/EEA treatment applies to every European country. Switzerland, Turkey, and other destinations may have different terms. The dataset does not provide a current country list or rates; use the live roaming price list.

### 8.2 Roaming data packs

Customers may want to activate a roaming pack before departure. Confirm the destination, travel dates, pack eligibility, validity period, included data, price, and activation timing.

Explain the current activation process through the authenticated app/account or approved support channel. If activation is scheduled or takes effect only under certain conditions, state those conditions from the current product terms. A corporate SIM may require an account administrator or business support.

### 8.3 Checking remaining roaming data

Roaming allowance is separate from the customer's domestic data balance. Direct customers to the roaming usage view in the account/app or another approved usage-check channel.

Clarify whether the customer wants to check domestic data, roaming data, or the validity of a roaming pack. Do not present the domestic balance as the remaining roaming allowance.

### 8.4 A roaming pack stops working earlier than expected

If a pack was expected to last several days but stopped working sooner, check the remaining allowance, validity start and end times, destination eligibility, partner network, and whether the pack was applied to the correct number.

Possible areas to investigate include data exhaustion, expiry, use in a country not covered by the pack, account provisioning, device settings, or a partner-network issue. These are diagnostic possibilities, not conclusions. Check the usage ledger and pack status before explaining why service stopped.

### 8.5 No mobile network abroad

If a customer arrives abroad and has no service, confirm the country, local network, device model, SIM/eSIM status, roaming eligibility, and whether the phone can see available networks.

General checks may include restarting the device, confirming that the line is enabled, checking network selection, and verifying roaming settings. If manual network selection is supported, use the provider's current partner-network guidance. If service is registered but data does not work, use the separate mobile-data troubleshooting path.

A customer near a national border may connect to a foreign network while still at home. Explain how to review automatic network selection and data-roaming settings, and advise checking the applicable charges before using the foreign network.

### 8.6 Roaming charges for calls and SMS

Data, outgoing calls, incoming calls, calls to the home country, and SMS may have different roaming rates. Confirm the country where the customer is physically registered on a network, the destination of the call, and the service type.

Do not use the roaming data price to answer a call or SMS pricing question. Use the current country-specific rate table and explain any applicable connection or billing increments only when confirmed.

### 8.7 Setting a roaming spending limit or disabling roaming

Customers may want to limit unexpected charges or completely disable data roaming. Distinguish between:

- Turning off data roaming on the handset.
- Blocking roaming at the account/network level.
- Setting a spending cap or notification threshold.
- Disabling all roaming services, including voice and SMS.

These controls have different effects. Explain only the options currently supported by the provider and the device. A handset setting may not block all roaming-related charges, such as voice or SMS. A cruise or airline environment may use specialized networks and may not behave like ordinary terrestrial roaming.

### 8.8 Cruise ships and in-flight connectivity

Ships and aircraft may use onboard satellite or specialized mobile networks. These services can have separate availability and pricing from ordinary land-based roaming, and the carrier may not control the onboard network's charges.

Before travel, customers should check the airline or cruise operator's connectivity information and the provider's current roaming terms. Do not assume that a specific airline, aircraft, ship, sea, or route is covered by a standard roaming pack. Recommend disabling automatic data roaming or using airplane mode when the customer does not intend to connect, while noting that exact device behavior and onboard Wi-Fi are separate matters.

---

## 9. Outages, incident reporting, restoration, and compensation

### 9.1 Checking whether there is an outage

A customer may ask whether mobile or home-internet service is currently affected in their area. This requires live incident information; a static knowledge base cannot confirm a current outage.

Collect the service type, approximate service location, affected number or connection reference, and when the problem began. Check the live outage/status system and distinguish a confirmed incident from an individual line or equipment fault.

A city name alone may be too broad. Ask for the neighborhood or service address through an approved secure channel when needed. Do not claim that an outage exists or does not exist without checking current status.

### 9.2 Cause of an outage

Customers may ask whether an incident is caused by fiber damage, a power interruption, equipment failure, or another issue. Share only the cause published in the approved incident record.

If the cause is not confirmed, say that the technical team is investigating rather than guessing. Do not infer the cause from the city, weather, or a red router light.

### 9.3 Restoration estimates

Restoration times can change as field teams investigate and repair incidents. Provide an ETA only when the live incident record includes an approved customer-facing estimate. Explain that an estimate is not a guarantee and may be revised.

For damage to a fiber cable or a power-related incident, use the incident-specific updates. Do not promise a restoration time based on a previous outage or a general repair duration.

### 9.4 Reporting a network problem

A customer can report a local mobile, broadband, or recurring connectivity issue through the approved support channel. Capture:

- Affected service and account/line reference.
- Location or service address.
- Start time and frequency.
- Whether the issue is continuous or intermittent.
- Devices and services affected.
- Troubleshooting already completed.
- Relevant router indicator or error message.

A report about a fallen tower, exposed cable, damaged infrastructure, or another physical safety hazard must be treated as a safety incident and routed through the designated urgent channel. Do not ask the customer to approach, touch, or inspect damaged infrastructure.

### 9.5 Tracking and escalating an incident ticket

For a customer asking about an existing report, locate the case using its reference and verify the current status, assigned team, last update, and next action. Do not invent a technician visit date.

If a ticket has remained unresolved or the customer reports repeated evening drops, record the history and escalate according to the service-level and incident-management process. A recurring evening issue may be a performance investigation rather than a confirmed area-wide outage.

### 9.6 Outage notifications

Customers may want to subscribe to, or stop receiving, service-incident notifications. Distinguish operational outage alerts from marketing or promotional SMS.

Use the notification preferences available for the account and explain which alert categories the preference controls. Do not treat a request to stop marketing messages as a request to disable critical service notifications, or vice versa.

### 9.7 Compensation, credits, and SLA claims

Customers may ask for compensation after a period without service. Eligibility may differ between consumer service and a business agreement with a service-level agreement (SLA).

Review:

- The affected service and account type.
- The confirmed incident and service-impact period.
- The applicable consumer terms or business SLA.
- Any exclusions, reporting requirements, or claim deadlines.
- Whether a credit is automatic or requires a request.

Do not promise a credit based only on the number of hours reported by the customer. The dataset does not specify a 24-hour threshold, a compensation formula, or a universal SLA credit rule. Use the current policy and the verified incident timeline.

---

## 10. Distinguishing similar requests

These distinctions are important for accurate retrieval and routing:

| Customer wording or situation                    | Correct topic                       | Do not confuse it with        |
| ------------------------------------------------ | ----------------------------------- | ----------------------------- |
| “My mobile data is slow”                         | Mobile network quality              | Home Wi-Fi performance        |
| “My home Wi-Fi is slow”                          | Router/Wi-Fi and broadband          | Mobile data allowance         |
| “I cannot receive verification codes”            | Incoming SMS delivery               | Outgoing SMS failure          |
| “I cannot send SMS”                              | Outgoing messaging                  | Verification-code delivery    |
| “My phone cannot make calls”                     | Voice/VoLTE troubleshooting         | Mobile data or APN            |
| “VoWiFi shows an error”                          | Wi-Fi Calling diagnostics           | Ordinary VoLTE setup          |
| “Change my Wi-Fi password”                       | Wireless network credentials        | Router administrator password |
| “Reset my router”                                | Factory configuration reset         | Simple router restart         |
| “Replace my damaged SIM”                         | Physical SIM replacement            | eSIM transfer                 |
| “Move my eSIM to a new phone”                    | eSIM transfer/reissue               | Adding a second eSIM line     |
| “My SIM was changed without permission”          | Fraud/security incident             | Routine SIM replacement       |
| “My SIM asks for PUK”                            | SIM security/unlock                 | Phone screen passcode         |
| “I want to keep my number with another provider” | Number portability                  | Ordinary cancellation         |
| “Pause my service while away”                    | Temporary suspension                | Permanent closure             |
| “My roaming data pack stopped”                   | Roaming pack status/usage           | Domestic data balance         |
| “How much are calls abroad?”                     | Roaming voice rates                 | Roaming data price            |
| “Will my phone work on a cruise/flight?”         | Maritime/in-flight connectivity     | Standard land roaming         |
| “I was charged twice”                            | Duplicate transaction investigation | Unfamiliar single charge      |
| “I need a VAT invoice”                           | Tax/business invoice                | Itemized call record          |
| “The app shows a payment code”                   | Payment error lookup                | MNP or VoWiFi error           |
| “A red light is on”                              | Model-specific router diagnostics   | Universal hardware diagnosis  |

---

## 11. Escalation and handoff guidance

Escalate when the issue requires live account data, a specialist system, security handling, or a policy decision not contained in this guide.

| Area                                                  | Escalate to                        | Include in the handoff                                                         |
| ----------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| Plan price, discount, promotion, or eligibility       | Tariff/retention support           | Exact plan, account type, requested offer, promotion context                   |
| Unrecognized or duplicate charge, refund, tax invoice | Billing operations                 | Transaction date, amount, invoice reference, payment status                    |
| Payment error code                                    | Payment operations                 | Exact code, method, timestamp, transaction reference                           |
| Contract termination or ownership transfer            | Contract administration            | Service type, account holder verification status, reason, contract reference   |
| Number portability rejection                          | MNP/number portability team        | Exact rejection code, request reference, account type                          |
| SIM swap or lost/stolen device                        | Fraud/security team                | Time reported, affected number, verification status, actions already taken     |
| eSIM activation/transfer error                        | eSIM provisioning                  | Device model, exact error, EID status where securely available, profile status |
| APN, 5G, VoLTE, VoWiFi, SMS issue                     | Mobile technical support           | Device, location, service affected, exact error, tests performed               |
| Router lights, PPPoE, bridge mode, port forwarding    | Home technical support             | Router model, access type, light label/state, configuration context            |
| Live outage or restoration estimate                   | Network operations/incident desk   | Service, affected location, incident/ticket reference                          |
| Compensation or SLA credit                            | Billing/claims or business support | Verified incident period, account type, applicable agreement                   |

### 11.1 Security and privacy reminders

- Never request a password, full card number, CVV, one-time password, banking login, or full PUK in chat.
- Use approved identity verification before discussing account-specific information or making account changes.
- Do not disclose another person's account details during contract-transfer or family-member requests.
- For suspected SIM swap, lost phone, or unauthorized account activity, prioritize security escalation over routine troubleshooting.
- Collect only the minimum information required for the case.

---

## 12. RAG retrieval and response guidance

This section is intended for systems that retrieve passages from this document.

### 12.1 Suggested metadata

When chunking this document, attach metadata such as:

- `domain`: `tariff_plan`, `billing`, `contract_termination`, `sim_esim`, `technical_support`, `roaming`, or `outage_incident`
- `topic`: a short topic label such as `plan_change`, `payment_error`, `sim_swap_fraud`, `roaming_pack`, or `router_led`
- `source_id`: the corresponding source identifier listed below
- `language`: `en` (the source questions also include Ukrainian)
- `content_type`: `process`, `troubleshooting`, `policy_boundary`, or `routing`

Keep section headings with their paragraphs during chunking. Avoid splitting a troubleshooting sequence from its safety or escalation notes.

### 12.2 Source identifiers represented in this guide

The dataset groups requests under the following knowledge-source identifiers:

| Source ID                   | Coverage                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `kb-tariff-catalog-01`      | Plan prices, unlimited-plan fair use, exact data allowances, student discounts        |
| `kb-tariff-switch-01`       | Upgrades, downgrades, effective dates, price retention                                |
| `kb-tariff-bundles-01`      | Extra data, family sharing, streaming benefits                                        |
| `kb-billing-autopay-01`     | Automatic payments, card changes, payment errors                                      |
| `kb-billing-disputes-01`    | Unfamiliar charges, duplicate charges, refunds, one-time fees                         |
| `kb-billing-statements-01`  | Invoices, due dates, payment methods, tax-invoice corrections                         |
| `kb-contract-cancel-01`     | Contract cancellation, required documents, ownership transfer, sales-promise disputes |
| `kb-contract-portout-01`    | Number portability, early termination, port-out rejections                            |
| `kb-contract-suspension-01` | Temporary suspension and final bills                                                  |
| `kb-esim-activation-01`     | eSIM activation, transfer, installation errors, additional eSIM lines                 |
| `kb-sim-replacement-01`     | Physical SIM activation/replacement and number selection                              |
| `kb-sim-security-01`        | Lost SIM blocking, PUK, suspected SIM-swap fraud                                      |
| `kb-tech-apn-01`            | APN, SMS delivery, device-specific 5G issues                                          |
| `kb-tech-quality-01`        | Slow mobile data, VoLTE, VoWiFi errors                                                |
| `kb-tech-router-01`         | Router reset, Wi-Fi password, router indicators, advanced router settings             |
| `kb-roaming-eu-01`          | EU and international usage, roaming voice/SMS distinctions                            |
| `kb-roaming-packs-01`       | Roaming pack activation, remaining allowance, pack expiry or interruption             |
| `kb-roaming-charges-01`     | Roaming spend controls, no service abroad, country rates, cruise/in-flight use        |
| `kb-outage-status-01`       | Current area outages, incident causes, restoration estimates                          |
| `kb-outage-reporting-01`    | Reporting issues, ticket status, recurring evening drops                              |
| `kb-outage-compensation-01` | Outage notifications, compensation, business SLA credits                              |

### 12.3 Answer construction

A good support answer should:

1. Identify the customer's actual intent and service type.
2. Retrieve the most relevant section, including its boundaries and escalation notes.
3. Give practical next steps in a clear order.
4. State which details must be verified in a live system.
5. Ask a focused follow-up only if a necessary detail is missing.
6. Avoid copying a dataset prompt or inventing a policy answer not present in the source.
7. Clearly distinguish a general process from a confirmed account-specific result.

### 12.4 When retrieval is insufficient

If the retrieved passage explains the process but does not contain the requested current value, do not fill the gap with a guess. For example:

- For a plan price, retrieve the current tariff catalogue.
- For a country roaming price, retrieve the current destination rate table.
- For APN values, retrieve the approved configuration for the exact service.
- For an error code, retrieve the current error-code reference.
- For an outage or ETA, query the live incident system.
- For a refund, compensation, or early-termination amount, inspect the account and applicable policy.
- For a router LED, retrieve the manufacturer's guide for the exact model.

The correct response when live data is unavailable is to say what needs to be checked and offer the appropriate handoff—not to fabricate a definitive answer.

---

## 13. Language and terminology notes

The source questions are written in both English and Ukrainian. The same support intent may appear with spelling mistakes, informal wording, missing punctuation, transliteration, or a mixture of technical terms and everyday language.

Useful terminology:

- **Tariff/plan**: тариф, plan, package.
- **Monthly fee**: абонплата, recurring subscription charge.
- **Data allowance**: гігабайти, data bundle, included data.
- **Roaming**: роумінг, international use on a partner network.
- **SIM replacement**: заміна SIM-картки.
- **eSIM transfer**: перенесення eSIM на новий телефон.
- **PUK**: SIM unlock code; handle as sensitive account information.
- **Number portability**: перенесення номера до іншого оператора.
- **VoLTE**: voice calls over LTE.
- **VoWiFi / Wi-Fi Calling**: calls over Wi-Fi.
- **APN**: mobile data access-point configuration.
- **Outage**: збій, аварія, service incident.
- **Final bill**: остаточний рахунок.
- **Automatic payment**: автоплатіж.
- **Tax invoice**: податкова накладна / VAT or tax invoice, depending on the document.

Do not rely on literal keyword matching alone. Interpret the service, symptom, and requested action together.
