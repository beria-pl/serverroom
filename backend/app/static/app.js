const state = {
  token: null,
  username: null,
  role: null,
  authSource: null,
  serverrooms: [],
  selectedServerroomId: null,
  floorplans: [],
  selectedFloorplanId: null,
  selectedRackId: null,
  deviceModels: [],
  inventoryDevices: [],
  dragRack: null,
  editingDeviceId: null,
  showLocalUsers: false,
  selectedDeviceModelId: null,
  darkMode: false,
  deviceDragInProgress: false,
};

const byId = (id) => document.getElementById(id);

const authStatus = byId("authStatus");
const floorSvg = byId("floorSvg");

function applyTheme() {
  document.body.classList.toggle("theme-dark", state.darkMode);
  const toggleBtn = byId("darkModeToggleBtn");
  if (toggleBtn) {
    toggleBtn.textContent = state.darkMode ? "Light Mode" : "Dark Mode";
  }
}

function initializeTheme() {
  const stored = window.localStorage.getItem("serverroom-theme");
  state.darkMode = stored === "dark";
  applyTheme();
}

function toggleTheme() {
  state.darkMode = !state.darkMode;
  window.localStorage.setItem("serverroom-theme", state.darkMode ? "dark" : "light");
  applyTheme();
}

function syncLayoutVisibility() {
  const layout = document.querySelector(".layout");
  const leftPanel = byId("leftPanel");
  const rightPanel = byId("rightPanel");
  const leftResizer = byId("leftResizer");
  const rightResizer = byId("rightResizer");
  if (!layout || !leftPanel || !rightPanel || !leftResizer || !rightResizer) {
    return;
  }

  const hasLeft = !leftPanel.hidden;
  const hasRight = !rightPanel.hidden;

  layout.classList.toggle("no-left", !hasLeft);
  layout.classList.toggle("no-right", !hasRight);

  leftResizer.hidden = !hasLeft;
  rightResizer.hidden = !hasRight;
}

