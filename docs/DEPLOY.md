# DEPLOY

How EVLOS runs on the Google Cloud VM, written from what was actually done on 8 and 9 Nov 2026. Everything here is a command you can copy. For local development use `docs/SETUP.md`. To run another project on the same VM, read `docs/VM_MULTI_PROJECT.md` first.

## 1. What runs where

```
Rector's browser ── https://evlos.34-55-12-141.sslip.io ──┐
Device ───────────── http://34.55.12.141:8081 ─────────────┤
                                                           ▼
                         VM evlos-server (34.55.12.141)
   ┌─ edge Caddy (ports 80, 443): HTTPS certificate, sends each name to a project
   │        ├─ /api/public...  → evlos-api :3001   (Public Live View, no login)
   │        ├─ /api/...        → evlos-api :3000   (Rector's page API, login)
   │        └─ everything else → evlos-web :80     (the built page files)
   ├─ evlos-api    the server: Device on 8081, page API, Public Live View, the schedule loop
   ├─ evlos-web    the built page, served as plain files
   └─ evlos-postgres-1   PostgreSQL 16, data in the Docker volume `evlos_evlos-db`
```

Only ports 80, 443 and 8081 are open to the internet. The page API (3000), the Public Live View (3001) and PostgreSQL are reachable only inside Docker.

| Part | Choice | Why |
|------|--------|-----|
| Address | `evlos.34-55-12-141.sslip.io` | Caddy can only get a free HTTPS certificate for a name, not for a bare IP. sslip.io turns any name that contains the IP into that IP and needs no sign-up. DuckDNS was considered and not used. A Vercel rewrite that fetches the pages from the VM was also not used, because its last hop would be unencrypted; a Vercel redirect to the HTTPS name is used for a short address (section 10). |
| Images | Built on the VM with `docker compose build` | A first deployment needs no registry. If a build is ever killed for lack of memory, build on the PC or in GitHub Actions instead. |
| Updates | By hand (section 8) | One small VM and one author; a deploy pipeline was cut from Phase 6. |
| Versions | Node 22.23.4, PostgreSQL 16.15, Caddy 2.11.9 | Pinned exactly in `Dockerfile` and both `docker-compose.yml` files. |

## 2. The Google Cloud VM (Always Free)

The aim is to pay nothing. These settings keep the VM inside the Always Free limits:

| Setting | Value |
|---------|-------|
| Project | `evlos` (the default "My First Project", renamed) |
| Region and zone | `us-central1`, `us-central1-a` (only `us-west1`, `us-central1` and `us-east1` are free) |
| Machine | E2, `e2-micro` (2 vCPU shared, 1 GB), provisioning model Standard (not Spot) |
| Boot disk | Ubuntu 24.04 LTS x86/64, **Standard persistent disk**, 30 GB (not Balanced, not SSD) |
| Backups, snapshots | Off. A snapshot schedule is not free and the console attaches one by default: remove it. |
| Ops Agent | Not installed (it uses memory and sends logs that can be billed) |
| Firewall | HTTP and HTTPS ticked at creation, plus the rule `evlos-device`: ingress, TCP 8081, tag `http-server` |
| IP address | The VM's external IP promoted to static (`evlos-ip`, 34.55.12.141) and kept attached; an unattached static IP is billed |

Notes:
- The console's "Monthly estimate" shows the full price (about $6 a month) because it does not subtract the Always Free allowance. The real check is Billing, Reports a day or two later, which should show 0.
- Traffic from the VM to India is not covered by the free 1 GB a month (that covers North America). EVLOS sends very little, so expect paise at most.
- A budget of ₹10 a month with alerts at 50%, 90%, 100% and 150% is set under Billing, Budgets and alerts.
- India asks for a ₹1,000 prepayment before a free trial. It is credited to the account.

## 3. Prepare the VM

Connect with the **SSH** button in Compute Engine, VM instances. Then:

**Swap (2 GB), so a memory spike slows the VM instead of killing a program**

```
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
sudo sysctl --system
free -m
```

`free -m` must show about 2047 in the Swap row, and still does after a reboot.

**Docker and Compose, from Docker's own package source**

```
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
```

Type the `echo "deb ..."` line in full. A shortened `[...]` is written into the file as it is and `apt` then refuses to read it. Close the SSH window and open it again, so `docker ps` works without `sudo`. Check with `docker --version`, `docker compose version` and `docker run --rm hello-world`.

