# Wallet role-switch cleanup

## Changes
- Keep the wallet body focused on the customer QR, loyalty cards, rewards, and friend invites.
- Remove business creation, cashier, and dashboard actions from the wallet content flow.
- Extend the shared top header with an optional compact action area.
- Show staff a discreet “Switch to Cashier” header action.
- Show owners a compact “Merchant options” header menu with Cashier and Store dashboard destinations.
- Keep all role checks based on the verified account context already returned by the backend.

## Validation
- Check customer-only, staff, and owner header states.
- Verify both role destinations work and the wallet remains clean on mobile.
- Confirm the preview builds without errors.
