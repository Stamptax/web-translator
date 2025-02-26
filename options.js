// Plugin interface text localisation support
const uiTexts = {
  en: {
    title: "Translator Settings",
    interfaceLanguage: "文/A",
    aiSelect: "Select AI",
    apiKey: "API Key",
    apiKeyPlaceholder: "Enter API Key",
    targetLanguage: "Target Language",
    chinese: "Chinese",
    japanese: "Japanese",
    britishEnglish: "English",
    delaySeconds: "Icon Display Delay (seconds)",
    maxWidth: "Translation Box Max Width (pixels)",
    saveButton: "Save Settings",
    settingsSaved: "Settings saved",
    failedToLoad: "Failed to load settings: ",
    failedToSave: "Failed to save settings: ",
  },
  zh: {
    title: "翻译插件设置",
    interfaceLanguage: "文/A",
    aiSelect: "选择 AI",
    apiKey: "API 密钥",
    apiKeyPlaceholder: "输入API密钥",
    targetLanguage: "翻译目标语言",
    chinese: "中文",
    japanese: "日语",
    britishEnglish: "英语",
    delaySeconds: "图标显示延迟 (秒)",
    maxWidth: "翻译框最大宽度 (像素)",
    saveButton: "保存设置",
    settingsSaved: "设置已保存",
    failedToLoad: "加载设置失败: ",
    failedToSave: "保存设置失败: ",
  },
};

// Update UI text function
function updateUITexts(language) {
  const texts = uiTexts[language];

  // Update title and label text
  document.getElementById("settings-title").textContent = texts.title;
  document.getElementById("interface-language-label").textContent =
    texts.interfaceLanguage;
  document.getElementById("ai-select-label").textContent = texts.aiSelect;
  document.getElementById("api-key-label").textContent = texts.apiKey;
  document.getElementById("api-key").placeholder = texts.apiKeyPlaceholder;
  document.getElementById("target-language-label").textContent =
    texts.targetLanguage;
  document.getElementById("delay-seconds-label").textContent =
    texts.delaySeconds;
  document.getElementById("max-width-label").textContent = texts.maxWidth;
  document.getElementById("save-button").textContent = texts.saveButton;

  // Update dropdown menu target language options
  const targetLanguageSelect = document.getElementById("target-language");
  targetLanguageSelect.options[0].textContent = texts.chinese;
  targetLanguageSelect.options[1].textContent = texts.japanese;
  targetLanguageSelect.options[2].textContent = texts.britishEnglish;

  // If language is not Chinese, update document title
  document.title = texts.title;
}

// Ensure the script executes after the page is fully loaded
window.addEventListener("DOMContentLoaded", async () => {
  console.log("Settings page loaded");
  const interfaceLanguageSelect = document.getElementById("interface-language");
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
      "interfaceLanguage",
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

    // 设置界面语言
    const interfaceLanguage = result.interfaceLanguage || "zh";
    interfaceLanguageSelect.value = interfaceLanguage;
    updateUITexts(interfaceLanguage);
  } catch (error) {
    console.error("Error loading settings:", error);
    const lang = interfaceLanguageSelect.value;
    showStatusMessage(uiTexts[lang].failedToLoad + error.message, "error");
  }

  // Listen for language change, update UI texts in real-time
  interfaceLanguageSelect.addEventListener("change", () => {
    const selectedLanguage = interfaceLanguageSelect.value;
    updateUITexts(selectedLanguage);
  });

  // Save settings
  saveButton.addEventListener("click", async () => {
    try {
      const settings = {
        apiKey: apiKeyInput.value.trim(),
        selectedAI: aiSelect.value,
        targetLanguage: targetLanguageSelect.value,
        delaySeconds: parseFloat(delayInput.value),
        maxWidth: parseInt(maxWidthInput.value),
        interfaceLanguage: interfaceLanguageSelect.value,
      };

      await browser.storage.local.set(settings);
      const lang = interfaceLanguageSelect.value;
      showStatusMessage(uiTexts[lang].settingsSaved, "success");
    } catch (error) {
      console.error("Error saving settings:", error);
      const lang = interfaceLanguageSelect.value;
      showStatusMessage(uiTexts[lang].failedToSave + error.message, "error");
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
