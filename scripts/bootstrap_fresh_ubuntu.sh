#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="serverroom"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
VENV_DIR="${PROJECT_DIR}/.venv"

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
  TARGET_USER="${SUDO_USER:-root}"
else
  SUDO="sudo"
  TARGET_USER="${USER}"
fi

run_as_target_user() {
  local cmd="$1"
  if [[ "$(id -u)" -eq 0 && "$(id -un)" != "${TARGET_USER}" ]]; then
    su - "${TARGET_USER}" -c "${cmd}"
  else
    bash -lc "${cmd}"
  fi
}

echo "[1/9] Installing Docker and Compose dependencies..."
${SUDO} apt-get update
${SUDO} apt-get install -y ca-certificates curl gnupg lsb-release docker.io docker-compose-plugin || \
  ${SUDO} apt-get install -y ca-certificates curl gnupg lsb-release docker.io docker-compose-v2

echo "[2/9] Installing Python runtime and tooling..."
${SUDO} apt-get install -y python3 python3-venv python3-pip

echo "[3/9] Creating Python virtual environment at ${VENV_DIR}..."
run_as_target_user "python3 -m venv '${VENV_DIR}'"

echo "[4/9] Installing backend Python requirements into ${VENV_DIR}..."
run_as_target_user "'${VENV_DIR}/bin/pip' install --upgrade pip"
run_as_target_user "'${VENV_DIR}/bin/pip' install -r '${PROJECT_DIR}/backend/requirements.txt'"

echo "[5/9] Enabling Docker service..."
${SUDO} systemctl enable --now docker

echo "[6/9] Ensuring user has docker group membership..."
if id -u "${TARGET_USER}" >/dev/null 2>&1; then
  ${SUDO} usermod -aG docker "${TARGET_USER}" || true
fi

echo "[7/9] Verifying Docker Compose command..."
${SUDO} docker compose version >/dev/null

echo "[8/9] Writing systemd unit for auto-start on reboot..."
${SUDO} tee "${SERVICE_FILE}" > /dev/null <<EOF
[Unit]
Description=Serverroom Visualizer Stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${PROJECT_DIR}
ExecStart=/usr/bin/docker compose up -d --build
ExecStop=/usr/bin/docker compose down
RemainAfterExit=yes
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

echo "[9/9] Enabling and starting ${SERVICE_NAME}.service..."
${SUDO} systemctl daemon-reload
${SUDO} systemctl enable --now "${SERVICE_NAME}.service"

echo "Deployment status"
${SUDO} systemctl --no-pager --full status "${SERVICE_NAME}.service" | sed -n '1,20p'
${SUDO} docker compose -f "${PROJECT_DIR}/docker-compose.yml" ps

echo

echo "Serverroom Visualizer v0.8 has been initialized."
echo "App URL: http://<server-ip>:8000"
echo "Python venv: ${VENV_DIR}"
echo "Activate with: source ${VENV_DIR}/bin/activate"
echo "If this was your first run on this shell, re-login to refresh docker group membership."
