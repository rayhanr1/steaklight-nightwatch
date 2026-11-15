<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Game rules (hearts, durations, bounce counts, level scaling) live as pure functions in `src/game/rules.ts` and are tested in `src/test/game-rules.test.ts`; keep the canvas loop in `src/game/Game.tsx` free of rule constants so rules stay testable.
- Characters and steaks are pixel maps drawn to canvas in `src/game/sprites.ts`, not image files, so they stay crisp at any scale.
- Pause gates the entire simulation and animation clock; saved snapshots are validated in `src/game/progress.ts` and stored per signed-in player under Cloud RLS, so reloads restore the full run without sharing saves.
- Block collision separation and phase-survival filtering use pure rules; enemy rebound timers are saved with backward-compatible defaults so chasing AI cannot immediately cancel shield rebounds.
- Full-health supply decisions and hit-only TNT detonation use pure rules; saved TNT fuse values are legacy data, not simulation clocks, so older saves obey current mechanics.
