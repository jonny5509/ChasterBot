# ChasterBot Enhanced

Independent Discord companion for Chaster using the official Public API.

## Implemented in this build
- Discord slash commands and private Chaster account linking
- Chaster authorization health tracking, private relink alerts on detected authorization failures, and `/chaster-link-status` for a private connection check
- OAuth 2 authorization-code exchange and refresh-token flow
- AES-256-GCM encrypted OAuth token storage in SQLite
- Personal lock status, keyholder lock listing and Chaster profile
- Read-only shared-lock, private conversation/message, calendar, notification-count/channel-health and favorite-status views; add/remove favorites and confirmation-protected shared-lock archiving
- Calendar lock-period event creation, editing and confirmation-protected deletion
- Shared-lock details and tags, extension catalogue, Explore categories, calendar statistics, blocked-user and ignored-user lists
- Achievement and community-event categories, lock-statistics reset configuration and public user locks
- Notification read and read-all actions
- Read-only lock detail, lock seal, keyholder notes, application settings, permission catalogue, user overviews/statistics, achievements, badge counts, lock history and keyholder applications
- Keyholder time changes with lock-list revalidation, explicit confirmation, a 24-hour command bound and audit record
- Opt-in lock-change notifications via five-minute polling, persisted in a SQLite delivery queue with restart recovery, duplicate suppression, and bounded retries
- Profiles, points, leaderboards, community challenges and admin approval
- Configurable text-only reward and optional consequence ideas
- Dice game and optional AI-compatible keyholder persona
- Notification-channel configuration, member notification pause/resume and status, privacy-preserving admin delivery-queue counts, failed-delivery review and retry, notification-channel health diagnostics, and admin audit command
- Configurable Wearer/Keyholder role synchronization and role-gated commands
- Mutual-consent private Discord session invitations using private threads

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
ChasterBot requests only the scopes used by its current features:

- `profile`, `profile:read`: account identity and profile/statistics views
- `users:read`: blocked-user and public-lock lookups
- `locks:read`, `locks:write`: personal locks, lock history/seals, time changes and lock-related actions
- `shared_locks:read`, `shared_locks:write`: shared-lock views, favorites and archiving
- `keyholder:read`, `keyholder:write`: keyholder lock and notes operations
- `messaging:read`: conversations and messages (the bot does not request permission to send messages)
- `notifications:read`, `notifications:write`: notification views and read actions
- `calendar:read`, `calendar:write`: calendar event views and edits

The bot does not request profile editing, user writing, messaging writing or post-management scopes. If you linked ChasterBot before this scope reduction, run `/link-chaster` again and approve the updated consent screen; existing access/refresh tokens do not automatically gain newly requested scopes. The bot also records Chaster 401 responses and revoked/invalid refresh grants as a connection-health issue, sends a private relink prompt with a 24-hour notification throttle, and clears the warning after successful reauthorization. Run `/chaster-link-status` to check your own connection. Unlinking clears the local health record. Chaster API requests also use bounded retry protection: only idempotent GET requests retry brief 429 responses (honoring `Retry-After`) and transient 502/503/504 or network failures. Write requests are never automatically replayed. Longer rate limits return a retry delay to the user rather than keeping the interaction waiting.

Official documentation:
- https://docs.chaster.app/api/basics/getting-started/
- https://docs.chaster.app/api/public-api/oauth-2/
- https://docs.chaster.app/api/reference/scopes/
- https://api.chaster.app/api

## Commands

**Account and locks:**  
/link-chaster, /chaster-link-status, /unlink-chaster, /lock-status, /keyholder-locks, /lock-details, /lock-seal, /lock-history, /time-change, /keyholder-applications, /keyholder-notes, /keyholder-notes-delete

**Profiles and discovery:**  
/chaster-profile, /chaster-user-overview, /chaster-user-stats, /chaster-achievements, /chaster-badges, /chaster-achievement-categories, /chaster-public-locks, /shared-locks, /shared-lock-details, /shared-lock-tags, /shared-lock-favorite, /shared-lock-favorite-add, /shared-lock-favorite-remove, /shared-lock-archive, /chaster-extensions, /chaster-explore-categories

**Messaging and notifications:**  
/chaster-conversations, /chaster-conversation, /chaster-messages, /chaster-ignored-users, /chaster-notifications, /chaster-notification-health, /chaster-notification-read, /chaster-notifications-read-all, /chaster-blocks

**Calendar and settings:**  
/chaster-calendar, /calendar-event-add, /calendar-event-edit, /calendar-event-delete, /chaster-calendar-stats, /chaster-settings, /permission-catalog, /chaster-lock-stats-config, /chaster-community-categories

**Community and administration:**  
/profile, /leaderboard, /notifications, /notification-status, /notification-queue-status, /notification-health, /notification-failures, /notification-retry, /notify-channel, /challenge, /challenge-join, /challenge-approve, /award-points, /reward-add, /punishment-add, /reward-list, /punishment-list, /dice, /keyholder-chat, /audit, /configure-roles, /sync-roles, /session-channel, /session-invite, /help

## Safety and limitations
- The bot never asks for Chaster passwords; users link through OAuth.
- AI cannot call lock APIs. Time changes require a linked keyholder, a matching lock in Chaster's keyholder-lock search, and a separate explicit confirmation.
- Time changes are limited to 24 hours per command. Chaster remains authoritative and may reject a request.
- Lock-change notifications are opt-in and polled every five minutes; they are not instantaneous webhooks. Detected changes and Chaster reauthorization alerts enter a persistent SQLite queue before delivery. The worker resumes pending messages after restarts, suppresses duplicate event enqueues, retries transient Discord failures with capped backoff, and marks permanent failures (such as blocked DMs or missing channels) for operator review. Members can pause/resume updates with `/notifications` and inspect their setting with `/notification-status`; administrators with Manage Server can view aggregate pending/sent/failed counts with `/notification-queue-status`, which never exposes message contents or recipient details.
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
This bot intentionally exposes supported Public API operations as focused Discord commands rather than a raw arbitrary-HTTP command. The current API integration includes read views for profile, personal/keyholder/shared locks, conversations, calendar, notification counts/channel health, conversation messages, shared-lock details/tags/favorite status, extension and Explore catalogues, calendar statistics, blocked users, lock details/seals/history, keyholder notes (including confirmation-protected deletion)/applications, app settings, permission definitions, user overviews/statistics, achievements and badge counts. Implemented write operations include keyholder time changes (with revalidation and confirmation), calendar event creation/editing/deletion, notification read actions, shared-lock favorite add/remove, confirmation-protected shared-lock archiving and calendar-event deletion with account-owned-list revalidation, and confirmation-protected keyholder-note deletion with role and lock-ownership revalidation. DTO-dependent operations such as shared-lock creation/editing, keyholder-note creation/update and messaging sends remain out of scope until their request schemas are verified against the current API specification. Sensitive operations such as emergency unlock, combination retrieval, reports, and account-security features are not exposed as unrestricted commands. Keyholder-note deletion is confirmation-gated and rechecks both the configured Discord Keyholder role and the Chaster keyholder-lock list before calling the API.

## Development

Run `npm run check` for JavaScript syntax checks and `npm test` for the automated API and rate-limit retry, token-encryption, OAuth-state, role-classification, and destructive-action confirmation, and Chaster resource-ownership tests. GitHub Actions runs both on pushes and pull requests.
