# Fellogram Growth Hub

FELLOGRAM — MASTER BUILD SPECIFICATION

You are the lead software engineer building Fellogram.

Fellogram is a Telegram-native loyalty and customer growth platform for small businesses.

The core idea is:

Turn loyalty into growth.

The fundamental growth loop is:

Visit → Reward → Return → Refer → New Customer → Growth

1. PRODUCT DEFINITION

Fellogram is NOT simply a digital loyalty card.

It is a customer growth platform built around loyalty.

Traditional loyalty:

Reward → Retention

Fellogram:

Reward → Retention → Referral → Acquisition → Growth

The first MVP must focus on proving this loop.

Do NOT expand the MVP unnecessarily.

2. MVP SCOPE

The MVP consists of four core areas:

A. Customer

The customer can:

- Enter Fellogram through Telegram Mini App.

- Have a Telegram-linked profile automatically created.

- Join a merchant loyalty program.

- View their loyalty cards.

- View stamp progress.

- View available rewards.

- Redeem rewards via temporary single-use QR.

- Invite friends via unique Telegram referral links.

- Track successful referrals.

B. Merchant

The merchant can:

- Create an account/profile.

- Create a store via a simple setup wizard.

- Create one stamp-based loyalty program.

- Define the number of stamps required for a reward.

- Create rewards.

- Enable/disable referrals.

- Define the referral reward.

- Invite staff via Telegram invitation links.

- View customers.

- View transactions.

- View basic growth analytics (Visits, Rewards, Referral Customers).

C. Staff / Cashier

Staff can:

- Enter Cashier Mode.

- Scan a customer's loyalty QR.

- Award one stamp (or multiple stamps if configured by merchant).

- Undo an accidental stamp.

- Scan a temporary reward redemption QR.

- Confirm reward redemption.

The cashier workflow must be extremely fast.

Target: Scan → Stamp → Done (~3 seconds).

The cashier should not need to navigate through multiple screens.

D. Referral

The referral system must follow:

Invite → Join → First qualifying visit/purchase → Reward

Do NOT reward invitations alone.

The merchant defines the reward.

Fellogram does not create its own points or currency.

3. ONBOARDING, SPLASH, LOGO & ROLE ROUTING

- Logo Integration: I have provided/attached the official Fellogram logo. Store this logo asset in `public/logo.png` and use it across the application (Splash Screen, Navigation Header, Customer Loyalty Wallet, and Merchant Dashboard).

- Splash Screen: On initial launch, show a brief splash screen centering the official logo above the tagline "Turn loyalty into growth" with a subtle fade-in animation while verifying Telegram initData and checking existing profile/role in Supabase.

- Auto-Profile Creation: Automatically create a profile record using Telegram user details (id, first_name, username).

- Role Routing:

  - If Staff Invite Link: Assign staff role for that store and route directly to Cashier Mode.

  - If Store Join / Referral Link: Create membership and route directly to the Customer Loyalty Card.

  - If Direct Launch (New User): Show Customer Wallet default view with a subtle, clear option: "Own a business? Create your Store".

- Merchant Onboarding: Clicking "Create Store" opens a simple setup (Store Name -> Loyalty Program & Reward -> Done).

4. LOYALTY MODEL

For MVP: STAMPS ONLY.

Do NOT implement Points in the MVP.

A loyalty program should have:

- Program name

- Number of stamps required

- Reward

- Active/inactive state

Example:

Buy/Visit 10 times → Free Coffee

Customer: 7 / 10 stamps

5. REFERRAL MODEL

Referral is a core MVP feature, not a future feature.

Example:

1. Ahmed is an existing customer.

2. Ahmed selects "Invite a Friend".

3. Fellogram generates a unique referral link.

4. Ahmed sends it through Telegram.

5. Mohamed opens the link and joins the merchant's loyalty program.

6. Mohamed completes the required first qualifying visit/purchase.

7. Only then:

   - Mohamed receives the merchant-defined new-customer reward.

   - Ahmed receives the merchant-defined referral reward.

The exact reward must be configurable by the merchant.

The system must prevent the same Telegram account from repeatedly receiving new-customer referral/welcome rewards for the same store.

6. MERCHANT-CONTROLLED REWARDS

The merchant owns and controls:

- Stamp rules

- Reward rules

- Referral rules

- Referral reward

- New customer reward

Fellogram must not create a universal currency.

Fellogram does not own the merchant's stamps.

Stamps are a representation of the merchant's loyalty program.

7. USER ROLES & STRICT ROLE ISOLATION

There are three primary application roles:

- Customer: Can manage their loyalty memberships and referrals.

- Merchant Owner: Can manage the store, loyalty program, rewards, staff, customers and analytics.

- Staff: Can operate the cashier workflow and perform authorized loyalty/reward transactions.

STRICT ISOLATION RULES:

- Cashier Mode is strictly restricted. Customers must NEVER see or access the Cashier Scanner/Award UI.

- Only authenticated users listed as staff or owner in store_members for a specific store can access Cashier actions.

- Do not allow staff to perform merchant-owner actions unless explicitly authorized.

8. CORE SECURITY PRINCIPLES

Security is critical. Never trust the frontend for:

- awarding stamps

- redeeming rewards

- referral attribution

- determining eligibility

- preventing duplicate rewards

- cooldown enforcement

- staff authorization

These operations must be validated server-side using Supabase Edge Functions and PostgreSQL logic.

Use Row Level Security (RLS) for all exposed tables.

Never expose a Supabase secret/service-role key to the browser. The frontend may only use the public/publishable Supabase key.

9. SUPABASE ARCHITECTURE

Use:

- Supabase PostgreSQL

- Supabase Auth / Telegram HMAC validation

- Row Level Security (RLS)

- Supabase Edge Functions