**The code**

```
sudo apt-get install -y git
git clone https://github.com/dhrumil92/EVLOS.git
```

## 4. Settings

```
cd ~/EVLOS/deploy
cp .env.example .env
chmod 600 .env
openssl rand -hex 16
nano .env
```

Put the random string in `POSTGRES_PASSWORD` (letters and digits only; Compose would read a `$`). Fill in `SMTP_USER`, `SMTP_PASSWORD` (the 16-character Google app password, no spaces) and `EMAIL_FROM`. Use the same Gmail address in `EMAIL_FROM` as in `SMTP_USER`: Gmail replaces any other sender address with the account that logged in. Leave `PUBLIC_URL=https://evlos.34-55-12-141.sslip.io`. `.env` is never committed, and its contents must never be pasted into a chat or an issue.

## 5. Start

**The front Caddy first.** It creates the shared network `edge`.

```
cd ~/EVLOS/deploy/edge
docker compose up -d
```

**Build the images** (about 10 minutes on this VM; the first `api` build can take longer)

```
cd ~/EVLOS/deploy
docker compose build api
docker compose build web
```

**The database, the tables and the Rector**

```
docker compose up -d postgres
docker compose ps
docker compose run --rm api node apps/api/dist/db/migrate-cli.js
docker compose run --rm api node apps/api/dist/create-rector.js the.rector@example.com
```

Wait for `postgres` to show `(healthy)` before the migration. The Rector's password is typed twice at a hidden prompt and needs at least 12 characters.

**Everything**

```
docker compose up -d
docker compose ps
docker compose logs --tail 30 api
```

Open `https://evlos.34-55-12-141.sslip.io`: the login page appears with the padlock. `/live` (the Public Live View) loads without a login.

**More Rector logins, and a forgotten password.** The same two scripts as on the PC (`npm run rector:create` and `npm run rector:password`), run inside the container. Each asks for the password at a hidden prompt, needs at least 12 characters, and never writes it to `.env` or the shell history.

```
cd ~/EVLOS/deploy
docker compose run --rm api node apps/api/dist/create-rector.js another.rector@example.com
docker compose run --rm api node apps/api/dist/set-rector-password.js the.rector@example.com
```

The first adds a login for another Rector. The second sets a new password for a Rector who is locked out and cannot use the emailed reset link (which needs `PUBLIC_URL` and the Gmail settings in `deploy/.env`); it ends every login of that Rector and closes any open reset link.

## 6. The Device