function setupLayoutResizers() {
  const layout = document.querySelector(".layout");
  const leftResizer = byId("leftResizer");
  const rightResizer = byId("rightResizer");
  if (!layout || !leftResizer || !rightResizer) {
    return;
  }

  let active = null;
  let startX = 0;
  let startWidth = 0;

  const setWidthVar = (name, value) => {
    layout.style.setProperty(name, `${value}px`);
  };

  const onMove = (evt) => {
    if (!active) return;
    const delta = evt.clientX - startX;
    if (active === "left") {
      const next = Math.max(240, Math.min(540, startWidth + delta));
      setWidthVar("--left-panel-width", next);
    }
    if (active === "right") {
      const next = Math.max(280, Math.min(640, startWidth - delta));
      setWidthVar("--right-panel-width", next);
    }
  };

  const onUp = () => {
    active = null;
    document.body.style.userSelect = "";
  };

  leftResizer.addEventListener("pointerdown", (evt) => {
    active = "left";
    startX = evt.clientX;
    startWidth = byId("leftPanel")?.getBoundingClientRect().width || 320;
    document.body.style.userSelect = "none";
  });

  rightResizer.addEventListener("pointerdown", (evt) => {
    active = "right";
    startX = evt.clientX;
    startWidth = byId("rightPanel")?.getBoundingClientRect().width || 380;
    document.body.style.userSelect = "none";
  });

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function topMenuDetails() {
  return Array.from(document.querySelectorAll(".top-menu details"));
}

function closeTopMenus(except = null) {
  for (const details of topMenuDetails()) {
    if (except && details === except) continue;
    details.open = false;
  }
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  if (!headers["Content-Type"] && options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed: ${response.status}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function uploadCsv(path, fileInputId) {
  const input = byId(fileInputId);
  const file = input && input.files ? input.files[0] : null;
  if (!file) {
    throw new Error("Select a CSV file first");
  }

  const formData = new FormData();
  formData.append("file", file);

  const headers = {};
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    method: "POST",
    headers,
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `CSV import failed: ${response.status}`);
  }
  return payload;
}

function selectedFloorplan() {
  return state.floorplans.find((fp) => fp.id === state.selectedFloorplanId) || null;
}

function selectedRack() {
  const floorplan = selectedFloorplan();
  if (!floorplan) return null;
  return floorplan.racks.find((r) => r.id === state.selectedRackId) || null;
}

function selectedDevice() {
  const rack = selectedRack();
  if (!rack || !state.editingDeviceId) return null;
  return rack.devices.find((d) => d.id === state.editingDeviceId) || null;
}

function toggleAppLoggedIn(isLoggedIn) {
  byId("loginGate").hidden = isLoggedIn;
  byId("appShell").hidden = !isLoggedIn;
  syncLayoutVisibility();
}

function renderServerrooms() {
  const select = byId("serverroomSelect");
  select.innerHTML = "";
  for (const room of state.serverrooms) {
    const option = document.createElement("option");
    option.value = String(room.id);
    option.textContent = room.name;
    if (room.id === state.selectedServerroomId) {
      option.selected = true;
    }
    select.appendChild(option);
  }
}

function renderFloorplans() {
  const select = byId("floorplanSelect");
  select.innerHTML = "";
  for (const fp of state.floorplans) {
    const option = document.createElement("option");
    option.value = String(fp.id);
    option.textContent = `${fp.name} (${fp.width}x${fp.height})`;
    if (fp.id === state.selectedFloorplanId) {
      option.selected = true;
    }
    select.appendChild(option);
  }
}

function renderInventory() {
  const list = byId("inventoryTemplateList");
  const preview = byId("inventoryPreview");
  list.innerHTML = "";
  for (const item of state.deviceModels) {
    const card = document.createElement("div");
    card.className = "inventory-card";
    if (item.id === state.selectedDeviceModelId) {
      card.classList.add("active");
    }
    card.dataset.modelId = String(item.id);
    card.addEventListener("click", () => {
      state.selectedDeviceModelId = item.id;
      renderInventory();
    });

    card.innerHTML = `
      <img src="${item.image_url}" alt="${item.name}" />
      <div>
        <strong>${item.name}</strong>
        <div>${item.vendor} ${item.model_code}</div>
        <div>${item.device_type}, ${item.u_height}U</div>
      </div>
    `;
    list.appendChild(card);
  }

  const selected = state.deviceModels.find((m) => m.id === state.selectedDeviceModelId) || state.deviceModels[0] || null;
  if (selected && state.selectedDeviceModelId === null) {
    state.selectedDeviceModelId = selected.id;
  }

  if (!selected) {
    preview.innerHTML = "<p class='hint'>No templates in inventory yet.</p>";
    return;
  }

  const floorplan = selectedFloorplan();
  const rackOptions = (floorplan?.racks || [])
    .map((rack) => {
      const selected = rack.id === state.selectedRackId ? "selected" : "";
      return `<option value="${rack.id}" ${selected}>${rack.name}</option>`;
    })
    .join("");

  preview.innerHTML = `
    <img src="${selected.image_url}" alt="${selected.name}" />
    <div class="meta"><strong>${selected.name}</strong></div>
    <div class="meta">${selected.vendor} ${selected.model_code}</div>
    <div class="meta">Type: ${selected.device_type} | Height: ${selected.u_height}U</div>
    <div class="meta" style="margin-top: 8px;">Target Rack</div>
    <div class="row" style="margin-top: 4px;">
      <select id="inventoryTargetRackSelect" style="width: 100%;">
        ${rackOptions || "<option value=''>No racks available</option>"}
      </select>
    </div>
    <div class="row" style="margin-top: 10px;">
      <button id="addSelectedTemplateToRackBtn">Add To Selected Rack</button>
    </div>
  `;

  const addBtn = byId("addSelectedTemplateToRackBtn");
  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      try {
        const rackSelect = byId("inventoryTargetRackSelect");
        const targetRackId = rackSelect && rackSelect.value ? Number(rackSelect.value) : null;
        await addTemplateToSelectedRack(selected, targetRackId);
        authStatus.textContent = `Added ${selected.name} to rack successfully`;
      } catch (err) {
        authStatus.textContent = err.message;
      }
    });
  }
}

function findFirstFreeUPosition(rack, uHeight, mountSide = "front") {
  const occupancy = Array(rack.units + 1).fill(false);
  for (const d of rack.devices) {
    if ((d.mount_side || "front") !== mountSide) continue;
    const start = d.u_position;
    const end = d.u_position + d.u_height - 1;
    for (let u = start; u <= end && u <= rack.units; u += 1) {
      occupancy[u] = true;
    }
  }

  for (let start = 1; start <= rack.units - uHeight + 1; start += 1) {
    let fits = true;
    for (let u = start; u < start + uHeight; u += 1) {
      if (occupancy[u]) {
        fits = false;
        break;
      }
    }
    if (fits) return start;
  }
  return null;
}

