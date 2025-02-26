// Ensure the script executes after the page is fully loaded
window.addEventListener("DOMContentLoaded", async () => {
  console.log("Settings page loaded");
  const aiSelect = document.getElementById("ai-select");
  const apiKeyInput = document.getElementById("api-key");
  const targetLanguageSelect = document.getElementById("target-language");
  const delayInput = document.getElementById("delay-seconds");
  const maxWidthInput = document.getElementById("max-width");
  const saveButton = document.getElementById("save-button");
  const statusMessage = document.getElementById("status-message");

  // Load saved settings
  try {
    const result = await browser.storage.local.get([
      "apiKey",
      "selectedAI",
      "targetLanguage",
      "delaySeconds",
      "maxWidth",
    ]);
    console.log("Settings loaded:", result);

    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
    if (result.selectedAI) {
      aiSelect.value = result.selectedAI;
    }
    if (result.targetLanguage) {
      targetLanguageSelect.value = result.targetLanguage;
    } else {
      // Default to Chinese
      targetLanguageSelect.value = "chinese";
    }
    if (result.delaySeconds !== undefined) {
      delayInput.value = result.delaySeconds;
    }
    if (result.maxWidth !== undefined) {
      maxWidthInput.value = result.maxWidth;
    }
  } catch (error) {
    console.error("Error loading settings:", error);
    showStatusMessage("Failed to load settings: " + error.message, "error");
  }

  // Save settings
  saveButton.addEventListener("click", async () => {
    try {
      const settings = {
        apiKey: apiKeyInput.value.trim(),
        selectedAI: aiSelect.value,
        targetLanguage: targetLanguageSelect.value,
        delaySeconds: parseFloat(delayInput.value),
        maxWidth: parseInt(maxWidthInput.value),
      };

      await browser.storage.local.set(settings);
      showStatusMessage("Settings saved", "success");
    } catch (error) {
      console.error("Error saving settings:", error);
      showStatusMessage("Failed to save settings: " + error.message, "error");
    }
  });

  // Display status message
  function showStatusMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.classList.add(type);
    statusMessage.classList.add("visible");

    setTimeout(() => {
      console.log("Removing visible class");
      statusMessage.classList.remove("visible");
    }, 2000);
  }
});
