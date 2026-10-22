"use strict";

/* ---------- STORAGE ---------- */

const STORAGE_KEYS = {
  contacts: "ec_contacts_v1",
  history: "ec_history_v1",
  emergencyContact: "ec_emergency_contact_v1",
  seniorQuickCall: "ec_senior_quick_call_v1"
};

function loadData(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    showToast("Unable to save data in this browser.");
    return false;
  }
}

let contacts = loadData(STORAGE_KEYS.contacts);
let historyItems = loadData(STORAGE_KEYS.history);
let emergencyContactId = loadEmergencyContactId();
let seniorQuickCallEnabled = loadSeniorQuickCallSetting();
let currentLocation = null;
let emergencyAlertIndex = 0;
let toastTimer = null;

function loadEmergencyContactId() {
  try {
    const id = localStorage.getItem(STORAGE_KEYS.emergencyContact);
    return contacts.some(contact => contact.id === id) ? id : null;
  } catch {
    return null;
  }
}

function loadSeniorQuickCallSetting() {
  try {
    return localStorage.getItem(STORAGE_KEYS.seniorQuickCall) === "true";
  } catch {
    return false;
  }
}

/* ---------- NAVIGATION ---------- */

function showPage(pageName) {
  const target = document.getElementById(pageName);

  if (!target || !target.classList.contains("page")) {
    return;
  }

  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === pageName);
  });

  document.querySelectorAll("[data-page]").forEach(button => {
    const active = button.dataset.page === pageName;

    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- TOAST MESSAGES ---------- */

function showToast(message) {
  const toast = document.getElementById("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

/* ---------- LOCATION ---------- */

function getMyLocation(onComplete) {
  const text = document.getElementById("locationText");
  const badge = document.getElementById("locationBadge");

  if (!navigator.geolocation) {
    showToast("Location is not supported by this browser.");
    if (onComplete) onComplete(null, "Location is not supported by this browser.");
    return;
  }

  text.textContent = "Waiting for location permission…";

  navigator.geolocation.getCurrentPosition(
    position => {
      currentLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      const mapURL =
        `https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}`;

      text.textContent = "Location available on this device";

      badge.textContent = "AVAILABLE";
      badge.style.background = "#e1f5ec";
      badge.style.color = "#24765e";

      showToast("Location obtained. Share it only with someone you trust.");

      // Create a safe clickable map link.
      let link = document.getElementById("locationMapLink");

      if (!link) {
        link = document.createElement("a");
        link.id = "locationMapLink";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open map ↗";
        link.style.cssText =
          "display:block;padding:0 17px 14px;color:#287f70;font-size:11px;font-weight:700;";
        document.querySelector(".map-card").appendChild(link);
      }

      link.href = mapURL;

      if (onComplete) onComplete(currentLocation, null);
    },

    error => {
      currentLocation = null;
      text.textContent = "Location unavailable";

      const messages = {
        1: "Location permission was denied. Check your browser settings.",
        2: "Your location could not be determined. Try again.",
        3: "Location request timed out. Please try again."
      };

      const message = messages[error.code] || "Unable to get your location.";
      showToast(message);
      if (onComplete) onComplete(null, message);
    },

    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    }
  );
}

/* ---------- EMERGENCY FLOW ---------- */

function startSOS(requestLocation = true) {
  const overlay = document.getElementById("sosOverlay");
  const locationStatus = document.getElementById("sosLocationStatus");
  const retryButton = document.getElementById("sosRetryButton");
  const alertStatus = document.getElementById("sosAlertStatus");

  emergencyAlertIndex = 0;
  renderSOSContact();
  alertStatus.textContent = contacts.length
    ? `${contacts.length} saved contact${contacts.length === 1 ? "" : "s"} ready to alert one at a time.`
    : "Add at least one contact before sending an alert.";
  retryButton.textContent = currentLocation ? "Refresh location" : "Get my location";
  locationStatus.textContent = currentLocation
    ? "Location ready to include in your message."
    : requestLocation
      ? "Requesting your current location…"
      : "Tap “Get my location” when you’re ready to share it.";
  retryButton.hidden = Boolean(currentLocation) || requestLocation;
  updateSOSShareButton();
  overlay.hidden = false;
  document.body.classList.add("sos-open");

  const closeButton = overlay.querySelector(".close-button");
  closeButton.focus();

  if (requestLocation) {
    requestSOSLocation();
  }
}

function handleSOSAction() {
  startSOS();
}

function enableSeniorQuickCall() {
  if (!contacts.some(item => item.id === emergencyContactId)) {
    showToast("Add a contact and set them as your emergency contact first.");
    showPage("circle");
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.seniorQuickCall, "true");
  } catch {
    showToast("Unable to save this setting in your browser.");
    return;
  }

  seniorQuickCallEnabled = true;
  seniorQuickCall.checked = true;
  document.body.classList.add("senior-quick-call");
  updateHomeSOSButton();
  updateSeniorPrompt();
  showToast("One-tap calling is ready. Tap Call when you need help.");
}

function dismissSeniorPrompt() {
  document.getElementById("seniorPrompt").hidden = true;
}

function closeSOS() {
  document.getElementById("sosOverlay").hidden = true;
  document.body.classList.remove("sos-open");
}

function renderSOSContact() {
  const contact = contacts.find(item => item.id === emergencyContactId);
  const contactInfo = document.getElementById("sosPrimaryContact");
  const emptyMessage = document.getElementById("sosEmptyContacts");
  const alertStatus = document.getElementById("sosAlertStatus");

  contactInfo.textContent = contact
    ? `${contact.name} · ${contact.phone}`
    : "No emergency contact selected.";
  emptyMessage.hidden = Boolean(contact);
  if (alertStatus && emergencyAlertIndex === 0) {
    alertStatus.textContent = contacts.length
      ? `${contacts.length} saved contact${contacts.length === 1 ? "" : "s"} ready to alert one at a time.`
      : "Add at least one contact before sending an alert.";
  }
  updateSOSShareButton();
}

function updateSOSShareButton() {
  const button = document.getElementById("sosShareButton");
  const hasContacts = contacts.length > 0;
  const ready = Boolean(currentLocation && hasContacts && emergencyAlertIndex < contacts.length);
  const callButton = document.getElementById("sosCallButton");
  const contact = contacts.find(item => item.id === emergencyContactId);

  button.disabled = !ready;
  if (!hasContacts) {
    button.textContent = "Add contacts to enable SOS";
  } else if (!currentLocation) {
    button.textContent = "Get your location to alert everyone";
  } else if (emergencyAlertIndex >= contacts.length) {
    button.textContent = "All alerts prepared";
  } else {
    const nextContact = contacts[emergencyAlertIndex];
    button.textContent = `Prepare alert for ${nextContact.name} (${emergencyAlertIndex + 1}/${contacts.length})`;
  }

  callButton.disabled = !contact;
  callButton.textContent = contact ? `Call ${contact.name}` : "Set an emergency contact to enable calling";
}

function callEmergencyContact() {
  const contact = contacts.find(item => item.id === emergencyContactId);

  if (!contact) {
    showToast("Choose an emergency contact in your trusted circle first.");
    return;
  }

  const phoneNumber = contact.phone.replace(/[^\d+]/g, "");

  if (phoneNumber.replace(/\D/g, "").length < 5) {
    showToast("Please check this contact's phone number.");
    return;
  }

  addHistory("Emergency call started", `Phone call opened for ${contact.name}`);
  window.location.href = `tel:${phoneNumber}`;
}

function retrySOSLocation() {
  const locationStatus = document.getElementById("sosLocationStatus");
  const retryButton = document.getElementById("sosRetryButton");

  locationStatus.textContent = "Requesting your current location…";
  retryButton.textContent = "Try again";
  retryButton.hidden = true;
  updateSOSShareButton();

  requestSOSLocation();
}

function requestSOSLocation() {
  const locationStatus = document.getElementById("sosLocationStatus");
  const retryButton = document.getElementById("sosRetryButton");

  getMyLocation((location, errorMessage) => {
    locationStatus.textContent = location
      ? "Location ready to include in your message."
      : `${errorMessage} You can try again when ready.`;
    retryButton.textContent = location ? "Refresh location" : "Try again";
    retryButton.hidden = Boolean(location);
    updateSOSShareButton();
  });
}

function shareEmergencyOnWhatsApp() {
  if (!currentLocation || contacts.length === 0) {
    showToast("Add contacts and allow location access before preparing alerts.");
    updateSOSShareButton();
    return;
  }

  if (emergencyAlertIndex >= contacts.length) {
    showToast("An alert has been prepared for every saved contact.");
    updateSOSShareButton();
    return;
  }

  const contact = contacts[emergencyAlertIndex];
  const phoneDigits = contact.phone.replace(/\D/g, "");

  if (phoneDigits.length < 5) {
    emergencyAlertIndex += 1;
    document.getElementById("sosAlertStatus").textContent =
      `Skipped ${contact.name}: the saved phone number is invalid. ${emergencyAlertIndex < contacts.length ? "Press the button to continue to the next contact." : "No more contacts remain."}`;
    updateSOSShareButton();
    showToast(`Skipped ${contact.name}; check their saved phone number.`);
    return;
  }

  const mapURL = `https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}`;
  const message = `EMERGENCY: I need help. Please contact me as soon as you can. My current location is: ${mapURL}`;
  const whatsappURL = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;

  emergencyAlertIndex += 1;
  addHistory("Emergency alert prepared", `WhatsApp alert ${emergencyAlertIndex} of ${contacts.length} prepared for ${contact.name} with current location`);
  window.open(whatsappURL, "_blank", "noopener,noreferrer");
  document.getElementById("sosAlertStatus").textContent = emergencyAlertIndex < contacts.length
    ? `Alert prepared for ${contact.name}. Send it in WhatsApp, then return here for the next contact (${emergencyAlertIndex + 1} of ${contacts.length}).`
    : `Alert prepared for ${contact.name}. This was the last saved contact; send it in WhatsApp.`;
  updateSOSShareButton();
  showToast(`Review the alert for ${contact.name} in WhatsApp and press Send.`);
}

document.getElementById("sosOverlay").addEventListener("click", event => {
  if (event.target.id === "sosOverlay") {
    closeSOS();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeSOS();
  }
});

/* ---------- EMERGENCY CATEGORIES ---------- */

function chooseEmergency(title, guidance, button) {
  document.querySelectorAll(".choice").forEach(button => {
    button.classList.remove("selected");
  });

  if (button && button.classList.contains("choice")) {
    button.classList.add("selected");
  }

  document.getElementById("resultTitle").textContent = title;
  document.getElementById("resultDescription").textContent = guidance;

  addHistory(title, "Emergency guidance viewed");

  document.getElementById("emergencyResult").scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

/* ---------- TRUSTED CONTACTS ---------- */

const contactForm = document.getElementById("contactForm");

contactForm.addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("contactName").value.trim();
  const phone = document.getElementById("contactPhone").value.trim();

  if (!name || !phone) {
    showToast("Please enter a name and phone number.");
    return;
  }

  if (!/[0-9]{5,}/.test(phone.replace(/\D/g, ""))) {
    showToast("Please check the phone number.");
    return;
  }

  const contact = {
    id: Date.now().toString(),
    name,
    phone
  };

  contacts.push(contact);

  if (!saveData(STORAGE_KEYS.contacts, contacts)) {
    contacts.pop();
    return;
  }

  contactForm.reset();
  emergencyAlertIndex = 0;
  renderContacts();
  renderSOSContact();
  updateSeniorPrompt();
  showToast(`${name} added to your trusted circle.`);
});

function renderContacts() {
  const container = document.getElementById("contactsList");

  container.replaceChildren();

  if (contacts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No contacts added yet. Add someone you trust.";
    container.appendChild(empty);
    return;
  }

  contacts.forEach(contact => {
    const item = document.createElement("div");
    item.className = "contact-item";

    const info = document.createElement("div");
    info.className = "contact-info";

    const name = document.createElement("strong");
    name.textContent = contact.name;

    const phone = document.createElement("small");
    phone.textContent = contact.phone;

    info.append(name, phone);

    const actions = document.createElement("div");
    actions.className = "contact-actions";

    const emergencyButton = document.createElement("button");
    emergencyButton.className = "small-action emergency-contact-action";
    emergencyButton.textContent = contact.id === emergencyContactId
      ? "Emergency contact"
      : "Set as emergency contact";
    emergencyButton.setAttribute("aria-pressed", String(contact.id === emergencyContactId));
    emergencyButton.disabled = contact.id === emergencyContactId;
    emergencyButton.addEventListener("click", () => setEmergencyContact(contact.id));

    const callButton = document.createElement("button");
    callButton.className = "small-action";
    callButton.textContent = "Call";
    callButton.addEventListener("click", () => callContact(contact.id));

    const shareButton = document.createElement("button");
    shareButton.className = "small-action";
    shareButton.textContent = "Share";
    shareButton.addEventListener("click", () => shareWithContact(contact.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "small-action delete";
    deleteButton.textContent = "Remove";
    deleteButton.addEventListener("click", () => removeContact(contact.id));

    actions.append(emergencyButton, callButton, shareButton, deleteButton);
    item.append(info, actions);
    container.appendChild(item);
  });
}

function setEmergencyContact(id) {
  const contact = contacts.find(item => item.id === id);

  if (!contact) {
    showToast("Choose a saved contact first.");
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.emergencyContact, contact.id);
  } catch {
    showToast("Unable to save your emergency contact in this browser.");
    return;
  }

  emergencyContactId = contact.id;
  renderContacts();
  renderSOSContact();
  updateHomeSOSButton();
  updateSeniorPrompt();
  showToast(`${contact.name} is now your emergency contact.`);
}

function callContact(id) {
  const contact = contacts.find(item => item.id === id);

  if (!contact) return;

  const confirmed = window.confirm(
    `Open your phone app to call ${contact.name}.`
  );

  if (!confirmed) return;

  addHistory("Call initiated", `Phone action selected for ${contact.name}`);

  // Opens the device's phone app where supported.
  window.location.href = `tel:${contact.phone.replace(/[^\d+]/g, "")}`;
}

function shareWithContact(id) {
  const contact = contacts.find(item => item.id === id);

  if (!contact) return;

  let message =
    "I may need help. Please contact me when you can.";

  if (currentLocation) {
    const mapURL =
      `https://www.google.com/maps?q=${currentLocation.latitude},${currentLocation.longitude}`;

    message += ` My shared location: ${mapURL}`;
  } else {
    message += " I have not shared my location through this website.";
  }

  const phoneDigits = contact.phone.replace(/\D/g, "");

  if (phoneDigits.length < 5) {
    showToast("Please check this contact's phone number.");
    return;
  }

  const whatsappURL =
    `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;

  addHistory("Message prepared", `WhatsApp message prepared for ${contact.name}`);

  // Opens WhatsApp with a prepared message.
  // The user must review and send it themselves.
  window.open(whatsappURL, "_blank", "noopener,noreferrer");

  showToast("Review the message in WhatsApp and send it yourself.");
}

function removeContact(id) {
  const contact = contacts.find(item => item.id === id);

  if (!contact) return;

  if (!window.confirm(`Remove ${contact.name} from your trusted circle.`)) {
    return;
  }

  const previous = contacts;
  contacts = contacts.filter(item => item.id !== id);

  if (!saveData(STORAGE_KEYS.contacts, contacts)) {
    contacts = previous;
    return;
  }

  emergencyAlertIndex = 0;
  if (emergencyContactId === id) {
    try {
      localStorage.removeItem(STORAGE_KEYS.emergencyContact);
      emergencyContactId = null;
    } catch {
      contacts = previous;
      saveData(STORAGE_KEYS.contacts, contacts);
      showToast("Unable to update your emergency contact in this browser.");
      return;
    }
  }

  renderContacts();
  renderSOSContact();
  updateHomeSOSButton();
  updateSeniorPrompt();
  showToast("Contact removed.");
}

/* ---------- INCIDENT HISTORY ---------- */

function addHistory(title, details) {
  const entry = {
    id: Date.now().toString(),
    title,
    details,
    time: new Date().toLocaleString()
  };

  historyItems.unshift(entry);

  // Keep the latest 30 entries.
  historyItems = historyItems.slice(0, 30);

  saveData(STORAGE_KEYS.history, historyItems);
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById("historyList");

  container.replaceChildren();

  if (historyItems.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No activity recorded yet.";
    container.appendChild(empty);
    return;
  }

  historyItems.forEach(entry => {
    const item = document.createElement("div");
    item.className = "history-item";

    const info = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = entry.title;

    const details = document.createElement("p");
    details.textContent = `${entry.details} · ${entry.time}`;

    info.append(title, details);

    const badge = document.createElement("span");
    badge.className = "history-badge";
    badge.textContent = "LOCAL RECORD";

    item.append(info, badge);
    container.appendChild(item);
  });
}

function clearHistory() {
  if (historyItems.length === 0) {
    showToast("There is no history to clear.");
    return;
  }

  if (!window.confirm("Clear all locally stored incident history.")) {
    return;
  }

  historyItems = [];

  if (saveData(STORAGE_KEYS.history, historyItems)) {
    renderHistory();
    showToast("History cleared.");
  }
}

/* ---------- ACCESSIBILITY SETTINGS ---------- */

const largeText = document.getElementById("largeText");
const reduceMotion = document.getElementById("reduceMotion");
const seniorQuickCall = document.getElementById("seniorQuickCall");

function updateHomeSOSButton() {
  const label = document.getElementById("homeSOSLabel");
  const description = document.getElementById("homeSOSDescription");
  label.textContent = "SOS — Alert all contacts";
  description.textContent = "Open emergency options to alert your trusted contacts or call your emergency contact.";

  document.getElementById("homeSOSButton").setAttribute(
    "aria-label",
    "SOS — Open emergency options"
  );
}

function updateSeniorPrompt() {
  const prompt = document.getElementById("seniorPrompt");
  const title = document.getElementById("seniorPromptTitle");
  const description = document.getElementById("seniorPromptDescription");
  const enableButton = document.getElementById("seniorEnableButton");
  const callButton = document.getElementById("seniorCallButton");
  const dismissButton = document.getElementById("seniorDismissButton");
  const contact = contacts.find(item => item.id === emergencyContactId);

  prompt.hidden = false;

  if (seniorQuickCallEnabled && contact) {
    title.textContent = "Senior one-tap calling is ready.";
    description.textContent = `Press the large call button to call ${contact.name}. Your phone may ask you to confirm the call.`;
    enableButton.hidden = true;
    callButton.hidden = false;
    callButton.textContent = `CALL ${contact.name} NOW`;
    dismissButton.textContent = "Hide this option";
  } else if (seniorQuickCallEnabled) {
    title.textContent = "Set an emergency contact for one-tap calling.";
    description.textContent = "Add a trusted contact and mark them as your emergency contact.";
    enableButton.hidden = true;
    callButton.hidden = true;
    dismissButton.textContent = "Not now";
  } else {
    title.textContent = "Senior quick-call option";
    description.textContent = "Turn on simple calling to show a large call button here. The SOS button always opens emergency options.";
    enableButton.hidden = false;
    callButton.hidden = true;
    dismissButton.textContent = "Not now";
  }
}

largeText.addEventListener("change", () => {
  document.body.classList.toggle("large-text", largeText.checked);
});

reduceMotion.addEventListener("change", () => {
  document.body.classList.toggle("reduce-motion", reduceMotion.checked);
});

seniorQuickCall.checked = seniorQuickCallEnabled;
document.body.classList.toggle("senior-quick-call", seniorQuickCallEnabled);
updateHomeSOSButton();
updateSeniorPrompt();

seniorQuickCall.addEventListener("change", () => {
  try {
    localStorage.setItem(STORAGE_KEYS.seniorQuickCall, String(seniorQuickCall.checked));
  } catch {
    seniorQuickCall.checked = seniorQuickCallEnabled;
    showToast("Unable to save this setting in your browser.");
    return;
  }

  seniorQuickCallEnabled = seniorQuickCall.checked;
  document.body.classList.toggle("senior-quick-call", seniorQuickCallEnabled);
  updateHomeSOSButton();
  updateSeniorPrompt();
  showToast(seniorQuickCallEnabled
    ? "Senior one-tap calling is on."
    : "Senior one-tap calling is off.");
});

/* ---------- INITIALISE ---------- */

renderContacts();
renderHistory();
startSOS(false);
