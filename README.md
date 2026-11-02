# ChasterBot Enhanced

Independent Discord companion for Chaster using the official Public API.

## Implemented in this build
- Discord slash commands and private Chaster account linking
- OAuth 2 authorization-code exchange and refresh-token flow
- AES-256-GCM encrypted OAuth token storage in SQLite
- Personal lock status, keyholder lock listing and Chaster profile
- Read-only shared lock, private conversation, calendar and notification-count views
- Read-only lock detail, lock seal, keyholder notes, application settings, permission catalogue, user overviews/statistics, achievements, badge counts, lock history and keyholder applications
- Keyholder time changes with lock-list revalidation, explicit confirmation, a 24-hour command bound and audit record
- Opt-in lock-change notifications via five-minute polling
- Profiles, points, leaderboards, community challenges and admin approval
- Configurable text-only reward and optional consequence ideas
- Dice game and optional AI-compatible keyholder persona
- Notification-channel configuration and admin audit command

## Requirements
- Node.js 20+
- Discord application/bot
- Chaster developer access and OAuth application
- Public HTTPS host for production OAuth callback

## Setup
1. Create a Discord application at https://discord.com/developers/applications.
2. Apply for Chaster developer access: https://docs.chaster.app/api/basics/getting-started/
3. Create a Chaster application after access is granted.
4. Copy .env.example to .env and configure values.
5. Generate encryption key: node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
6. Set CHASTER_REDIRECT_URI to your public HTTPS URL plus /oauth/chaster/callback. Register the exact same URL in Chaster.
7. npm install && npm run register && npm start

Never commit .env or share Discord tokens, Chaster secrets, access/refresh tokens or AI API keys. Losing the encryption key makes saved OAuth tokens unreadable.

## OAuth scopes requested
profile, profile:read/write, users:read/write, locks:read/write, shared_locks:read/write, keyholder:read/write, messaging:read/write, notifications:read/write, calendar:read/write, posts:read/write. Users must relink and approve the expanded consent request.

Official documentation:
- https://docs.chaster.app/api/basics/getting-started/
- https://docs.chaster.app/api/public-api/oauth-2/
- https://docs.chaster.app/api/reference/scopes/
- https://api.chaster.app/api

## Commands
/link-chaster, /unlink-chaster, /lock-status, /keyholder-locks, /time-change
/chaster-profile, /shared-locks, /chaster-conversations, /chaster-calendar, /chaster-notifications
/lock-details, /lock-seal, /keyholder-notes, /chaster-settings, /permission-catalog\n/chaster-user-overview, /chaster-user-stats, /chaster-achievements, /chaster-badges, /lock-history, /keyholder-applications
/notifications, /notify-channel, /profile, /leaderboard, /award-points
/challenge, /challenge-join, /challenge-approve
/reward-add, /punishment-add, /reward-list, /punishment-list
/dice, /keyholder-chat, /audit, /help

## Safety and limitations
- The bot never asks for Chaster passwords; users link through OAuth.
- AI cannot call lock APIs. Time changes require a linked keyholder, a matching lock in Chaster's keyholder-lock search, and a separate explicit confirmation.
- Time changes are limited to 24 hours per command. Chaster remains authoritative and may reject a request.
- Notifications are opt-in and polled every five minutes; they are not instantaneous webhooks.
- Reward/consequence items are suggestions only; keep them consensual, optional, non-physical and non-financial.
- AI is optional; without provider settings, the bot uses a scripted fallback.
- Chaster's API is beta. Test with a Chaster test lock and confirm current endpoint schemas before production.

## Production checklist
Use HTTPS, a persistent host and secret manager; lock down database permissions; encrypt backups; configure least-privilege Discord roles/channels; monitor API rate limits; never log credentials.


## Automatic Discord roles and private sessions
1. Give the bot the **Manage Roles**, **Create Private Threads**, **Manage Threads**, **View Channel**, **Send Messages**, and **Send Messages in Threads** permissions. Enable the **Server Members Intent** in the Discord Developer Portal if your deployment requires it.
2. In Server Settings > Roles, create the Wearer and Keyholder roles. Move the bot's role above both.
3. Run `/configure-roles wearer:@Wearer keyholder:@Keyholder` as a member with Manage Roles. Role sync checks linked Chaster accounts every 10 minutes; users can run `/sync-roles` themselves.
4. The role sync assigns Wearer when the linked account has an active personal lock and Keyholder when the account has active keyholder locks. Both roles can be assigned. It removes the configured role when no active locks are found.
5. Role-gated commands: `/lock-status` requires the Wearer role; `/keyholder-locks` and `/time-change` require the Keyholder role. The bot checks membership when a command runs and checks the Keyholder role again when a time-change confirmation is submitted. `/sync-roles`, account linking, profiles and community commands remain available as appropriate.
5. Run `/session-channel channel:#private-sessions` as an admin. Both participants link Chaster, then one runs `/session-invite user:@OtherMember`. The other participant must accept the DM invite before the bot creates a private thread and adds both people. This invite flow confirms both users linked Chaster and consented to the Discord session; it does not yet independently prove that the two Chaster accounts are paired on the same lock.

Discord bots cannot join ordinary group DMs. Private threads are the supported bot-accessible alternative. They are visible only to invited thread members and server staff with appropriate permissions. Keep the parent channel's permissions restricted.


Discord does not support dynamically hiding individual slash commands based on a member’s custom server roles. These role-specific commands may still appear in the command picker, but ChasterBot enforces the role check when they are invoked and responds ephemerally if the member lacks the required role.


## Chaster API coverage roadmap
This bot intentionally exposes supported Public API operations as focused Discord commands rather than a raw arbitrary-HTTP command. The current API integration includes read views for profile, personal/keyholder/shared locks, conversations, calendar, notification counts, lock details/seals/history, keyholder notes/applications, app settings, permission definitions, user overviews/statistics, achievements and badge counts. Remaining endpoint families are being added in separate reviewed batches: lock/shared-lock writes, messaging actions, notification actions, calendar writes, profile/user tools, posts, and selected extension workflows. Sensitive operations such as emergency unlock, combination retrieval, reports, and account-security features are not exposed as unrestricted commands.
