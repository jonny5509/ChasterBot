# ChasterBot Enhanced

Independent Discord companion for Chaster, using the official Chaster Public API.

## Included in this starter
- Discord slash-command foundation
- SQLite profiles, points, challenges and audit history
- Notification-channel configuration
- Chaster API request adapter
- Safe placeholders for OAuth, lock monitoring and keyholder actions

## Setup
1. Create a Discord application at https://discord.com/developers/applications
2. Copy .env.example to .env and fill in the Discord values.
3. Run npm install
4. Run npm run register
5. Run npm start

Use Node.js 20 or newer. Never commit .env or share bot tokens, OAuth secrets, access tokens or AI keys.

## Chaster API
Request developer access using https://docs.chaster.app/api/basics/getting-started/ and review https://api.chaster.app/api.
For multi-user use, implement OAuth and request the minimum granular scopes. Start with profile, locks:read and keyholder:read. Add write scopes only after consent, keyholder checks and confirmation controls are tested.

## Safety
- Never collect Chaster passwords; link accounts through OAuth.
- Verify the acting Chaster account is the authorised keyholder for the exact lock.
- Preview and confirm every lock-changing action.
- Apply time bounds, cooldowns and idempotency checks.
- Audit actor, target lock, action, amount and result; never log tokens.
- AI can suggest actions but cannot execute lock changes.
- Include wearer opt-out and emergency-help information.

## Status
This is the first repository scaffold. OAuth callback handling, encrypted token storage, verified live lock data, webhook/event delivery and write actions are intentionally staged for subsequent commits. Chaster's API is beta; confirm endpoint schemas and granted scopes against the current API reference before enabling production operations.