1. Register its serial number (from the Device's System Info). EVLOS refuses uploads from any other serial.

   ```
   docker compose exec postgres psql -U evlos -d evlos -c "INSERT INTO devices (device_serial, label) VALUES ('YOUR-DEVICE-SERIAL', 'Pooja Device');"
   ```

2. On the Device, set the Cloud server (ADMS) address to `34.55.12.141` and the port to `8081`. The Device needs internet access now, because the server is no longer on the hostel network. A hostel router that blocks outgoing connections to port 8081 would stop it.
3. Within a minute the Rector's page shows the Device as seen (Last Seen).

**Testing without the Device** (run on a PC, in PowerShell; it checks the firewall, the port and the registration)

```
curl.exe "http://34.55.12.141:8081/iclock/cdata?SN=YOUR-DEVICE-SERIAL"
curl.exe -i "http://34.55.12.141:8081/iclock/cdata?SN=WRONG123"
curl.exe -X POST "http://34.55.12.141:8081/iclock/cdata?SN=YOUR-DEVICE-SERIAL&table=ATTLOG" --data-binary "TEST0001`t2026-11-08 06:00:00`t0`t1"
```

The first prints the Device options, the second `403 Forbidden`, the third `OK: 1`. The stored Punch for 06:00 IST read back as `00:30:00+00` in PostgreSQL, so the IST conversion is right. Then remove the test data:

```
docker compose exec postgres psql -U evlos -d evlos -c "DELETE FROM punches WHERE student_id = 'TEST0001';"
docker compose exec postgres psql -U evlos -d evlos -c "UPDATE devices SET last_seen_at = NULL WHERE device_serial = 'YOUR-DEVICE-SERIAL';"
```

## 7. The Students

The container has no CSV file on purpose (`.dockerignore` blocks `*.csv`), so pass the Rector's file in from the host. Not yet tried on the VM: check first without `--save`.

```
chmod 644 ~/roster.csv
docker compose run --rm -v ~/roster.csv:/tmp/roster.csv api node apps/api/dist/load-students.js /tmp/roster.csv
docker compose run --rm -v ~/roster.csv:/tmp/roster.csv api node apps/api/dist/load-students.js /tmp/roster.csv --save
rm ~/roster.csv
```

Real Student data never goes into the repository, and real emails to Students start only after the Rector agrees in writing.

## 8. Updating the VM

```
cd ~/EVLOS
git pull
cd deploy
docker compose up -d --build
docker compose run --rm api node apps/api/dist/db/migrate-cli.js
```

Run the migration only when the update added one (`apps/api/migrations`); it skips those already applied. A rebuild restarts the API, so do it when no Day is being finalized.

## 9. After a restart

All four containers carry `restart: unless-stopped`, and Docker starts with the VM. Stopping and starting the VM from the console on 9 Nov brought the edge Caddy, the API, the web page and PostgreSQL back with no manual step, with the same static IP and the swap file in place.

## 10. The short address

`evlos.vercel.app` is easier to remember than `evlos.34-55-12-141.sslip.io`, so a redirect page on Vercel forwards to it:

| Open | Goes to |
|------|---------|
| `evlos.vercel.app` | `https://evlos.34-55-12-141.sslip.io/` (the Rector's page) |
| `evlos.vercel.app/live` | `https://evlos.34-55-12-141.sslip.io/live` (the Public Live View) |

- It is a separate repository, `evlos-redirect` (two files: `index.html` and `vercel.json`), imported into a Vercel project named `evlos`. It is not part of this repository.
- It is a browser redirect, so nothing from EVLOS passes through Vercel: the login and every page are served by the VM over HTTPS. If Vercel were down, the sslip.io address would still work.
- sslip.io is still needed. Caddy gets its HTTPS certificate for that name, and the redirect only points to it.
- Vercel Web Analytics (switched on in the Vercel project, Analytics) counts visits to the short address: visitors, page views, countries and devices. It cannot see what happens on the VM after the redirect.
- If the VM's IP ever changes, change the `destination` line in `index.html` and the name in `deploy/edge/Caddyfile` and `deploy/.env` (`PUBLIC_URL`).
- `PUBLIC_URL`, and so the link in a password reset email, stays on the sslip.io address: the short one would only add a redirect.
- The Rector should bookmark the short address. A bookmark of the long one skips Vercel and is not counted.

## 11. Checking and troubleshooting

| What | Command or place |
|------|------------------|
| Are the containers up? | `docker ps` |
| Memory | `free -m` (about 470 MB available with EVLOS running) and `docker stats --no-stream` |
| The API's log | `cd ~/EVLOS/deploy && docker compose logs --tail 50 api` |
| The front Caddy's log | `cd ~/EVLOS/deploy/edge && docker compose logs --tail 50 caddy` |
| Is it serving? | `https://evlos.34-55-12-141.sslip.io/api/public/live` answers with numbers, no login. It reads the database, so it also shows that Caddy, the API and PostgreSQL work. It is the address for an uptime monitor. |
| Cost | Billing, Reports; the ₹10 budget alert emails on any charge |

| Symptom | Cause |
|---------|-------|
| 502 in the Caddy log, `lookup evlos-web` or `evlos-api` | That container is not running, or the edge network is missing. Start the edge Caddy first, then `docker compose up -d`. |
| `network edge declared as external, but could not be found` | The edge Compose project was never started. |
| Build says `Killed` or exit 137 | Out of memory. Build one image at a time, and check swap with `free -m`. |
| `permission denied` on `docker ps` | The `docker` group needs a new login. Close and reopen SSH. |
| The page loads but login fails with no error | `COOKIE_SECURE=true` needs the HTTPS address; open the page by the `https://` name, not by the IP. |
| Bots ask for `/.env`, `/wp-config.php`, `/.git/HEAD` | Every public IP gets this. The images hold only what the Dockerfile copies in, so there is nothing to find. |

## 12. Not done yet

- A nightly database backup. There are no snapshots, so until it exists one disk failure loses the data.
- The Device at the Pooja location, with real Punches.
- The Rector's real Students.