async function addTemplateToSelectedRack(model, preferredRackId = null) {
  const floorplan = selectedFloorplan();
  if (!floorplan) {
    throw new Error("Select floorplan first");
  }

  let rack = null;
  if (preferredRackId) {
    rack = floorplan.racks.find((r) => r.id === preferredRackId) || null;
  }
  if (!rack) {
    rack = selectedRack();
  }
  if (!rack) {
    rack = floorplan.racks[0] || null;
  }
  if (!rack) {
    throw new Error("Create or select a rack first");
  }

  state.selectedRackId = rack.id;

  const mountSide = model.device_type === "switch" ? "back" : "front";
  const uPosition = findFirstFreeUPosition(rack, model.u_height, mountSide);
  if (!uPosition) {
    throw new Error("No free U space in selected rack");
  }

  await api("/api/devices", {
    method: "POST",
    body: JSON.stringify({
      rack_id: rack.id,
      name: model.name,
      device_type: model.device_type,
      u_position: uPosition,
      u_height: model.u_height,
      mount_side: mountSide,
      serial_number: "",
      management_ip: "",
      model: model.model_code,
      vendor: model.vendor,
      properties: { image_url: model.image_url },
      device_model_id: model.id,
    }),
  });
  await refreshData();
}

function buildRackDeviceLine(device) {
  const props = device.properties || {};
  const hostname = props.hostname || device.name;
  const serial = device.serial_number || "NO-SN";
  const model = (device.model || "Unknown").slice(0, 18);
  return `${hostname} ${serial} ${model}`;
}

