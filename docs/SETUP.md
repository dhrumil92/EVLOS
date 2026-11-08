# SETUP: running EVLOS on your own machine

This guide takes a fresh Windows, macOS or Linux machine to a running EVLOS: the database, the server (backend), the Rector's page (frontend), the Rector's login, email, and the fingerprint Device. Every step is a command you can copy. Deployment on the server has its own guide, `docs/DEPLOY.md`.

## What you will run

```
                       your machine
  ┌────────────────────────────────────────────────────────────────┐
  │                                                                │
  │  Browser ──> page (Vite, port 5173) ──/api──> server (Fastify) │
  │                                              │   page API 3000 │
  │  Device ──(plain HTTP, port 8081)──────────> │   Device  8081  │
  │                                              ▼                 │
  │                                     PostgreSQL 17 (port 5432)  │
  │                                     databases evlos, evlos_test│
  └────────────────────────────────────────────────────────────────┘
```

| Part | What it is | Started with |
|------|------------|--------------|
| **Database** | PostgreSQL 17 with two databases: `evlos` (your data) and `evlos_test` (wiped by every test run). | Already running as a service once installed. |
| **Backend** | One Node.js process with three listeners: the Device endpoints on `DEVICE_PORT` (8081), the page API on `PAGE_PORT` (3000) and the Public Live View on `PUBLIC_PORT` (3001). It also runs the schedule that sends emails. | `npm run dev` |
| **Frontend** | The Rector's page, served by Vite at http://localhost:5173. It passes `/api/public` to the Public Live View's server and every other `/api` request to the page API. The Public Live View is at http://localhost:5173/live. | `npm run dev:web` |

## 1. Install the tools (once)

| Tool | Version | Notes |
|------|---------|-------|
| Git | any recent | https://git-scm.com |
| Node.js | **22.13.1** (the exact version is in `.nvmrc`) | With nvm: `nvm install 22.13.1` then `nvm use 22.13.1`. On Windows use nvm-windows. npm comes with Node. |
| PostgreSQL | **17** | https://www.postgresql.org/download/. The installer also gives you pgAdmin and the `psql` command. Remember the password you choose for the `postgres` admin user. |
| Mailpit | optional | Catches every email locally so none reaches a real inbox: https://github.com/axllent/mailpit. |

Check them:

```bash
git --version
node --version      # v22.13.1
npm --version
psql --version      # psql (PostgreSQL) 17.x
```

## 2. Get the code

```bash
git clone https://github.com/dhrumil92/EVLOS.git
cd EVLOS
npm install
```

`npm install` installs all three workspaces (`packages/core`, `apps/api`, `apps/web`) with the exact versions in `package-lock.json`.

## 3. Create the database user and the two databases (once)

EVLOS connects as its own user, `evlos`, never as the `postgres` admin. It needs no superuser rights.

**With psql** (open a terminal; on Windows, "SQL Shell (psql)" from the Start menu also works):

```bash
psql -U postgres
```

Then, inside psql (choose your own password instead of `choose-a-password`):

```sql
CREATE ROLE evlos LOGIN PASSWORD 'choose-a-password';
CREATE DATABASE evlos OWNER evlos;
CREATE DATABASE evlos_test OWNER evlos;
\q
```

**Or with pgAdmin:** right-click *Login/Group Roles* > *Create* > name `evlos`, a password on the *Definition* tab, and *Can login?* on the *Privileges* tab (leave *Superuser* off). Then right-click *Databases* > *Create* twice: `evlos` and `evlos_test`, each with owner `evlos`.

> `evlos_test` is emptied by every test run. Never point it at real data, and never use any other name for it: the tests refuse to run unless the database is called `evlos_test`.

## 4. Fill in `.env`

Copy the example:

```bash
cp .env.example .env              # Git Bash, macOS, Linux
Copy-Item .env.example .env       # PowerShell
```

Open `.env` and put your `evlos` password into both database addresses (replace `change-me`). For a local run, everything else can stay as it is.

