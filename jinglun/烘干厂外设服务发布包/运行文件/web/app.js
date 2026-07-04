const $ = (selector) => document.querySelector(selector);

const state = {
  currentTab: "idCard",
  deviceOpened: false,
};

function setText(selector, value) {
  const node = $(selector);
  if (node) node.textContent = value;
}

function setMessage(selector, text, tone = "neutral") {
  const node = $(selector);
  if (!node) return;
  node.textContent = text || "";
  node.className = `message ${tone}`;
}

function setDebug(value) {
  $("#debugOutput").textContent = JSON.stringify(value || {}, null, 2);
}

function apiError(error) {
  if (error && error.error) {
    const ret = error.error.ret === undefined ? "" : `，返回码 ${error.error.ret}`;
    return `${error.error.message}${ret}`;
  }
  return error.message || String(error);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  setDebug(payload);
  if (!payload.ok) {
    throw payload;
  }
  return payload.data;
}

function renderHealth(data) {
  const bits = data.pythonBits ? `${data.pythonBits}位` : "--";
  setText("#pythonStatus", bits);
  setText("#sdkStatus", data.canLoadSdk || data.sdkLoaded ? "就绪" : "未就绪");
  setText("#serviceLine", `本机服务 ${location.origin}`);

  const missing = data.missingFiles || [];
  if (missing.length) {
    setText("#sdkStatus", `缺少 ${missing.length} 项`);
  }
  if (data.sdkLoadError) {
    setText("#sdkStatus", data.sdkLoadError.code);
  }
}

function renderDevices(data) {
  setText("#hidStatus", String(data.hidCount ?? "--"));
  setText("#standardStatus", String(data.standardCount ?? "--"));
}

function fieldValue(fields, key) {
  const item = fields.find((field) => field.key === key);
  return item ? item.value : "";
}

function renderIdCard(data) {
  const fields = data.text?.fields || [];
  const target = $("#idFields");
  target.replaceChildren();

  const visibleFields = fields.filter((field) => field.value !== "");
  if (!visibleFields.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "未返回文本字段";
    target.appendChild(empty);
  } else {
    visibleFields.forEach((field) => {
      const item = document.createElement("div");
      item.className = "field-item";
      const label = document.createElement("span");
      label.textContent = field.label;
      const value = document.createElement("strong");
      value.textContent = field.value;
      item.append(label, value);
      target.appendChild(item);
    });
  }

  setImage("#headPhoto", data.photos?.headPhoto);
  setImage("#frontCopy", data.photos?.frontCopy);
  setImage("#backCopy", data.photos?.backCopy);

  const name = fieldValue(fields, "name");
  const idNumber = fieldValue(fields, "idNumber");
  const label = [data.cardTypeName, name, idNumber].filter(Boolean).join(" / ");
  setMessage("#idMessage", label || "读取完成", "success");
}

function setImage(selector, photo) {
  const image = $(selector);
  if (!image) return;
  if (photo && photo.base64) {
    image.src = `data:${photo.mime || "image/jpeg"};base64,${photo.base64}`;
    image.hidden = false;
  } else {
    image.removeAttribute("src");
    image.hidden = true;
  }
}

function deviceBody() {
  const deviceType = $("#deviceTypeInput").value;
  const body = {
    port: Number($("#portInput").value || 1001),
    deviceType,
  };
  if (deviceType !== "auto") {
    body.index = Number($("#deviceIndexInput").value || 1);
  }
  return body;
}

function nfcBlockBody() {
  return {
    sid: Number($("#sidInput").value || 0),
    bid: Number($("#bidInput").value || 0),
    keyType: $("#keyTypeInput").value,
    key: $("#keyInput").value,
  };
}

async function refreshHealth() {
  try {
    const data = await request("/api/health");
    renderHealth(data);
  } catch (error) {
    setText("#serviceLine", "服务不可用");
    setText("#sdkStatus", "错误");
    setDebug(error);
  }
}