function renderDevicesTable() {
  const tbody = byId("deviceTable").querySelector("tbody");
  tbody.innerHTML = "";
  const rack = selectedRack();
  byId("devicesTableTitle").textContent = rack ? `Devices in ${rack.name} Rack` : "Devices in Selected Rack";
  if (!rack) return;

  for (const d of rack.devices.sort((a, b) => a.u_position - b.u_position)) {
    const props = d.properties || {};
    const hostname = props.hostname || d.name || "-";
    const deviceLabel = `${d.vendor || ""} ${d.model || d.name}`.trim();
    const mountSide = d.mount_side || "front";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="device-cell-main">
          <strong>${hostname}</strong>
          <span class="sub">${d.serial_number || "NO-SN"}</span>
        </div>
      </td>
      <td>
        <div class="device-cell-main">
          <strong>${deviceLabel || d.name}</strong>
          <span class="sub"><span class="mount-side-dot ${mountSide}"></span>${d.device_type || "device"} | ${mountSide}</span>
        </div>
      </td>
      <td><span class="chip">U${d.u_position}-${d.u_position + d.u_height - 1}</span></td>
      <td>${d.management_ip || "-"}</td>
    `;
    row.addEventListener("click", () => {
      state.selectedRackId = rack.id;
      openDeviceModal(d.id);
    });
    tbody.appendChild(row);
  }
}

function renderDeviceSearchList() {
  const list = byId("deviceSearchList");
  const query = (byId("deviceSearchInput")?.value || "").trim().toLowerCase();
  const floorplan = selectedFloorplan();

  if (!list || !floorplan) {
    return;
  }

  const items = [];
  for (const rack of floorplan.racks) {
    for (const device of rack.devices) {
      const props = device.properties || {};
      const searchBlob = [
        device.name,
        device.model,
        device.vendor,
        device.serial_number,
        device.management_ip,
        props.hostname,
        rack.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (query && !searchBlob.includes(query)) {
        continue;
      }

      items.push({ rack, device, hostname: props.hostname || "-" });
    }
  }

  items.sort((a, b) => {
    if (a.rack.name === b.rack.name) {
      return a.device.u_position - b.device.u_position;
    }
    return a.rack.name.localeCompare(b.rack.name);
  });

  if (items.length === 0) {
    list.innerHTML = "";
  }

  if (items.length > 0) {
    list.innerHTML = "";
  }
  for (const item of items) {
    const node = document.createElement("div");
    node.className = "device-search-item";
    node.innerHTML = `
      <strong>${item.hostname}</strong>
      <div>${item.device.vendor || ""} ${item.device.model || item.device.name}</div>
      <div class="meta">Rack ${item.rack.name} | ${(item.device.mount_side || "front")} | U${item.device.u_position}-${item.device.u_position + item.device.u_height - 1} | ${item.device.serial_number || "NO-SN"}</div>
    `;
    node.addEventListener("click", () => {
      state.selectedRackId = item.rack.id;
      renderEverything();
    });
    list.appendChild(node);
  }

  const archivedMatches = (state.inventoryDevices || []).filter((inv) => {
    if (inv.archived !== 1) return false;
    const props = inv.properties || {};
    const searchBlob = [
      inv.name,
      inv.model,
      inv.vendor,
      inv.serial_number,
      inv.management_ip,
      props.hostname,
      "archived",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return !query || searchBlob.includes(query);
  });

  for (const inv of archivedMatches) {
    const node = document.createElement("div");
    node.className = "device-search-item archived";
    const props = inv.properties || {};
    node.innerHTML = `
      <strong>${props.hostname || inv.name || "-"}</strong>
      <div>${inv.vendor || ""} ${inv.model || inv.name}</div>
      <div class="meta">ARCHIVED | ${(inv.mount_side || "front")} | SN ${inv.serial_number || "NO-SN"}</div>
    `;
    list.appendChild(node);
  }

  if (items.length === 0 && archivedMatches.length === 0) {
    list.innerHTML = "<p class='hint'>No matching devices.</p>";
  }
}

function createRackNode(rack) {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("data-rack-id", String(rack.id));

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(rack.x));
  rect.setAttribute("y", String(rack.y));
  rect.setAttribute("width", String(rack.width));
  rect.setAttribute("height", String(rack.height));
  rect.setAttribute("rx", "5");
  rect.setAttribute("fill", rack.id === state.selectedRackId ? "var(--rack-selected)" : "var(--rack)");
  rect.setAttribute("stroke", "#073b4c");
  rect.setAttribute("stroke-width", "2");
  rect.style.cursor = "move";

  const topEdge = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  topEdge.setAttribute("x", String(rack.x + 2));
  topEdge.setAttribute("y", String(rack.y + 2));
  topEdge.setAttribute("width", String(Math.max(4, rack.width - 4)));
  topEdge.setAttribute("height", "6");
  topEdge.setAttribute("fill", "rgba(255,255,255,0.45)");

  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.classList.add("rack-label");
  label.setAttribute("x", String(rack.x + 4));
  label.setAttribute("y", String(rack.y + rack.height - 6));
  label.textContent = rack.name;

  rect.addEventListener("mousedown", (evt) => {
    state.selectedRackId = rack.id;
    state.dragRack = {
      rackId: rack.id,
      offsetX: evt.offsetX - rack.x,
      offsetY: evt.offsetY - rack.y,
    };
    renderEverything();
  });

  rect.addEventListener("click", () => {
    state.selectedRackId = rack.id;
    renderEverything();
  });

  group.appendChild(rect);
  group.appendChild(topEdge);
  group.appendChild(label);
  return group;
}

function renderCanvas() {
  const floorplan = selectedFloorplan();
  if (!floorplan) {
    floorSvg.innerHTML = "";
    return;
  }

  floorSvg.setAttribute("viewBox", `0 0 ${floorplan.width} ${floorplan.height}`);
  floorSvg.setAttribute("width", String(floorplan.width));
  floorSvg.setAttribute("height", String(floorplan.height));
  floorSvg.innerHTML = "";

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(floorplan.width));
  bg.setAttribute("height", String(floorplan.height));
  bg.setAttribute("fill", "rgba(255,255,255,0.2)");
  floorSvg.appendChild(bg);

  for (const rack of floorplan.racks) {
    floorSvg.appendChild(createRackNode(rack));
  }
}

function unitToGridStart(units, uPosition, uHeight) {
  return units - (uPosition + uHeight - 1) + 1;
}

function renderRackEditor() {
  const editor = byId("rackEditor");
  const title = byId("rackEditorTitle");
  editor.innerHTML = "";

  const rack = selectedRack();
  if (title) {
    title.textContent = rack ? `${rack.name} Rack U Layout` : "Rack U Layout";
  }
  if (!rack) {
    editor.innerHTML = "<p class='hint'>Select a rack to edit U placement.</p>";
    return;
  }

  const rackWrap = document.createElement("div");
  rackWrap.className = "rack-wrap";

  const leftScale = document.createElement("div");
  leftScale.className = "rack-scale";

  const rightScale = document.createElement("div");
  rightScale.className = "rack-scale";

  const grid = document.createElement("div");
  grid.className = "rack-grid";
  grid.style.gridTemplateRows = `repeat(${rack.units}, 22px)`;
  leftScale.style.gridTemplateRows = `repeat(${rack.units}, 22px)`;
  rightScale.style.gridTemplateRows = `repeat(${rack.units}, 22px)`;

  for (let u = rack.units; u >= 1; u -= 1) {
    const leftLabel = document.createElement("div");
    leftLabel.className = "rack-scale-label";
    leftLabel.textContent = `U${u}`;
    leftScale.appendChild(leftLabel);

    const rightLabel = document.createElement("div");
    rightLabel.className = "rack-scale-label";
    rightLabel.textContent = `U${u}`;
    rightScale.appendChild(rightLabel);

    const slot = document.createElement("div");
    slot.className = "rack-unit";
    slot.dataset.u = String(u);
    slot.addEventListener("dragover", (evt) => evt.preventDefault());
    slot.addEventListener("drop", async (evt) => {
      evt.preventDefault();
      const raw = evt.dataTransfer.getData("application/json");
      if (!raw) return;
      const payload = JSON.parse(raw);
      const droppedU = Number(slot.dataset.u);

      if (payload.kind === "model") {
        const model = state.deviceModels.find((m) => m.id === payload.modelId);
        if (!model) return;
        await api("/api/devices", {
          method: "POST",
          body: JSON.stringify({
            rack_id: rack.id,
            name: model.name,
            device_type: model.device_type,
            u_position: droppedU,
            u_height: model.u_height,
            mount_side: model.device_type === "switch" ? "back" : "front",
            serial_number: "",
            management_ip: "",
            model: model.model_code,
            vendor: model.vendor,
            properties: { image_url: model.image_url },
            device_model_id: model.id,
          }),
        });
        await refreshData();
      }

      if (payload.kind === "device") {
        const device = rack.devices.find((d) => d.id === payload.deviceId);
        if (!device) return;
        await api(`/api/devices/${device.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: device.name,
            device_type: device.device_type,
            u_position: droppedU,
            u_height: device.u_height,
            mount_side: device.mount_side || "front",
            serial_number: device.serial_number,
            management_ip: device.management_ip,
            model: device.model,
            vendor: device.vendor,
            properties: device.properties || {},
          }),
        });
        await refreshData();
      }
    });
    grid.appendChild(slot);
  }

  for (const d of rack.devices) {
    const block = document.createElement("div");
    block.className = "device-block";
    if ((d.mount_side || "front") === "back") {
      block.classList.add("back");
    }
    block.draggable = true;
    block.style.gridRow = `${unitToGridStart(rack.units, d.u_position, d.u_height)} / span ${d.u_height}`;
    block.style.gridColumn = "1";
    const summaryLine = buildRackDeviceLine(d);
    block.innerHTML = `
      <img src="${(d.properties && d.properties.image_url) || "/static/device-models/generic-device.svg"}" alt="${d.name}" />
      <span class="rack-device-line"><strong>${summaryLine}</strong></span>
    `;
    block.addEventListener("dragstart", (evt) => {
      state.deviceDragInProgress = true;
      evt.dataTransfer.setData("application/json", JSON.stringify({ kind: "device", deviceId: d.id }));
    });
    block.addEventListener("dragend", () => {
      // Delay reset so the click event generated after drag doesn't open the editor.
      setTimeout(() => {
        state.deviceDragInProgress = false;
      }, 0);
    });
    block.addEventListener("click", (evt) => {
      if (state.deviceDragInProgress) {
        return;
      }
      evt.preventDefault();
      evt.stopPropagation();
      openDeviceModal(d.id);
    });
    grid.appendChild(block);
  }

  rackWrap.appendChild(leftScale);
  rackWrap.appendChild(grid);
  rackWrap.appendChild(rightScale);
  editor.appendChild(rackWrap);
}