| Variable | Local value | What it is |
|----------|-------------|------------|
| `DATABASE_URL` | `postgres://evlos:<password>@localhost:5432/evlos` | Your data. |
| `TEST_DATABASE_URL` | `postgres://evlos:<password>@localhost:5432/evlos_test` | The test database; must end in `/evlos_test`. |
| `DEVICE_PORT` | `8081` | Where the Device sends Punches. |
| `PAGE_PORT` | `3000` | Where the page's API listens (this machine only). |
| `PUBLIC_PORT` | `3001` | Where the Public Live View's server listens (this machine only; no login). |
| `TRUST_PROXY` | `false` | `true` only on the VM, behind Caddy, so the request limits count each visitor's own address. Keep `false` on your PC. |
| `COOKIE_SECURE` | `false` | `true` only on the HTTPS server. |
| `PUBLIC_URL` | `http://localhost:5173` | Password reset links point here. |
| `SMTP_HOST`, `SMTP_PORT` | `localhost`, `1025` | Mailpit. For Gmail, see step 9. |
| `SMTP_USER`, `SMTP_PASSWORD` | empty | Only for a real email service. |
| `EMAIL_FROM` | `EVLOS <evlos@localhost>` | The sender shown on every email. |

`.env` holds passwords, so it is never committed (it is in `.gitignore`).

## 5. Create the tables

```bash
npm run db:setup
```

This builds the code and applies every migration in `apps/api/migrations` to both `evlos` and `evlos_test`. It is safe to run again: migrations already applied are skipped. Run it again after every `git pull` that brings a new migration.

## 6. Check that everything works

```bash
npm test             # about 1,100 tests: rules, server, database, pages
npm run lint
npm run typecheck
```

All three should finish without an error. The database tests use `evlos_test` only.

## 7. Create the Rector's login

There is no sign-up page: a Rector's login is created from the command line, by whoever runs the server.

```bash
npm run rector:create -- rector@example.com
```

It asks for the password twice, at a hidden prompt, so the password never appears on screen, in the shell history, in `.env` or in the code:

```
Password (at least 12 characters):
Type it again:
The Rector can now log in with this email.
```

- **The login is the email address.** It is stored trimmed and in lower case, so `Rector@Example.com` and `rector@example.com` are the same login. Each Rector also gets a numeric id automatically; you never type it.
- **The password** needs at least 12 characters. Only an Argon2 hash of it is stored.
- The command refuses, and saves nothing, when the email is not an email address, the password is too short, the two passwords differ, or the email already has a login.
- Use a real inbox the Rector reads: a forgotten password is reset through a link sent to it.

### More than one Rector

Yes. Run the command again with another email, once per person:

```bash
npm run rector:create -- warden.assistant@example.com
```

Each Rector has their own password, their own logins and their own "Forgot password?" link, and every change they make is recorded in the audit log under their own email. They all see and change the same Students, Leaves, Days and Settings: there are no roles, so every Rector can do everything. Changing one Rector's password ends only that Rector's other logins.

There is no command to remove a Rector or change their email. Ask the developer to do it in the database.

### Changing or resetting a password

- **Known password:** log in, open *Settings* (beside *Log out*), and use *Change password*.
- **Forgotten password:** on the login page click *Forgot password?* and type the login email. A link that works once, for 30 minutes, is emailed to it. This needs working email (step 9) and `PUBLIC_URL`.
- **Locked out, and the link cannot help** (email is not working, or the Rector no longer reads that inbox): whoever runs the server sets a new password from the command line:

  ```bash
  npm run rector:password -- rector@example.com
  ```

  ```
  Password (at least 12 characters):
  Type it again:
  The password is changed. Every login of this Rector has ended.
  ```

  The new password is typed twice at a hidden prompt, with the same rules as when the login was created. Every login of that Rector ends, any reset link still open stops working, and the audit log records a Reset Password done from the command line. It refuses, changing nothing, when no Rector logs in with that email, the password is too short or the two differ. Tell the Rector the new password in person, and ask them to change it on the *Settings* page.

## 8. Start the backend and the frontend

Use two terminals, both in the `EVLOS` folder.

```bash
npm run dev          # terminal 1: the backend
```

It logs that it listens on port 8081 (Device) and 3000 (page API). Warnings at start tell you what is not set up yet, such as "No Report Recipients yet". Keep it running: it also sends the scheduled emails (23:00 Review Reminder, 23:30 Daily Report, 09:00 Monthly Report on the 1st).

```bash
npm run dev:web      # terminal 2: the frontend
```

Open **http://localhost:5173** and log in with the Rector's email and password.

To stop either one, press `Ctrl+C` in its terminal.

## 9. Email

**Locally, with Mailpit (no real inbox is reached):** start Mailpit (on Windows, run `mailpit.exe`) and open http://localhost:8025. The settings in `.env.example` already point at it, so every email EVLOS sends appears there.

