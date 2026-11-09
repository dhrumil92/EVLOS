# Running more than one project on the VM

How the GCP VM `evlos-server` (e2-micro, 1 GB RAM, us-central1-a, static IP `34.55.12.141`) is set up so that EVLOS and later projects share it. Read this before adding a project. For EVLOS's own deployment, see `docs/DEPLOY.md`.

## The idea in one picture

```
browser ── https://evlos.34-55-12-141.sslip.io ──┐
browser ── https://app2.34-55-12-141.sslip.io  ──┤
                                                 ▼
                      VM 34.55.12.141, ports 80 and 443
                      ┌────────────────────────────────┐
                      │ edge Caddy (its own Compose)   │  gets the HTTPS certificates
                      └───────────┬────────────────────┘
                     shared Docker network "edge"
              ┌───────────────────┼───────────────────┐
        evlos-web / evlos-api              app2-web / app2-api
        (EVLOS Compose project)            (project 2 Compose project)
```

- **One Caddy owns ports 80 and 443.** No project publishes those ports itself.
- **The name in the browser picks the project.** Every name below resolves to the same IP.
- **sslip.io is only DNS.** `anything.34-55-12-141.sslip.io` resolves to `34.55.12.141`. Nothing to register. Caddy gets a Let's Encrypt certificate for each name by itself.
- **Projects reach each other's front only through Caddy.** Each project keeps its own database, its own Compose file and its own `.env`.

## Where things are

| What | Where on the VM |
|------|-----------------|
| Code, cloned from GitHub | `~/EVLOS` |
| Edge Caddy (Compose and Caddyfile) | `~/EVLOS/deploy/edge` (move to `~/edge` when project 2 arrives, see below) |
| EVLOS Compose project | `~/EVLOS/deploy` (`docker-compose.yml`, real settings in `.env`, never committed) |
| Shared Docker network | `edge`, created by the edge Compose project |
| Plain-HTTP port for the Device | 8081, opened by the GCP firewall rule `evlos-device` |

## Adding a project: checklist

1. **Memory first.** Run `free -m` and `docker stats --no-stream`. The VM has about 950 MB, plus 2 GB of swap that is only a safety net. EVLOS limits: postgres 200 MB, api 250 MB, web 32 MB, Caddy 64 MB. Give the new project limits too (`mem_limit`) and add them up before starting it.
2. **Name.** Pick `<project>.34-55-12-141.sslip.io`.
3. **Compose file of the new project.**
   - Give each container a unique `container_name`, such as `app2-api`. Never reuse `evlos-api`.
   - Join the shared network:
     ```yaml
     services:
       api:
         networks: [default, edge]
     networks:
       edge:
         external: true
     ```
   - Do **not** publish ports 80 or 443. Publish a port only when something outside must reach it directly (like the Device on 8081), and then open that port in the GCP firewall (VPC network, Firewall rules, TCP, tag `http-server`).
   - Use its own database and user. Never share EVLOS's Postgres.
   - Give it its own backup. `deploy/backup.sh` and its cron line cover only EVLOS's database.
4. **Edge Caddyfile.** Add a block:
   ```
   app2.34-55-12-141.sslip.io {
       reverse_proxy app2-api:4000
   }
   ```
5. **Reload Caddy, no restart needed:**
   ```
   cd ~/EVLOS/deploy/edge
   docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
   ```
6. **Check.** Open the new name in a browser (padlock, no warning). If it fails: `docker compose logs --tail 30 caddy`.

## Moving the edge folder out of the EVLOS repo (do this with project 2)

The edge Caddy serves every project, so its files should not live in EVLOS's repo. The Compose project name is fixed to `edge` in the file, so the certificate volume is kept.

```
mkdir ~/edge
cp ~/EVLOS/deploy/edge/docker-compose.yml ~/EVLOS/deploy/edge/Caddyfile ~/edge/
cd ~/EVLOS/deploy/edge && docker compose down
cd ~/edge && docker compose up -d
```

Then remove `deploy/edge` from the EVLOS repo in a commit, and give `~/edge` its own git repository if you want it versioned.

## Things that go wrong

- **502 Bad Gateway in the Caddy log, `lookup <name> ... misbehaving`.** The container is not running, or it is not on the `edge` network, or the name in the Caddyfile does not match its `container_name`.
- **`network edge declared as external, but could not be found`.** Start the edge Compose project first.
- **Port already allocated.** Two things try to publish the same port. Pick another one, and open it in the GCP firewall.
- **Killed or exit 137 during a build.** Out of memory. Build one service at a time, check `free -m`, and consider building on another machine.
- **Bots in the logs** (`/.env`, `/wp-config.php`, `/.git/HEAD`). Normal for any public IP. They get 502 or the page, never a file, because an image holds only what the Dockerfile copies in. Keep secrets out of images (`.dockerignore`).

## Cost reminder (Always Free)

One e2-micro in a US free region, a 30 GB standard disk, no snapshots, no Ops Agent, a static IP kept attached. Extra projects on the same VM cost nothing. A second VM or an SSD disk would not be free. Check Billing, Reports after any change.
