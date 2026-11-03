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
- Notification-channel configuration, member notification pause/resume and status, privacy-preserving admin delivery-queue counts, failed-delivery review and retry, notification-channel health diagnostics, six-hour-throttled server-owner alerts for terminal delivery failures, and admin audit command
- Configurable Wearer/Keyholder role synchronization and role-gated commands; automatic sync runs on a configurable interval (default 10 minutes), records cycle health in SQLite, prevents overlapping cycles, and continues scheduling after account-level failures; automatic sync runs on a configurable interval (default 10 minutes), records cycle health in SQLite, prevents overlapping cycles, and continues scheduling after account-level failures
- Mutual-consent private Discord session invitations using private threads
- Private, tabbed `/dashboard` member panel with Overview, Roles, Sessions, Account and Commands views; the Commands directory lists registered slash commands grouped by feature and filters role-gated/admin commands against the member’s current configured roles and permissions. Manage Server users also get an Admin tab for configured roles and session-channel settings. Dashboard buttons are bound to the invoking member and refresh their private panel; the Sessions tab lets either participant invite a member through a dashboard modal, archive a private session or cancel/decline a pending invitation, and shows a participant-only activity history for invitations and session lifecycle events. Dashboard invitations retain the same linked-account, membership, mutual-consent and private-thread checks as `/session-invite`. The Account tab includes dashboard actions to link or reconnect Chaster, check connection health, confirm before unlinking, and synchronize Chaster-derived Discord roles; live wearer and keyholder locks are displayed in the same tab. The Keyholder tab provides dashboard forms to view private notes, request confirmation before deleting notes, and propose a time change. The Notifications tab displays server opt-in status and Chaster notification counts, lets members pause/resume server lock updates, and mark Chaster notifications as read. The Calendar tab displays personal Chaster events and provides forms to create events or request event deletion; deletion revalidates event ownership and requires confirmation. The Messages tab lists the member's own Chaster conversations and opens a selected conversation in a private, read-only view; the submitted ID is checked against the member's current conversation list before message retrieval. Sending messages is not available because the application does not request messaging-write permission. The Community tab lists active server challenges, participation counts, reward ideas and optional consequences. The Admin tab provides a dashboard overview of configured roles and channels, notification queue counts and delivery success, failed items, and recent audit events. Manage Server users can configure wearer/keyholder roles, session and notification text channels, and 7/30/90-day notification retention from a form; channel permissions and role hierarchy are validated before changes are applied. Admins can also retry a failed notification by its server-scoped queue ID. The Admin tab also supports audit searches by action, actor, free-text details and time window (1/7/30/90 days), with an ephemeral preview and CSV export of up to 200 matching events. Server admins can also configure role automation from the Admin tab: pause/resume automatic Chaster role syncing, and choose whether inactive wearer/keyholder roles are removed or retained. Active-lock role assignment remains automatic when syncing is enabled. Admins can additionally configure separate Discord roles for Chaster locks whose API status is `locked` or `active`; these status-specific roles are evaluated independently from the general wearer and keyholder roles and follow the same inactive-role retention setting. Configure them with the Admin tab's Lock status roles control. A further optional minimum-duration role can be configured from the Admin tab. It is assigned only while a lock is currently `locked` and its supported Chaster start timestamp is at least the configured number of hours old (1–8760); set the threshold to `0` or clear the role to disable it. If Chaster does not return a recognized start timestamp, the duration role is not assigned. Members can join active challenges; Manage Server users can create challenges, approve member completions for points, award or deduct community points with a required reason, and add reward/consequence suggestions through dashboard forms. Challenge joins are scoped to the current server. These actions require the configured Discord Keyholder role and revalidate trusted Chaster keyholder ownership before accessing notes or submitting a time change; time changes retain the existing 24-hour limit and explicit confirmation. Temporary Chaster API failures are shown without breaking the dashboard

## Requirements
- Node.js 20+
- Discord application/bot
- Chaster developer access and OAuth application
- Public HTTPS host for production OAuth callback

