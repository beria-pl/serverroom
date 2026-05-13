# Serverroom Visualizer v0.9.260513

Kubernetes-ready web application for serverroom visualization and asset tracking with LDAP authentication.

## Implemented Features

- LDAP login via username/password and JWT session token.
- Local users stored in database, including admin-managed user creation.
- Time-based One-Time Password (TOTP) 2FA for local users.
- Device search results with automatic focus to matching rack and device.
- Excel export of device inventory with formatted headers and data.
- PostgreSQL persistence.
- Dedicated login screen before app workspace becomes visible.
- Multiple serverrooms with switching support.
- Floorplan creation with rack placement and drag-move interaction (top-view rack footprint).
- Rack naming and geometry updates.
- Device assignment to rack by U position and U height with overlap prevention.
- Drag and drop devices into rack U slots.
- Mount side tracking (front/back) for each device.
- Inventory templates (built-in and custom) with front image support.
- Inventory manager is hidden behind top menu and provides list + preview + quick add to selected rack.
- Built-in templates include Dell/HPE servers and Cisco/Brocade switches.
- Double-click rack device block to edit operational metadata (mgmt IP, hostname, host IP, SSH endpoint, serial, notes).
- Device archiving (soft-delete) with searchable archive status.
- Audit trail for create/update/delete changes.
- Demo seeding: each serverroom gets a floorplan with 2 rows x 8 racks and sample device data.
- Dark mode toggle with persistent local storage.
- Responsive design with resizable left/right panels.
- GitHub Actions CI pipeline with Docker build and smoke test
- Demo seeding: each serverroom gets a floorplan with 2 rows x 8 racks and sample device data.

## Stack

- Backend: FastAPI + SQLAlchemy
- Frontend: Static HTML/CSS/JavaScript
- Database: PostgreSQL
- Auth: LDAP bind + JWT
- Runtime: Docker / Kubernetes

## Prerequisites (Ubuntu VM)

Install required tools:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo snap install kubectl --classic
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Then re-login to apply `docker` group membership.

Verify:

```bash
docker --version
docker compose version
kubectl version --client
```

## Fresh Ubuntu Bootstrap (Recommended)

For a brand new Ubuntu server, use the included bootstrap script from the project root:

```bash
bash scripts/bootstrap_fresh_ubuntu.sh
```

What it does:

- Installs Docker and Docker Compose.
- Installs Python 3, `venv`, and `pip`.
- Creates project virtual environment in `.venv`.
- Installs backend requirements from `backend/requirements.txt` into `.venv`.
- Enables Docker service.
- Builds and starts the stack with Docker Compose.
- Creates and enables a systemd unit named `serverroom.service`.
- Ensures the app starts automatically after VM reboot.

Check status:

```bash
sudo systemctl status serverroom.service
sudo docker compose ps
source .venv/bin/activate
```

## Local Run (Docker Compose)

```bash
docker compose up --build
```

App URL: http://localhost:8000

If running in a VM and accessing from host machine:

```bash
hostname -I
```

Use `http://<VM_IP>:8000` from your host browser.

First startup automatically creates local admin user:

- username: `admin`
- password: `admin12345`

These can be changed via `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD`.

## Kubernetes Deployment

1. Build and push image:

```bash
docker build -t your-registry/serverroom:latest ./backend
docker push your-registry/serverroom:latest
```

2. Create secret from template:

```bash
cp k8s/secret.example.yaml k8s/secret.yaml
# edit values inside k8s/secret.yaml
```

3. Apply manifests:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -k k8s
```

4. Optional ingress:

```bash
kubectl apply -f k8s/ingress.example.yaml
```

## LDAP Notes

Set these values for your LDAP/AD environment:

- LDAP_ENABLED
- LDAP_SERVER_URI
- LDAP_DOMAIN
- LDAP_BASE_DN

Current implementation uses direct bind with `username@LDAP_DOMAIN`.
Local users are always available and checked first during login. If local auth fails, LDAP auth is attempted when `LDAP_ENABLED=true`.

## API Overview

- `POST /api/auth/login`
- `GET/POST /api/serverrooms`
- `GET/POST /api/device-models`
- `GET/POST/PUT /api/floorplans`
- `POST/PUT/DELETE /api/racks`
- `POST/PUT/DELETE /api/devices`
- `POST /api/devices/{id}/archive` (remove from rack and keep archived in inventory)
- `GET /api/audit`

## GitHub Actions (CI)

Repository includes CI workflow at `.github/workflows/ci.yml`.

It runs on push/PR to `main` and manually (`workflow_dispatch`), and performs:

- Python dependency install (`backend/requirements.txt`)
- Python syntax validation for `backend/app`
- Docker Compose build/start
- HTTP smoke test on `http://127.0.0.1:8000/`

You can view runs in GitHub: **Actions** tab -> **CI** workflow.

## CSV Import Notes

- Inventory CSV supports `mount_side` (aliases: `side`, `position`) with values `front` or `back`.
- `mount_side` is case-insensitive during import (for example `Front`, `BACK`).
- If `mount_side` is missing/invalid, defaults are applied: `back` for `switch`, `front` for all other device types.
- Layout CSV maps serial numbers to rack + U position and uses the imported inventory `mount_side` for rendering and overlap validation.
- Archived inventory devices cannot be assigned from layout import.

## Archive Behavior

- Archiving a rack device removes it from rack layout but keeps it in `inventory_devices` with `archived=1`.
- Archived devices appear in search as archived entries.
- Archived serial numbers are blocked from manual rack assignment and layout CSV placement.

## Next Improvements

- Role-based authorization (admin/editor/viewer).
- Full rack U-level visual editor and overlap validation.
- Import/export of floorplans.
- Multi-room support and advanced filtering.
- Alembic migrations instead of automatic table creation.