async function detectDevices() {
  try {
    const data = await request("/api/devices");
    renderDevices(data);
    setMessage("#deviceMessage", "设备检测完成", "success");
  } catch (error) {
    setMessage("#deviceMessage", apiError(error), "error");
  }
}

async function openDevice() {
  try {
    const data = await request("/api/device/open", { method: "POST", body: deviceBody() });
    state.deviceOpened = true;
    setMessage("#deviceMessage", `端口 ${data.port} 已打开`, "success");
  } catch (error) {
    state.deviceOpened = false;
    setMessage("#deviceMessage", apiError(error), "error");
  }
}

async function closeDevice() {
  try {
    await request("/api/device/close", { method: "POST", body: {} });
    state.deviceOpened = false;
    setMessage("#deviceMessage", "设备已关闭", "success");
  } catch (error) {
    setMessage("#deviceMessage", apiError(error), "error");
  }
}

async function readIdCard() {
  try {
    setMessage("#idMessage", "读取中", "neutral");
    const data = await request("/api/id-card/read", { method: "POST", body: {} });
    renderIdCard(data);
  } catch (error) {
    setMessage("#idMessage", apiError(error), "error");
  }
}

async function findNfc() {
  try {
    const data = await request("/api/nfc/find", { method: "POST", body: {} });
    setMessage("#nfcMessage", `${data.typeName} (${data.type})`, data.type ? "success" : "neutral");
  } catch (error) {
    setMessage("#nfcMessage", apiError(error), "error");
  }
}

async function readNfcSn() {
  try {
    const data = await request("/api/nfc/sn", { method: "POST", body: {} });
    setMessage("#nfcMessage", `卡号 ${data.sn}`, "success");
  } catch (error) {
    setMessage("#nfcMessage", apiError(error), "error");
  }
}

async function readBlock() {
  try {
    const data = await request("/api/nfc/read-block", { method: "POST", body: nfcBlockBody() });
    setMessage("#nfcMessage", `块数据 ${data.hex}`, "success");
  } catch (error) {
    setMessage("#nfcMessage", apiError(error), "error");
  }
}

async function writeBlock() {
  try {
    const body = nfcBlockBody();
    body.data = $("#writeDataInput").value;
    body.allowTrailerWrite = $("#allowTrailerInput").checked;
    const data = await request("/api/nfc/write-block", { method: "POST", body });
    setMessage("#nfcMessage", `已写入 扇区${data.sid} 块${data.bid}`, "success");
  } catch (error) {
    setMessage("#nfcMessage", apiError(error), "error");
  }
}

async function sendApdu() {
  try {
    const data = await request("/api/nfc/apdu", {
      method: "POST",
      body: { apdu: $("#apduInput").value },
    });
    setMessage("#nfcMessage", `APDU 返回 ${data.hex || "(空)"}`, "success");
  } catch (error) {
    setMessage("#nfcMessage", apiError(error), "error");
  }
}

function switchTab(name) {
  state.currentTab = name;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  $("#idCardPanel").classList.toggle("active", name === "idCard");
  $("#nfcPanel").classList.toggle("active", name === "nfc");
}

function bindEvents() {
  $("#refreshHealth").addEventListener("click", refreshHealth);
  $("#detectDevices").addEventListener("click", detectDevices);
  $("#openDevice").addEventListener("click", openDevice);
  $("#closeDevice").addEventListener("click", closeDevice);
  $("#readIdCard").addEventListener("click", readIdCard);
  $("#findNfc").addEventListener("click", findNfc);
  $("#readNfcSn").addEventListener("click", readNfcSn);
  $("#readBlock").addEventListener("click", readBlock);
  $("#writeBlock").addEventListener("click", writeBlock);
  $("#sendApdu").addEventListener("click", sendApdu);
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });
  $("#deviceTypeInput").addEventListener("change", () => {
    $("#deviceIndexInput").disabled = $("#deviceTypeInput").value === "auto";
  });
}

bindEvents();
$("#deviceIndexInput").disabled = true;
refreshHealth();