function openDeviceModal(deviceId) {
  state.editingDeviceId = deviceId;
  const device = selectedDevice();
  if (!device) {
    closeDeviceModal();
    return;
  }
  const props = device.properties || {};

  byId("modalDeviceName").value = device.name || "";
  byId("modalHostname").value = props.hostname || "";
  byId("modalMgmtIp").value = device.management_ip || "";
  byId("modalHostIp").value = props.host_ip || "";
  byId("modalSshEndpoint").value = props.ssh_endpoint || "";
  byId("modalSerial").value = device.serial_number || "";
  byId("modalUPosition").value = String(device.u_position || 1);
  byId("modalUHeight").value = String(device.u_height || 1);
  byId("modalMountSide").value = device.mount_side || "front";
  byId("modalModel").value = device.model || "";
  byId("modalNotes").value = props.notes || "";
  byId("deviceDockTitle").textContent = `Edit Device (${props.hostname || device.name || "selected"})`;
  byId("deviceDockEmpty").hidden = true;
  byId("deviceDockForm").hidden = false;
}

function closeDeviceModal() {
  state.editingDeviceId = null;
  byId("deviceDockTitle").textContent = "Device Editor";
  byId("deviceDockEmpty").hidden = false;
  byId("deviceDockForm").hidden = true;
}

