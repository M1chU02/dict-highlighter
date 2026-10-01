const dictionaryEl = document.getElementById("dictionary");
const colorEl = document.getElementById("color");
const wholeWordEl = document.getElementById("wholeWord");
const statusEl = document.getElementById("status");
const matchesEl = document.getElementById("matches");

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = type || "";
}

function renderMatches(words) {
  matchesEl.innerHTML = "";
  matchesEl.classList.remove("visible");

  if (!Array.isArray(words) || words.length === 0) {
    matchesEl.innerHTML =
      "<h2>Znalezione słowa</h2><ul><li>Brak dopasowań</li></ul>";
    matchesEl.classList.add("visible");
    return;
  }

  const heading = document.createElement("h2");
  heading.textContent = "Znalezione słowa";

  const list = document.createElement("ul");
  words.forEach((word) => {
    const item = document.createElement("li");
    item.textContent = word;
    list.appendChild(item);
  });

  matchesEl.appendChild(heading);
  matchesEl.appendChild(list);
  matchesEl.classList.add("visible");
}

// Load saved settings
chrome.storage.sync.get(["words", "color", "wholeWord"], (data) => {
  if (data.words && Array.isArray(data.words)) {
    dictionaryEl.value = data.words.join("\n");
  }
  if (data.color) {
    colorEl.value = data.color;
  }
  if (typeof data.wholeWord === "boolean") {
    wholeWordEl.checked = data.wholeWord;
  }
});

function parseWords() {
  return dictionaryEl.value
    .split("\n")
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

document.getElementById("saveBtn").addEventListener("click", () => {
  const words = parseWords();
  chrome.storage.sync.set(
    { words, color: colorEl.value, wholeWord: wholeWordEl.checked },
    () => setStatus(`Zapisano ${words.length} pozycji ze słownika.`, "success"),
  );
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

document.getElementById("highlightBtn").addEventListener("click", async () => {
  const words = parseWords();
  if (words.length === 0) {
    setStatus("Słownik jest pusty. Dodaj słowa i zapisz.", "error");
    return;
  }
  // Always save latest before highlighting
  await chrome.storage.sync.set({
    words,
    color: colorEl.value,
    wholeWord: wholeWordEl.checked,
  });

  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    setStatus("Nie można znaleźć aktywnej karty.", "error");
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "highlight",
      words,
      color: colorEl.value,
      wholeWord: wholeWordEl.checked,
    });
    if (response && typeof response.count === "number") {
      setStatus(
        `Podświetlono ${response.count} wystąpień.`,
        response.count > 0 ? "success" : "error",
      );
      renderMatches(response.matches || []);
    } else {
      setStatus("Podświetlono na stronie.", "success");
      renderMatches([]);
    }
  } catch (err) {
    setStatus(
      "Błąd: nie można działać na tej stronie (np. chrome://).",
      "error",
    );
    renderMatches([]);
  }
});

document.getElementById("clearBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    await chrome.tabs.sendMessage(tab.id, { action: "clear" });
    setStatus("Wyczyszczono podświetlenia.", "success");
    renderMatches([]);
  } catch (err) {
    setStatus("Błąd: nie można działać na tej stronie.", "error");
    renderMatches([]);
  }
});
