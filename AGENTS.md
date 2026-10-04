<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep Telegram appearance synchronized through the browser theme watcher, with device light/dark fallbacks and CSS semantic tokens; this preserves native Mini App colors without changing the verified business flows.
- Keep visual feedback in shared CSS utilities and existing UI buttons, with reduced-motion support; this makes wallet, cashier, and merchant screens consistent.
- Pass role-aware navigation into the shared app header as optional actions; this keeps customer content free of merchant controls.
- Keep locale selection centralized, persisted, and reflected on the document language and direction; this keeps every screen consistently bilingual.
- Store merchant logos in private object storage and expose only short-lived signed display URLs; this avoids permanent public asset links.
- Store card themes as a constrained store-level choice and render merchant previews with the customer card component; this keeps saved cards and previews visually identical.