**Real emails, with Gmail:**
1. Turn on 2-Step Verification for the Gmail account, then create an app password at https://myaccount.google.com/apppasswords.
2. In `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your.address@gmail.com
   SMTP_PASSWORD=the 16-character app password, without spaces
   EMAIL_FROM=EVLOS <your.address@gmail.com>
   ```
3. Check them: `npm run email:test -- you@example.com`. It sends one test email and touches no database.
4. Restart `npm run dev`.

Real emails go to Students only after the hostel agrees in writing. Until then, use test addresses.

**Who receives the Reports:** log in, open *Settings*, and add each address under *Report Recipients*. With an empty list, no Review Reminder, Daily Report or Monthly Report is sent.

## 10. Add Students

- **One at a time:** on the *Students* page, with the form.
- **The first load of many:** save the Rector's list as "CSV UTF-8" with the columns of `sample-roster.csv`, then:
  ```bash
  npm run students:load -- students.csv           # checks every row, saves nothing
  npm run students:load -- students.csv --save    # saves all Students, or none
  ```
  Delete the file afterwards: it holds personal data. Never commit it.

## 11. Connect the fingerprint Device

The Device pushes Punches to the backend over plain HTTP on port 8081.

1. **Same network.** The Device and this machine must be on the same Wi-Fi. Find this machine's address with `ipconfig` (Windows) or `ip addr` (Linux), for example `192.168.1.20`.
2. **Let the Device in.** On Windows, allow port 8081 through the firewall once (PowerShell as administrator):
   ```powershell
   New-NetFirewallRule -DisplayName "EVLOS Device" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow
   ```
3. **Point the Device at EVLOS.** In the Device's menu, set its Cloud server (ADMS) address to this machine's address and port `8081`.
4. **Register the Device.** EVLOS refuses uploads from a Device Serial it does not know. Find the serial in the Device's System Info, or in the backend's log line "refused an unregistered Device Serial". Then, in psql connected to `evlos`:
   ```sql
   INSERT INTO devices (device_serial, label) VALUES ('YOUR-DEVICE-SERIAL', 'Pooja Device');
   ```
5. **Check.** Within a minute the live view shows "Device last seen …" with the current time, and a Punch appears there within seconds of a finger on the Device.

## Everyday commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the backend. |
| `npm run dev:web` | Start the frontend at http://localhost:5173. |
| `npm run db:setup` | Apply new migrations to both databases. |
| `npm run rector:create -- <email>` | Create a Rector's login. |
| `npm run rector:password -- <email>` | Set a new password for a locked-out Rector. |
| `npm run students:load -- <file.csv> [--save]` | First load of Students. |
| `npm run email:test -- <email>` | Check the email settings. |
| `npm test` | Run every test. |
| `npm run lint` / `npm run typecheck` / `npm run format` | Code checks and formatting. |
| `npm audit --omit=dev` | Check the packages the server runs for known security problems. `npm audit` also checks the development tools. |

## When something goes wrong

| What you see | What to do |
|--------------|------------|
| `password authentication failed for user "evlos"` | The password in `DATABASE_URL` or `TEST_DATABASE_URL` does not match step 3. |
| `database "evlos_test" does not exist` | Create it (step 3), then run `npm run db:setup`. |
| The tests refuse to run against a database | `TEST_DATABASE_URL` must end in `/evlos_test`. This protects your real data. |
| `EADDRINUSE` on 3000, 8081 or 5173 | Another program, or an old EVLOS still running, uses that port. Stop it, or change `PAGE_PORT` / `DEVICE_PORT` in `.env`. |
| The page says the server cannot be reached | Start `npm run dev`, and keep both terminals open. |
| A column or table is missing after `git pull` | Run `npm run db:setup`. |
| No email arrives | Check `SMTP_HOST` (and run `npm run email:test`), make sure Mailpit or Gmail is set up, and for Reports that a Report Recipient is added in Settings. Look in spam. |
| The live view says the Device was never seen | Check its Cloud server address, that it is registered (step 11), the firewall rule, and that both are on the same Wi-Fi. |
| A password reset link does not arrive | Email must work (step 9), `PUBLIC_URL` must be set, and the email typed must be the Rector's login. The page answers the same for any email, on purpose. If email cannot be fixed quickly, use `npm run rector:password -- <email>` (step 7). |