async function saveDeviceModal() {
  const device = selectedDevice();
  if (!device) return;

  const mergedProperties = {
    ...(device.properties || {}),
    hostname: byId("modalHostname").value.trim(),
    host_ip: byId("modalHostIp").value.trim(),
    ssh_endpoint: byId("modalSshEndpoint").value.trim(),
    notes: byId("modalNotes").value.trim(),
  };

  await api(`/api/devices/${device.id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: byId("modalDeviceName").value.trim() || device.name,
      device_type: device.device_type,
      u_position: Number(byId("modalUPosition").value),
      u_height: Number(byId("modalUHeight").value),
      mount_side: byId("modalMountSide").value,
      serial_number: byId("modalSerial").value.trim(),
      management_ip: byId("modalMgmtIp").value.trim(),
      model: byId("modalModel").value.trim(),
      vendor: device.vendor,
      properties: mergedProperties,
    }),
  });

  closeDeviceModal();
  await refreshData();
}

async function removeDeviceFromRack() {
  const device = selectedDevice();
  if (!device) return;
  await api(`/api/devices/${device.id}/unrack`, { method: "POST" });
  closeDeviceModal();
  await refreshData();
}

async function archiveDeviceFromRack() {
  const device = selectedDevice();
  if (!device) return;
  await api(`/api/devices/${device.id}/archive`, { method: "POST" });
  closeDeviceModal();
  await refreshData();
}

function renderLocalUsersSection() {
  byId("localUsersSection").hidden = !(state.role === "admin" && state.showLocalUsers);
}

function renderEverything() {
  renderServerrooms();
  renderFloorplans();
  renderCanvas();
  renderDevicesTable();
  renderRackEditor();
  renderDeviceSearchList();
}

async function refreshLocalUsers() {
  renderLocalUsersSection();
  if (state.role !== "admin") return;

  const users = await api("/api/local-users");
  const tbody = byId("localUsersTable").querySelector("tbody");
  tbody.innerHTML = "";
  for (const user of users) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${user.username}</td><td>${user.role}</td><td>${user.is_active === 1 ? "yes" : "no"}</td>`;
    tbody.appendChild(row);
  }
}

async function refreshAudit() {
  const list = byId("auditList");
  list.innerHTML = "";
  const events = await api("/api/audit?limit=30");
  for (const event of events) {
    const item = document.createElement("li");
    item.textContent = `${event.created_at} | ${event.actor} | ${event.action} ${event.entity_type}#${event.entity_id}`;
    list.appendChild(item);
  }
}

async function refreshData() {
  state.serverrooms = await api("/api/serverrooms");
  if (!state.selectedServerroomId && state.serverrooms.length > 0) {
    state.selectedServerroomId = state.serverrooms[0].id;
  }

  state.floorplans = await api(`/api/floorplans?serverroom_id=${state.selectedServerroomId}`);
  if (!state.selectedFloorplanId && state.floorplans.length > 0) {
    state.selectedFloorplanId = state.floorplans[0].id;
  }
  if (!state.floorplans.some((fp) => fp.id === state.selectedFloorplanId)) {
    state.selectedFloorplanId = state.floorplans.length > 0 ? state.floorplans[0].id : null;
  }
  if (!selectedFloorplan()?.racks.some((r) => r.id === state.selectedRackId)) {
    state.selectedRackId = null;
  }

  state.deviceModels = await api("/api/device-models");
  state.inventoryDevices = await api("/api/inventory-devices?include_archived=true");
  if (state.selectedDeviceModelId && !state.deviceModels.some((m) => m.id === state.selectedDeviceModelId)) {
    state.selectedDeviceModelId = null;
  }

  renderEverything();
  renderInventory();
  await refreshAudit();
  await refreshLocalUsers();
}