## Setup
1. Create a Discord application at https://discord.com/developers/applications.
2. Apply for Chaster developer access: https://docs.chaster.app/api/basics/getting-started/
3. Create a Chaster application after access is granted.
4. Copy .env.example to .env and configure values. Set `ROLE_SYNC_INTERVAL_MINUTES` to change the automatic Chaster role-sync interval (1–1440 minutes; default 10). Set `ROLE_SYNC_INTERVAL_MINUTES` to change the automatic Chaster role-sync interval (1–1440 minutes; default 10).
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

**Dashboard command directory:**  
Open `/dashboard` and select **Commands** to see commands grouped by feature. Wearer, Keyholder and server-admin entries are filtered using your current configured Discord role and permissions; commands remain enforced server-side when invoked.  

**Community and administration:**  
/profile, /leaderboard, /notifications, /notification-status, /notification-queue-status, /notification-health, /notification-failures, /notification-retry, /notify-channel, /challenge, /challenge-join, /challenge-approve, /award-points, /reward-add, /punishment-add, /reward-list, /punishment-list, /dice, /keyholder-chat, /audit, /configure-roles, /sync-roles, /session-channel, /session-invite, /help

## Safety and limitations
- The bot never asks for Chaster passwords; users link through OAuth.
- AI cannot call lock APIs. Time changes require a linked keyholder, a matching lock in Chaster's keyholder-lock search, and a separate explicit confirmation.
- Time changes are limited to 24 hours per command. Chaster remains authoritative and may reject a request.
- Lock-change notifications are opt-in and polled every five minutes; they are not instantaneous webhooks. Detected changes and Chaster reauthorization alerts enter a persistent SQLite queue before delivery. The worker resumes pending messages after restarts, suppresses duplicate event enqueues, retries transient Discord failures with capped backoff, and marks permanent failures (such as blocked DMs or missing channels) for operator review. Members can pause/resume updates with `/notifications` and inspect their setting with `/notification-status`; administrators with Manage Server can view aggregate pending/sent/failed counts with `/notification-queue-status`, which never exposes message contents or recipient details. They can run `/notification-health` to check whether the configured channel exists and whether the bot has View Channel and Send Messages permissions. This permission check does not send a test message or guarantee delivery. If a channel notification permanently fails or exhausts its retry attempts, the bot queues a private alert to that server's owner (at most once every six hours per server). The alert contains a queue ID and safe failure category, not notification content or recipient details. It also pauses new lock-change notification enqueues for that broken channel to prevent a growing backlog. Administrators can run `/notify-channel` with the same channel after fixing permissions, or select a replacement; this clears the pause. `/notification-health` shows the paused state. Administrators can also use `/notification-history` to review the ten most recent channel delivery outcomes, timestamps and attempt counts; it omits message content and destination identifiers. Retention is configurable per server with `/notification-retention days:7`, `30` or `90` (default 30 days). Queue cleanup removes old sent and failed channel records according to that setting; pending deliveries are never removed by retention cleanup. User-DM queue records retain their existing 30-day sent/90-day failed cleanup policy. `/notification-report` summarizes sent, failed and pending channel deliveries over 7, 30 or 90 days, including the completed-delivery success rate and average attempts. Pending items are excluded from the success-rate denominator; report output is ephemeral and contains no message contents or destination IDs.
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

## Discord dashboard

Use `/dashboard` as the main entry point for wearer, keyholder, community and server tools. The Wearer tab provides dashboard actions for your own lock history and details, public profile and public-lock lookups, shared-lock details, your Chaster statistics, and discovery catalogues. The Keyholder tab includes trusted-lock notes, note deletion with confirmation, time-change proposals with confirmation, and keyholder applications. Existing account, calendar, notification, conversation and session controls remain available in their dashboard tabs.

Chaster lookups that reference a private lock or shared lock are checked against the linked account's own lock list before the request is made. Keyholder operations recheck the configured Keyholder role and Chaster's trusted keyholder lock status. Wearer tools require the configured Wearer role. The dashboard is private to the interacting member.

The migration is incremental: retain the existing slash commands until their dashboard replacements have been implemented and verified. `/dashboard` remains the command used to open the control panel.
