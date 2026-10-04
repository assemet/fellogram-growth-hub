# English/Arabic localization and merchant branding

## Scope
- Expand the translation layer to English and Arabic, covering every customer, cashier, onboarding, and merchant screen.
- Detect the initial language from Telegram user data, then browser language; remember manual choices locally.
- Add a compact language control to the shared header and switch the document language and direction between LTR and RTL.
- Add owner-managed store branding: logo upload in merchant settings and a six-option stamp icon selector in loyalty-program settings.
- Display each store logo and chosen stamp symbol prominently on customer loyalty cards and the join preview.
- Preserve the customer-only wallet body; merchant and cashier navigation remains confined to the role-aware header menu.
- Retain Telegram WebApp color synchronization and verify both languages in light and dark themes.

## Data and permissions
- Add a validated `stamp_icon` field to loyalty programs.
- Use the existing `stores.logo_url` field for the selected logo.
- Add a public store-logo storage bucket with owner-only upload/update/delete policies and public read access.
- Save logos under the authenticated owner’s folder and validate image type and size before upload.

## User experience
- Put the language globe in every shared app header, including customer wallet and merchant screens.
- Add a Store Profile section to the program/settings screen with logo preview, upload/replace, and remove actions.
- Render stamp choices as an accessible visual selector: Coffee, Tag, Scissors, Food, Gift, and Star.
- Mirror layout and directional icons correctly in Arabic without changing established workflows.

## Technical details
- Make locale state reactive with a small shared provider/hook rather than the current module-only setter.
- Extend server functions and generated database typings for the new stamp icon and logo updates.
- Keep all styling token-based and use existing shared Button/menu components.
- Validate migrations, build health, then exercise wallet and merchant settings at mobile and desktop sizes in English/Arabic and light/dark modes.