function wireEvents() {
  const topMenu = document.querySelector(".top-menu");
  if (topMenu) {
    topMenu.addEventListener("click", (evt) => {
      const target = evt.target;
      if (!(target instanceof Element)) return;

      const summary = target.closest("summary");
      if (summary) {
        const details = summary.closest("details");
        if (!details) return;
        evt.preventDefault();
        const shouldOpen = !details.open;
        closeTopMenus();
        details.open = shouldOpen;
        return;
      }

      if (target.closest(".menu-popover button")) {
        closeTopMenus();
      }
    });
  }

  document.addEventListener("click", (evt) => {
    const target = evt.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(".top-menu")) {
      closeTopMenus();
    }
  });

  byId("loginBtn").addEventListener("click", async () => {
    try {
      const token = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: byId("username").value.trim(),
          password: byId("password").value,
        }),
      });
      state.token = token.access_token;
      state.username = token.username;
      state.role = token.role;
      state.authSource = token.auth_source;
      byId("sessionInfo").textContent = `${token.username} (${token.role}, ${token.auth_source})`;
      toggleAppLoggedIn(true);
      window.scrollTo(0, 0);
      await refreshData();
    } catch (err) {
      authStatus.textContent = err.message;
    }
  });

  byId("createServerroomBtn").addEventListener("click", async () => {
    const name = byId("serverroomName").value.trim();
    if (!name) return;
    await api("/api/serverrooms", {
      method: "POST",
      body: JSON.stringify({ name, description: "" }),
    });
    byId("serverroomName").value = "";
    await refreshData();
  });

  byId("serverroomSelect").addEventListener("change", async (evt) => {
    state.selectedServerroomId = Number(evt.target.value);
    state.selectedFloorplanId = null;
    state.selectedRackId = null;
    await refreshData();
  });

  byId("createFloorplanBtn").addEventListener("click", async () => {
    if (!state.selectedServerroomId) return;
    await api("/api/floorplans", {
      method: "POST",
      body: JSON.stringify({
        serverroom_id: state.selectedServerroomId,
        name: byId("floorplanName").value.trim() || "Main Floor",
        width: Number(byId("floorplanWidth").value),
        height: Number(byId("floorplanHeight").value),
      }),
    });
    await refreshData();
  });

  byId("floorplanSelect").addEventListener("change", (evt) => {
    state.selectedFloorplanId = Number(evt.target.value);
    state.selectedRackId = null;
    renderEverything();
  });

  byId("deviceSearchInput").addEventListener("input", () => {
    renderDeviceSearchList();
  });

  byId("addRackBtn").addEventListener("click", async () => {
    const floorplan = selectedFloorplan();
    if (!floorplan) return;
    await api("/api/racks", {
      method: "POST",
      body: JSON.stringify({
        floorplan_id: floorplan.id,
        name: byId("rackName").value.trim() || `Rack-${Date.now().toString().slice(-4)}`,
        x: Math.floor(floorplan.width / 2) - 26,
        y: Math.floor(floorplan.height / 2) - 17,
        width: 52,
        height: 34,
        units: 42,
        orientation: "top",
      }),
    });
    await refreshData();
  });

  byId("saveRackBtn").addEventListener("click", async () => {
    const rack = selectedRack();
    if (!rack) return;
    await api(`/api/racks/${rack.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: rack.name,
        x: rack.x,
        y: rack.y,
        width: rack.width,
        height: rack.height,
        units: rack.units,
        orientation: rack.orientation,
      }),
    });
    await refreshData();
  });

  byId("deleteRackBtn").addEventListener("click", async () => {
    const rack = selectedRack();
    if (!rack) return;
    await api(`/api/racks/${rack.id}`, { method: "DELETE" });
    state.selectedRackId = null;
    await refreshData();
  });

  byId("createTemplateBtn").addEventListener("click", async () => {
    const payload = {
      vendor: byId("templateVendor").value.trim(),
      model_code: byId("templateModelCode").value.trim(),
      name: byId("templateName").value.trim(),
      u_height: Number(byId("templateUHeight").value),
      device_type: byId("templateType").value.trim() || "server",
      image_url: byId("templateImage").value.trim() || "/static/device-models/generic-device.svg",
    };
    if (!payload.vendor || !payload.model_code || !payload.name) {
      authStatus.textContent = "Vendor, model code and display name are required";
      return;
    }
    await api("/api/device-models", { method: "POST", body: JSON.stringify(payload) });
    byId("templateVendor").value = "";
    byId("templateModelCode").value = "";
    byId("templateName").value = "";
    byId("templateImage").value = "";
    byId("templateType").value = "";
    state.selectedDeviceModelId = null;
    await refreshData();
  });

  byId("createLocalUserBtn").addEventListener("click", async () => {
    if (state.role !== "admin") return;
    const username = byId("newLocalUsername").value.trim();
    const password = byId("newLocalPassword").value;
    const role = byId("newLocalRole").value;
    if (!username || !password) return;
    await api("/api/local-users", { method: "POST", body: JSON.stringify({ username, password, role }) });
    byId("newLocalUsername").value = "";
    byId("newLocalPassword").value = "";
    await refreshData();
  });

  byId("saveDeviceModalBtn").addEventListener("click", async () => {
    try {
      await saveDeviceModal();
    } catch (err) {
      authStatus.textContent = err.message;
    }
  });

  byId("removeFromRackBtn").addEventListener("click", async () => {
    try {
      await removeDeviceFromRack();
    } catch (err) {
      authStatus.textContent = err.message;
    }
  });

  byId("archiveDeviceBtn").addEventListener("click", async () => {
    try {
      await archiveDeviceFromRack();
    } catch (err) {
      authStatus.textContent = err.message;
    }
  });

  byId("closeDeviceModalBtn").addEventListener("click", () => {
    closeDeviceModal();
  });

  byId("menuAddServerroomBtn").addEventListener("click", () => {
    closeTopMenus();
    byId("serverroomName").focus();
  });

  byId("menuAddFloorplanBtn").addEventListener("click", () => {
    closeTopMenus();
    byId("floorplanName").focus();
  });

  byId("menuAddRackBtn").addEventListener("click", () => {
    closeTopMenus();
    byId("rackName").focus();
  });

  byId("menuAddTemplateBtn").addEventListener("click", () => {
    closeTopMenus();
    byId("inventoryManagerModal").hidden = false;
    byId("templateName").focus();
  });

  byId("menuImportCsvBtn").addEventListener("click", () => {
    closeTopMenus();
    byId("csvImportModal").hidden = false;
    byId("csvImportStatus").textContent = "No import yet.";
  });

  byId("closeInventoryManagerBtn").addEventListener("click", () => {
    byId("inventoryManagerModal").hidden = true;
  });

  byId("inventoryManagerModal").addEventListener("click", (evt) => {
    if (evt.target.id === "inventoryManagerModal") {
      byId("inventoryManagerModal").hidden = true;
    }
  });

  byId("closeCsvImportModalBtn").addEventListener("click", () => {
    byId("csvImportModal").hidden = true;
  });

  byId("csvImportModal").addEventListener("click", (evt) => {
    if (evt.target.id === "csvImportModal") {
      byId("csvImportModal").hidden = true;
    }
  });

  byId("importInventoryCsvBtn").addEventListener("click", async () => {
    try {
      const result = await uploadCsv("/api/import/inventory-csv", "inventoryCsvFile");
      byId("csvImportStatus").textContent = [
        `Inventory import complete`,
        `Rows: ${result.rows}`,
        `Created: ${result.created}`,
        `Updated: ${result.updated}`,
        `Errors: ${result.errors.length}`,
        result.errors.length ? `Error details:\n${result.errors.join("\n")}` : "",
      ].join("\n");
      await refreshData();
    } catch (err) {
      byId("csvImportStatus").textContent = err.message;
    }
  });

  byId("importLayoutCsvBtn").addEventListener("click", async () => {
    try {
      const result = await uploadCsv("/api/import/layout-csv?clear_existing=true", "layoutCsvFile");
      byId("csvImportStatus").textContent = [
        `Layout import complete`,
        `Rows: ${result.rows}`,
        `Created placements: ${result.created}`,
        `Updated placements: ${result.updated}`,
        `Errors: ${result.errors.length}`,
        result.errors.length ? `Error details:\n${result.errors.join("\n")}` : "",
      ].join("\n");
      await refreshData();
    } catch (err) {
      byId("csvImportStatus").textContent = err.message;
    }
  });

  byId("menuToggleLeftPanelBtn").addEventListener("click", () => {
    closeTopMenus();
    byId("leftPanel").hidden = !byId("leftPanel").hidden;
    syncLayoutVisibility();
  });

  byId("menuToggleRightPanelBtn").addEventListener("click", () => {
    closeTopMenus();
    byId("rightPanel").hidden = !byId("rightPanel").hidden;
    syncLayoutVisibility();
  });

  byId("menuShowRecentChangesBtn").addEventListener("click", () => {
    closeTopMenus();
    byId("recentChangesModal").hidden = false;
  });

  byId("closeRecentChangesBtn").addEventListener("click", () => {
    byId("recentChangesModal").hidden = true;
  });

  byId("recentChangesModal").addEventListener("click", (evt) => {
    if (evt.target.id === "recentChangesModal") {
      byId("recentChangesModal").hidden = true;
    }
  });

  byId("menuToggleLocalUsersBtn").addEventListener("click", () => {
    closeTopMenus();
    state.showLocalUsers = !state.showLocalUsers;
    renderLocalUsersSection();
  });

  byId("darkModeToggleBtn").addEventListener("click", () => {
    closeTopMenus();
    toggleTheme();
  });

  floorSvg.addEventListener("mousemove", (evt) => {
    if (!state.dragRack) return;
    const rack = selectedFloorplan()?.racks.find((r) => r.id === state.dragRack.rackId);
    if (!rack) return;
    rack.x = Math.max(0, Math.round(evt.offsetX - state.dragRack.offsetX));
    rack.y = Math.max(0, Math.round(evt.offsetY - state.dragRack.offsetY));
    renderCanvas();
  });
  floorSvg.addEventListener("mouseup", () => {
    state.dragRack = null;
  });
  floorSvg.addEventListener("mouseleave", () => {
    state.dragRack = null;
  });
}

toggleAppLoggedIn(false);
initializeTheme();
setupLayoutResizers();
wireEvents();
syncLayoutVisibility();
