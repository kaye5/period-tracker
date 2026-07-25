# Privacy

This document says plainly what is, and is not, protected by this build. It is not
marketing copy. The same short statement appears verbatim on the Settings screen
(`lib/copy/general.ts`'s `PRIVACY_STATEMENT`) — the two are kept in lockstep on purpose,
so there is exactly one place this claim is written and both surfaces quote it.

> **This build stores your data in a SQL database, and where that database lives is your
> choice (DEC-011, DEC-012).** The app connects to whatever `DATABASE_URL` points at. If
> that is a database running on this machine, the data stays on this machine. If it is a
> hosted service (for example TiDB Cloud or a hosted MySQL provider), the health details
> you record leave this device and are stored on that provider's servers. Either way, the
> app adds no protection of its own — see below.

## The statement

> Your data is stored in a SQL database that this app reaches using the address in
> DATABASE_URL. Where that database runs is your choice, and it decides where your
> periods, symptoms, notes, and health details go: point DATABASE_URL at a database
> running on this machine and the data stays on this machine; point it at a hosted
> service such as TiDB Cloud or a hosted MySQL provider and the data leaves this device
> and sits on that provider's servers, in their custody.
>
> What that does and does not mean: this app adds no protection of its own on top of
> whatever the database itself does, and it makes no independent claim about your data in
> transit or at rest. The connection details, including the database password, are stored
> in plain text in a file (.env.local) on this machine, so anyone who can read this
> machine's files can connect to your database from anywhere its network rules allow. If
> you use a hosted database, its protection depends on that provider and your account with
> them, not on this app — use a strong, unique password, turn on two-factor authentication
> where it is offered, and restrict network access. This app has no lock screen, sends no
> analytics or telemetry, and loads no third-party script, font, or image. You can export
> everything you've recorded, or permanently delete it, at any time from Settings.

## What this build does NOT protect against

- **The database credentials are stored in plain text.** The full connection string,
  including the database password, lives in `.env.local` on this machine. Anyone who can
  read that file can connect to your database from anywhere its network rules allow. The
  app adds no protection of its own on top of what the database provides, and holds no
  key.
- **If you point it at a hosted database, your data leaves your device.** With a hosted
  service (TiDB Cloud, a hosted MySQL provider, or any database not running on this
  machine), your records are stored on that provider's infrastructure. They are subject
  to that provider's practices, terms, and legal jurisdiction, and to any account access —
  which this app cannot see or control. Reproductive-health data held by a third party
  can, in principle, be reached by that third party, by anyone who compromises the
  account, or by legal process served on the provider. A database running on this machine
  avoids this particular exposure, but not the others below.
- **No app lock.** There is no PIN, biometric gate, or any other screen between opening
  this app and seeing everything in it. Anyone who can unlock this device can open this
  app.
- **No per-user access control inside the app.** This is a single-user build with no
  accounts and no authentication in the app itself. The access boundaries are your
  device's security and, if you use a hosted database, that provider account's security —
  nothing in this codebase.
- **Whatever the database provides is the database's, not this app's.** Any protection a
  database applies to data in transit or at rest is administered by that database (and,
  for a hosted service, under your account with the provider), and its strength depends on
  how that is configured. This app adds no protection of its own on top of it and makes no
  independent claim about any of it — it holds no key.

None of the above is mitigated by anything in this codebase. This document exists so
the trade-off is visible, not because a workaround is coming in this build.

## What this build DOES do

- **No analytics, telemetry, or remote third-party assets.** No analytics SDK, no crash
  reporter, no remote font, no remote image, no third-party script in the app. The only
  outbound connection the app makes is to the database you configured, to read and write
  your own data.
- **Full data export**, so your records are never trapped in the app.
- **Permanent, real deletion.** When you delete your data, the rows are actually removed
  from the database — not soft-deleted, not retained "for support purposes." Note:
  deleting from the app removes the live data; any backups or snapshots the database (or
  a hosting provider) has configured are governed by those settings and are outside this
  app's control.

## What would make this materially more private

In rough order of impact, and none of it is in this build:

1. **Client-side (end-to-end) encryption** — encrypt each record on this machine with a
   key derived from a passphrase the user holds, so the database only ever stores
   ciphertext. This is the single change that would most reduce the third-party-custody
   risk when a hosted database is used.
2. **An app lock** (passphrase / biometric) — deferred (DEC-002).
3. **A carefully configured database.** Keeping the database on this machine, or — for a
   hosted service — using a dedicated least-privilege database user, a strict network
   access list, mandatory 2FA on the provider account, and a documented backup/retention
   policy. Most of this is configuration the user does, not code, but it is where most of
   the real-world protection currently lives.

## Words this app will never use about itself

No string anywhere in this app claims to be **private-by-design**, **secure**, or
**encrypted**, or claims that this app keeps your data private. It does not add any
protection of its own, and the credentials to reach your database sit in plain text on
this machine. Per SPEC.md §0.1, no user-facing string claims the data is encrypted, even
as an attributed fact about a provider: the app states only what it itself does and does
not do, and does not wrap any protection in a blanket reassurance a user could reasonably
over-rely on.