- PostgreSQL constraints/indexes

Do not introduce another backend, another database, Redis, or external infrastructure for the MVP.

10. CORE DATA MODEL

The initial database should be based around the following entities:

profiles:

- id, telegram_user_id, username, first_name, last_name, avatar_url, created_at, updated_at

stores:

- id, owner_id, name, description, logo_url, active, created_at, updated_at

store_members:

- id, store_id, user_id, role ('owner' | 'staff'), created_at

loyalty_programs:

- id, store_id, name, description, stamps_required, active, created_at, updated_at

customer_memberships:

- id, store_id, program_id, customer_id, stamp_balance, joined_at, last_visit_at, created_at, updated_at

rewards:

- id, store_id, program_id, name, description, stamps_required, active, created_at, updated_at

transactions:

- id, store_id, customer_id, staff_id, type ('stamp_awarded' | 'stamp_reversed' | 'reward_redeemed' | 'referral_reward'), amount, related_reward_id, metadata, created_at

redemptions:

- id, store_id, customer_id, reward_id, token_hash, expires_at, used_at, status ('pending' | 'used' | 'expired'), created_at

referrals:

- id, store_id, referrer_customer_id, referred_customer_id, referral_code, status ('pending' | 'qualified' | 'rewarded'), qualifying_transaction_id, rewarded_at, created_at

11. QR ARCHITECTURE

MVP uses:

- Customer QR: A stable QR representing the authenticated customer's membership/identity. Used by staff to identify the customer.

- Store Join QR: A QR that allows a customer to join the store's loyalty program.

- Redemption QR: A temporary, single-use QR/token for reward redemption. Must expire quickly, be single-use, and be validated server-side.

Dynamic customer QR rotation is NOT required for MVP.

12. ANTI-FRAUD

MVP protection includes:

- Telegram identity: One Telegram account corresponds to one customer identity.

- Welcome reward protection: A customer cannot repeatedly receive a new-customer/welcome reward for the same store.

- Cooldown: Prevent repeated stamp awards to the same customer at the same store within 15 minutes.

- Staff attribution: Every stamp transaction records the staff member who performed it.

- Immutable ledger: Record reversals as separate transactions (stamp_reversed).

- Undo: Allow authorized staff to undo an accidental recent stamp.

13. TELEGRAM INTEGRATION

Designed as a Telegram Mini App.

Validate Telegram Mini App initialization data (initData) securely using HMAC on the server side. Never trust unverified payload from the frontend.

14. CUSTOMER UX

Customer home shows "My Loyalty" cards:

- ☕ ABC Coffee — 7 / 10 Stamps

- 🍕 Pizza House — 3 / 5 Stamps

Opening a card allows seeing progress, redeeming rewards, and inviting friends. Keep the interface extremely simple.

15. MERCHANT UX

Dashboard focuses on business growth:

- Customers

- Visits

- Stamps awarded

- Rewards redeemed

- New customers & Referral customers

The dashboard must answer: "Is Fellogram helping my business grow?"

16. CASHIER UX

Restricted to verified staff/owners only.

Workflow: Scan Customer → Identify → Award Stamp → Success (Target: ~3 seconds).

Provide Undo option and Scan Reward for redemption.

17. DESIGN & MOBILE FIRST

- Modern, clean, mobile-first, Telegram-native.

- Feature the official logo seamlessly in headers, splash screens, and cards.

- Optimized specifically for smartphones and Telegram Mini App viewports.

- Avoid enterprise complexity, excessive charts, or bloated animations.

18. INTERNATIONALIZATION

Structure UI text to support i18n later (e.g., Arabic first, but without hardcoding strings into business logic).

19. WHAT NOT TO BUILD IN MVP

Do NOT implement: Points, Dynamic QR, Apple/Google Wallet, POS integrations, advanced campaigns, customer segmentation, AI features, marketplace, automated payments/subscriptions.

20. DEVELOPMENT METHOD & VERTICAL SLICES

Build the application incrementally. Do NOT attempt to generate the entire application in one step. Execute slice by slice:

- Slice 1: Authentication + Profiles + Store Creation + Splash/Onboarding + Logo setup

- Slice 2: Loyalty Program + Customer Membership + Stamp Ledger

- Slice 3: Cashier QR + Award Stamp + Undo + Cooldown (Role restricted)

- Slice 4: Customer Wallet + Rewards + Redemption QR

- Slice 5: Referral System (Links + Qualification + Rewards)

- Slice 6: Basic Growth Analytics Dashboard

21. DATABASE-FIRST RULE

Define DB Schema, relationships, constraints, indexes, and RLS policies BEFORE building complex UI components.

22. BUSINESS LOGIC RULE

Critical operations (Awarding stamps, Redemptions, Referral qualification) must be atomic server-side operations via Edge Functions / DB functions.

23. SUCCESS CRITERIA FOR MVP

- Merchant: Create Store → Create Stamp Program → Create Reward → Add Staff → Display QR.

- Customer: Join → Collect Stamps → See Progress → Earn Reward → Redeem.

- Referral: Invite Friend → Friend Joins → Friend Qualifies → Both Receive Reward.

- Analytics: Merchant sees Customers, Visits, Rewards, and Referral Growth.

FINAL PRODUCT PRINCIPLE:

Fellogram is not about collecting stamps.

Fellogram is about turning customer loyalty into customer growth.

Core Loop: Visit → Reward → Return → Refer → New Customer → Growth

"Please read this master specification carefully and utilize the attached logo. Set up the project structure, public/logo.png, and database schema, then implement Slice 1 (Authentication + Profiles + Store Creation + Splash/Onboarding). Stop after finishing Slice 1 and wait for my review and instruction to proceed to Slice 2."

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bb0eea93-226b-4f80-9f08-d937b881b769).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
