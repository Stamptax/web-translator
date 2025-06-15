// ==UserScript==
// @name         Minimalist AI Translator (Tampermonkey Version)
// @namespace    https://tampermonkey.net/
// @version      1.0.0
// @description  A minimalist translator using AI APIs - Convert from Firefox extension to Tampermonkey userscript
// @author       You
// @match        *://*/*
// @exclude      https://chrome.google.com/webstore/*
// @exclude      https://addons.mozilla.org/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  // Configuration and variables
  let selectionTimeout = null;
  let selectionIcon = null;
  let lastMousePosition = { x: 0, y: 0 };
  let delaySeconds = 0.5; // Default delay time in seconds
  let maxWidth = 400; // Default maximum width
  let targetLanguage = "chinese"; // Default target language
  let isTranslating = false;
  let translationBox = null;
  let selectionInProgress = false; // Add tracking variable for selection state
  let interfaceLanguage = "zh"; // Default to Chinese

  // UI text translation table
  const uiTexts = {
    en: {
      translatingTo: "Translating to",
      translating: "Translating...",
      copyButton: "Copy",
      copied: "Copied",
      translationError: "Translation error:",
      translationFailed: "Translation failed",
      requestFailed: "Translation request failed:",
      configureApiKey: "Please configure an API key in settings",
      selectAI: "Please select an AI model in settings",
      pleaseConfigureApi:
        "Please configure an API key and select an AI model in settings first.",
      settingsTitle: "Translator Settings",
      interfaceLanguageLabel: "文/A",
      aiSelectLabel: "Select AI",
      apiKeyLabel: "API Key",
      apiKeyPlaceholder: "Enter API Key",
      targetLanguageLabel: "Target Language",
      chinese: "Chinese",
      japanese: "Japanese",
      britishEnglish: "English",
      delaySecondsLabel: "Icon Display Delay (seconds)",
      maxWidthLabel: "Translation Box Max Width (pixels)",
      saveButton: "Save Settings",
      settingsSaved: "Settings saved",
      failedToLoad: "Failed to load settings: ",
      failedToSave: "Failed to save settings: ",
      openSettings: "Open Translator Settings",
    },
    zh: {
      translatingTo: "正在翻译成",
      translating: "正在翻译...",
      copyButton: "复制",
      copied: "已复制",
      translationError: "翻译错误：",
      translationFailed: "翻译失败",
      requestFailed: "翻译请求失败：",
      configureApiKey: "请在设置中配置 API 密钥",
      selectAI: "请在设置中选择 AI 模型",
      pleaseConfigureApi: "请先在设置中输入 API 密钥并选择 AI 模型。",
      settingsTitle: "翻译插件设置",
      interfaceLanguageLabel: "文/A",
      aiSelectLabel: "选择 AI",
      apiKeyLabel: "API 密钥",
      apiKeyPlaceholder: "输入API密钥",
      targetLanguageLabel: "翻译目标语言",
      chinese: "中文",
      japanese: "日语",
      britishEnglish: "英语",
      delaySecondsLabel: "图标显示延迟 (秒)",
      maxWidthLabel: "翻译框最大宽度 (像素)",
      saveButton: "保存设置",
      settingsSaved: "设置已保存",
      failedToLoad: "加载设置失败: ",
      failedToSave: "保存设置失败: ",
      openSettings: "打开翻译器设置",
    },
  };

  // Storage functions using GM API
  function getStoredValue(key, defaultValue = null) {
    return GM_getValue(key, defaultValue);
  }

  function setStoredValue(key, value) {
    GM_setValue(key, value);
  }

  // Load configuration from storage
  function loadConfiguration() {
    delaySeconds = getStoredValue("delaySeconds", 0.5);
    maxWidth = getStoredValue("maxWidth", 400);
    targetLanguage = getStoredValue("targetLanguage", "chinese");
    interfaceLanguage = getStoredValue("interfaceLanguage", "zh");

    console.log("Configuration loaded:", {
      delaySeconds,
      maxWidth,
      targetLanguage,
      interfaceLanguage,
    });
  }

  // Get target language text description
  function getTargetLanguageDescription(langCode) {
    const languages = {
      chinese: "Chinese",
      japanese: "Japanese",
      "british-english": "English",
    };
    return languages[langCode] || "Chinese";
  }

  // Get system prompt optimised for different languages
  function getSystemPrompt(languageCode, preserveFormat) {
    // Base prompt
    let basePrompt = "You are a precise translation assistant.";

    // Add format preservation instructions
    if (preserveFormat) {
      basePrompt +=
        "Please maintain the original format structure (headings, paragraphs, etc.), ensuring the translated text matches the original format exactly.";
    }

    // Add language-specific instructions
    switch (languageCode) {
      case "chinese":
        basePrompt +=
          "Please translate the text into fluent, natural Chinese, using modern Mandarin expressions and avoiding literal translations.";
        break;
      case "japanese":
        basePrompt +=
          "Please translate the text into standard Japanese, using appropriate honorifics and grammatical structures, ensuring it conforms to Japanese expression habits.";
        break;
      case "british-english":
        basePrompt +=
          "Please translate the text into British English, using British spelling conventions (such as 'colour' rather than 'color'), and British expressions.";
        break;
      default:
        basePrompt += "Please provide an accurate translation.";
    }

    return basePrompt;
  }

  // Translate text function
  async function translateText(
    text,
    preserveFormat = false,
    structure = null,
    requestTargetLang = null
  ) {
    console.log("Starting text translation:", text);
    console.log("Preserve format:", preserveFormat);
    console.log("Requested target language:", requestTargetLang);

    try {
      // Get stored API key, AI model, target language and interface language
      const apiKey = getStoredValue("apiKey");
      const selectedAI = getStoredValue("selectedAI");
      const storedTargetLanguage = getStoredValue("targetLanguage", "chinese");
      const storedInterfaceLanguage = getStoredValue("interfaceLanguage", "zh");

      // Default to Chinese interface
      const uiLang = storedInterfaceLanguage || "zh";

      if (!apiKey) {
        return uiTexts[uiLang].pleaseConfigureApi;
      }

      if (!selectedAI) {
        return uiTexts[uiLang].pleaseConfigureApi;
      }

      // Prioritise target language from request, then stored setting, then default to Chinese
      const languageCode =
        requestTargetLang || storedTargetLanguage || "chinese";
      const languageName = getTargetLanguageDescription(languageCode);
      console.log("Target language:", languageName);

      let prompt = "";
      if (preserveFormat && structure) {
        // If format preservation needed, use special prompt instructions
        prompt = `Please translate the following text to ${languageName}, maintaining the original text format structure (such as paragraphs, headings, etc.). Please maintain the same language style whilst translating:\n\n${text}`;
      } else {
        // Normal translation prompt
        prompt = `Please translate the following text to ${languageName}:\n\n${text}`;
      }

      let translatedText = "";

      console.log("Using AI model:", selectedAI);
      console.log("Prompt content:", prompt);

      return new Promise((resolve, reject) => {
        const requestDetails = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          onload: function (response) {
            try {
              const data = JSON.parse(response.responseText);

              if (selectedAI === "openai") {
                if (response.status !== 200) {
                  throw new Error(data.error?.message || "OpenAI API error");
                }
                translatedText = data.choices[0].message.content.trim();
              } else if (selectedAI === "gemini") {
                if (response.status !== 200) {
                  throw new Error(
                    data.error?.message || "Google Gemini API error"
                  );
                }
                translatedText =
                  data.candidates[0].content.parts[0].text.trim();
              }

              resolve(translatedText);
            } catch (error) {
              reject(error);
            }
          },
          onerror: function (error) {
            reject(new Error("Network error"));
          },
        };

        if (selectedAI === "openai") {
          // OpenAI API call
          requestDetails.url = "https://api.openai.com/v1/chat/completions";
          requestDetails.headers.Authorization = `Bearer ${apiKey}`;
          requestDetails.data = JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: getSystemPrompt(languageCode, preserveFormat),
              },
              { role: "user", content: prompt },
            ],
          });
        } else if (selectedAI === "gemini") {
          // Google Gemini API call
          requestDetails.url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
          requestDetails.data = JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text:
                      getSystemPrompt(languageCode, preserveFormat) +
                      "\n" +
                      prompt,
                  },
                ],
              },
            ],
          });
        }

        GM_xmlhttpRequest(requestDetails);
      });
    } catch (error) {
      console.error("Error during translation:", error);
      const storedInterfaceLanguage = getStoredValue("interfaceLanguage", "zh");
      return `${uiTexts[storedInterfaceLanguage].translationError}${error.message}`;
    }
  }

  // Function to remove selection icon and translation box
  function removeUIElements() {
    // Remove icon
    if (selectionIcon) {
      selectionIcon.remove();
      selectionIcon = null;
    }

    // Remove translation box
    if (translationBox) {
      translationBox.remove();
      translationBox = null;
    }
  }

  // Monitor mouse movement
  document.addEventListener("mousemove", (event) => {
    lastMousePosition.x = event.clientX;
    lastMousePosition.y = event.clientY;
  });

  // Monitor mouse down - Start new selection
  document.addEventListener("mousedown", () => {
    // If not translating, mark as selection start and clear existing UI
    if (!isTranslating) {
      selectionInProgress = true;
      clearTimeout(selectionTimeout);
      removeUIElements();
    }
  });

  // Monitor text selection changes - No longer creating icons, only tracking selection state
  document.addEventListener("selectionchange", () => {
    // Only update in non-translating state
    if (!isTranslating) {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      // If no text is selected and not in selection process, remove UI elements
      if (selectedText.length === 0 && !selectionInProgress) {
        clearTimeout(selectionTimeout);
        removeUIElements();
      }
    }
  });

  // Only process selected text and display icon when mouse is released
  document.addEventListener("mouseup", () => {
    // Mark selection process as ended
    selectionInProgress = false;

    // If translating, don't process selection
    if (isTranslating) return;

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Clear any existing timeout
    clearTimeout(selectionTimeout);

    if (selectedText.length > 0) {
      console.log("Text selection detected:", selectedText);

      // Set delayed icon display
      selectionTimeout = setTimeout(() => {
        // Ensure no existing UI elements
        removeUIElements();
        console.log("Displaying translation icon");
        showSelectionIcon();
      }, delaySeconds * 1000);
    } else {
      // No text selected, remove UI elements
      removeUIElements();
    }
  });

  // Display selection icon
  function showSelectionIcon() {
    try {
      // If icon already exists or translating, don't create new icon
      if (selectionIcon || isTranslating) return;

      // Create icon
      selectionIcon = document.createElement("div");
      selectionIcon.className = "ai-translator-icon";
      selectionIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 8l6 6M9 6l7 7M4 14l4 4 4-4M10.5 8.5c1.5-1.5 3.5-1.5 5 0s1.5 3.5 0 5-3.5 1.5-5 0-1.5-3.5 0-5z"/>
                </svg>
            `;

      // Set style and position
      Object.assign(selectionIcon.style, {
        position: "fixed",
        top: lastMousePosition.y + 10 + "px",
        left: lastMousePosition.x + 10 + "px",
        width: "30px",
        height: "30px",
        borderRadius: "50%",
        backgroundColor: "#5a95f5",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: "10000",
        boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
        transition: "transform 0.2s, background-color 0.2s",
      });

      // Add hover effect and translation trigger
      selectionIcon.addEventListener("mouseenter", () => {
        if (!isTranslating) {
          selectionIcon.style.transform = "scale(1.1)";
          selectionIcon.style.backgroundColor = "#347af0";
          translateSelectedText();
        }
      });

      selectionIcon.addEventListener("mouseleave", () => {
        selectionIcon.style.transform = "scale(1)";
        selectionIcon.style.backgroundColor = "#5a95f5";
      });

      // Add to page
      document.body.appendChild(selectionIcon);

      // Add document click event, close UI when clicking outside area
      document.addEventListener("click", handleDocumentClick);
    } catch (error) {
      console.error("Error displaying translation icon:", error);
    }
  }

  // Handle document click event
  function handleDocumentClick(e) {
    // Check if clicked inside translation box
    if (translationBox && translationBox.contains(e.target)) {
      return; // If clicked in translation box, do nothing
    }

    // Check if clicked on icon
    if (selectionIcon && selectionIcon.contains(e.target)) {
      return; // If clicked on icon, do nothing
    }

    // If clicked elsewhere, remove UI elements
    if (selectionIcon || translationBox) {
      removeUIElements();
      document.removeEventListener("click", handleDocumentClick);
    }
  }

  // Translate selected text
  function translateSelectedText() {
    const selectedText = window.getSelection().toString().trim();
    if (!selectedText) return;

    isTranslating = true;

    // Get target language display name
    const languageNames = {
      chinese: interfaceLanguage === "zh" ? "中文" : "Chinese",
      japanese: interfaceLanguage === "zh" ? "日语" : "Japanese",
      "british-english": interfaceLanguage === "zh" ? "英语" : "English",
    };
    const displayLanguage =
      languageNames[targetLanguage] ||
      (interfaceLanguage === "zh" ? "中文" : "Chinese");

    // Show loading prompt, including target language information
    const loadingText = `${uiTexts[interfaceLanguage].translatingTo} ${displayLanguage}...`;
    showTranslationBox(loadingText, true);

    // Translate text
    translateText(selectedText, true, null, targetLanguage)
      .then((translation) => {
        showTranslationBox(translation, false);
      })
      .catch((error) => {
        console.error("Translation request error:", error);
        showTranslationBox(
          uiTexts[interfaceLanguage].requestFailed + " " + error.message,
          false
        );
      })
      .finally(() => {
        isTranslating = false;
      });
  }

  // Display translation box or loading prompt - macOS style version
  function showTranslationBox(translation, isLoading = false) {
    console.log("Creating translation box");

    // Remove existing translation box
    if (translationBox) {
      translationBox.remove();
    }

    // Create new translation box - macOS style
    translationBox = document.createElement("div");
    translationBox.id = "ai-translation-box";
    translationBox.classList.add("ai-translation-box", "macos-style");

    // Ensure translation box content is selectable
    translationBox.setAttribute("data-selectable", "true");

    // If loading prompt, add loading animation
    if (isLoading) {
      // macOS style loading interface
      translationBox.innerHTML = `
                <div class="translation-content loading-content">
                    <div class="loading-spinner"></div>
                    <div>${translation}</div>
                </div>
            `;
    } else {
      // Hide icon after translation is complete
      if (selectionIcon) {
        selectionIcon.style.display = "none";
      }

      // Create header bar
      const headerDiv = document.createElement("div");
      headerDiv.className = "translation-header";

      // Add copy button to header bar
      const copyButton = document.createElement("button");
      copyButton.innerHTML = uiTexts[interfaceLanguage].copyButton;
      copyButton.className = "ai-translator-copy-button";
      headerDiv.appendChild(copyButton);

      // Create content area
      const contentDiv = document.createElement("div");
      contentDiv.className = "translation-content";

      // Support HTML formatted output
      if (translation.includes("<p>") || translation.includes("<h")) {
        // If translation result already contains HTML tags, use directly
        contentDiv.innerHTML = translation;
      } else {
        // Otherwise convert line breaks to HTML paragraphs
        const formattedTranslation = translation
          .split("\n\n")
          .map((para) => para.trim())
          .filter((para) => para.length > 0)
          .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
          .join("");

        contentDiv.innerHTML = formattedTranslation;
      }

      // Assemble translation box
      translationBox.appendChild(headerDiv);
      translationBox.appendChild(contentDiv);

      // Copy button event handling
      copyButton.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Get text from translation content area
        const textToCopy = contentDiv.innerText.trim();

        // Use reliable copy method
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();

        try {
          const successful = document.execCommand("copy");
          if (successful) {
            // Indicate copy success
            const originalText = copyButton.innerText;
            copyButton.innerText = uiTexts[interfaceLanguage].copied;
            copyButton.classList.add("copied");

            setTimeout(() => {
              copyButton.innerText = originalText;
              copyButton.classList.remove("copied");
            }, 1500);
          }
        } catch (err) {
          console.error("Copy failed:", err);
        }

        document.body.removeChild(textArea);
      });
    }

    // Get viewport and document dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Use user-set maximum width
    const estimatedWidth = Math.min(viewportWidth * 0.8, maxWidth);

    // Initial display position - right of mouse
    let x = lastMousePosition.x + 15;
    let y = lastMousePosition.y + 15;

    // Create a temporary, invisible box to calculate actual height
    translationBox.style.position = "fixed";
    translationBox.style.visibility = "hidden";
    translationBox.style.maxWidth = estimatedWidth + "px";
    translationBox.style.width = "360px"; // Fixed width, macOS style
    translationBox.style.maxHeight = "none"; // Temporarily unrestricted height to get full height
    document.body.appendChild(translationBox);

    // Get actual dimensions
    const actualHeight = translationBox.offsetHeight;
    const actualWidth = translationBox.offsetWidth;

    // Determine best display position based on content length
    // 1. Check right side space
    if (x + actualWidth > viewportWidth) {
      // Right side space insufficient, try displaying on left
      x = Math.max(10, lastMousePosition.x - actualWidth - 15);
    }

    // 2. Check space below
    const spaceBelow = viewportHeight - y;
    const spaceAbove = lastMousePosition.y - 10;

    if (actualHeight > spaceBelow) {
      // Space below insufficient
      if (
        spaceAbove > spaceBelow &&
        spaceAbove > Math.min(300, actualHeight / 2)
      ) {
        // Space above is larger, display above
        y = Math.max(10, lastMousePosition.y - actualHeight - 15);
      } else {
        // Space above and below not ideal, use fixed height and add scrollbar
        let maxHeightPercentage = 70; // Default maximum height is 70% of viewport

        // If mouse is in lower half of page, prioritise displaying above
        if (lastMousePosition.y > viewportHeight / 2) {
          // Display in upper half
          y = 20; // Small distance from top
          maxHeightPercentage = Math.min(
            80,
            ((lastMousePosition.y - 40) / viewportHeight) * 100
          );
        } else {
          // Display in lower half
          y = lastMousePosition.y + 15;
          maxHeightPercentage = Math.min(
            80,
            ((viewportHeight - y - 20) / viewportHeight) * 100
          );
        }

        // Set maximum height
        translationBox.style.maxHeight = maxHeightPercentage + "vh";
      }
    }

    // Remove temporary attributes
    translationBox.style.visibility = "";

    // Apply final style
    Object.assign(translationBox.style, {
      position: "fixed",
      left: x + "px",
      top: y + "px",
      zIndex: "10001",
      width: estimatedWidth + "px", // Use width based on user setting
    });

    console.log("Translation box added to page");

    // Ensure right-click menu is available
    translationBox.addEventListener("contextmenu", (e) => {
      e.stopPropagation();
    });

    // Prevent closing translation box when clicking inside
    translationBox.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });

    // Prevent triggering other events when selecting text
    translationBox.addEventListener("mouseup", (e) => {
      e.stopPropagation();
    });

    // Prevent click event bubbling
    translationBox.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Add a simple click handler to document
    const handleOutsideClick = (e) => {
      // Only close when clicking outside translation box and selection icon
      if (
        translationBox &&
        !translationBox.contains(e.target) &&
        (!selectionIcon || !selectionIcon.contains(e.target))
      ) {
        // Remove UI elements
        removeUIElements();
        // Remove event listener
        document.removeEventListener("click", handleOutsideClick);
      }
    };

    // Add delay to prevent immediate triggering
    setTimeout(() => {
      document.addEventListener("click", handleOutsideClick);
    }, 100);
  }

  // Settings interface
  function createSettingsInterface() {
    // Create settings container
    const settingsContainer = document.createElement("div");
    settingsContainer.id = "ai-translator-settings";
    settingsContainer.innerHTML = `
            <div class="settings-overlay">
                <div class="settings-modal">
                    <div class="settings-header">
                        <h2 id="settings-title">${uiTexts[interfaceLanguage].settingsTitle}</h2>
                        <button class="close-settings" id="close-settings">×</button>
                    </div>
                    <div class="settings-content">
                        <div class="settings-group">
                            <label for="interface-language">${uiTexts[interfaceLanguage].interfaceLanguageLabel}</label>
                            <select id="interface-language">
                                <option value="zh">${uiTexts[interfaceLanguage].chinese}</option>
                                <option value="en">English</option>
                            </select>
                        </div>

                        <div class="settings-group">
                            <label for="ai-select">${uiTexts[interfaceLanguage].aiSelectLabel}</label>
                            <select id="ai-select">
                                <option value="openai">ChatGPT</option>
                                <option value="gemini">Gemini</option>
                            </select>
                        </div>

                        <div class="settings-group">
                            <label for="api-key">${uiTexts[interfaceLanguage].apiKeyLabel}</label>
                            <input type="password" id="api-key" placeholder="${uiTexts[interfaceLanguage].apiKeyPlaceholder}" />
                        </div>

                        <div class="settings-group">
                            <label for="target-language">${uiTexts[interfaceLanguage].targetLanguageLabel}</label>
                            <select id="target-language">
                                <option value="chinese">${uiTexts[interfaceLanguage].chinese}</option>
                                <option value="japanese">${uiTexts[interfaceLanguage].japanese}</option>
                                <option value="british-english">${uiTexts[interfaceLanguage].britishEnglish}</option>
                            </select>
                        </div>

                        <div class="settings-group">
                            <label for="delay-seconds">${uiTexts[interfaceLanguage].delaySecondsLabel}</label>
                            <input type="number" id="delay-seconds" min="0.1" max="5" step="0.1" value="0.5" />
                        </div>

                        <div class="settings-group">
                            <label for="max-width">${uiTexts[interfaceLanguage].maxWidthLabel}</label>
                            <input type="number" id="max-width" min="200" max="1000" step="10" value="400" />
                        </div>

                        <button id="save-settings" class="save-button">${uiTexts[interfaceLanguage].saveButton}</button>
                        <div id="settings-status" class="settings-status"></div>
                    </div>
                </div>
            </div>
        `;

    document.body.appendChild(settingsContainer);

    // Load current settings
    document.getElementById("interface-language").value = getStoredValue(
      "interfaceLanguage",
      "zh"
    );
    document.getElementById("ai-select").value = getStoredValue(
      "selectedAI",
      ""
    );
    document.getElementById("api-key").value = getStoredValue("apiKey", "");
    document.getElementById("target-language").value = getStoredValue(
      "targetLanguage",
      "chinese"
    );
    document.getElementById("delay-seconds").value = getStoredValue(
      "delaySeconds",
      0.5
    );
    document.getElementById("max-width").value = getStoredValue(
      "maxWidth",
      400
    );

    // Interface language change handler
    document
      .getElementById("interface-language")
      .addEventListener("change", function () {
        const selectedLang = this.value;
        interfaceLanguage = selectedLang;

        // Update all text elements
        document.getElementById("settings-title").textContent =
          uiTexts[selectedLang].settingsTitle;
        document.querySelector('label[for="interface-language"]').textContent =
          uiTexts[selectedLang].interfaceLanguageLabel;
        document.querySelector('label[for="ai-select"]').textContent =
          uiTexts[selectedLang].aiSelectLabel;
        document.querySelector('label[for="api-key"]').textContent =
          uiTexts[selectedLang].apiKeyLabel;
        document.getElementById("api-key").placeholder =
          uiTexts[selectedLang].apiKeyPlaceholder;
        document.querySelector('label[for="target-language"]').textContent =
          uiTexts[selectedLang].targetLanguageLabel;
        document.querySelector('label[for="delay-seconds"]').textContent =
          uiTexts[selectedLang].delaySecondsLabel;
        document.querySelector('label[for="max-width"]').textContent =
          uiTexts[selectedLang].maxWidthLabel;
        document.getElementById("save-settings").textContent =
          uiTexts[selectedLang].saveButton;

        // Update target language options
        const targetSelect = document.getElementById("target-language");
        targetSelect.options[0].textContent = uiTexts[selectedLang].chinese;
        targetSelect.options[1].textContent = uiTexts[selectedLang].japanese;
        targetSelect.options[2].textContent =
          uiTexts[selectedLang].britishEnglish;
      });

    // Close settings
    document
      .getElementById("close-settings")
      .addEventListener("click", function () {
        settingsContainer.remove();
      });

    // Save settings
    document
      .getElementById("save-settings")
      .addEventListener("click", function () {
        const settings = {
          interfaceLanguage:
            document.getElementById("interface-language").value,
          selectedAI: document.getElementById("ai-select").value,
          apiKey: document.getElementById("api-key").value.trim(),
          targetLanguage: document.getElementById("target-language").value,
          delaySeconds: parseFloat(
            document.getElementById("delay-seconds").value
          ),
          maxWidth: parseInt(document.getElementById("max-width").value),
        };

        // Save all settings
        Object.keys(settings).forEach((key) => {
          setStoredValue(key, settings[key]);
        });

        // Update local variables
        loadConfiguration();

        // Show success message
        const statusDiv = document.getElementById("settings-status");
        statusDiv.textContent = uiTexts[interfaceLanguage].settingsSaved;
        statusDiv.className = "settings-status success";

        setTimeout(() => {
          statusDiv.textContent = "";
          statusDiv.className = "settings-status";
        }, 2000);
      });

    // Close on overlay click
    settingsContainer
      .querySelector(".settings-overlay")
      .addEventListener("click", function (e) {
        if (e.target === this) {
          settingsContainer.remove();
        }
      });
  }

  // Add CSS styles using GM_addStyle
  GM_addStyle(`
        /* Translator plugin styles */
        .ai-translator-icon {
            transition: transform 0.2s, background-color 0.2s;
            animation: fadeIn 0.3s;
            border-radius: 50%;
            background-color: #2196f3;
            color: white;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
        }

        .ai-translator-icon:hover {
            transform: scale(1.1);
            background-color: #1e88e5;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        /* Translation popup box styles */
        .ai-translation-box {
            position: fixed;
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            padding: 16px 20px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            z-index: 10000;
            max-width: 80%;
            border-radius: 8px;
            font-size: 14px;
            line-height: 1.6;
            color: #333333;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
        }

        .macos-style {
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
            overflow: hidden;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(210, 210, 210, 0.5);
        }

        .translation-header {
            display: flex;
            justify-content: start;
            align-items: center;
        }

        .translation-content {
            padding: 15px;
            max-height: 60vh;
            overflow-y: auto;
            border-radius: 6px;
            border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .loading-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 80px;
        }

        .ai-translator-copy-button {
            background-color: #f1f1f1;
            border: 1px solid #d1d1d1;
            border-radius: 4px;
            padding: 3px 10px;
            font-size: 12px;
            color: #333;
            cursor: pointer;
            transition: all 0.2s;
            margin: 0;
            line-height: 1.5;
        }

        .ai-translator-copy-button:hover {
            background-color: #e1e1e1;
        }

        .ai-translator-copy-button.copied {
            background-color: #4CAF50;
            color: white;
            border-color: #43A047;
        }

        /* Content styles */
        .translation-content p {
            margin: 0 0 10px 0;
            line-height: 1.6;
            color: #333;
        }

        .translation-content p:last-child {
            margin-bottom: 0;
        }

        .translation-content h1, .translation-content h2, .translation-content h3 {
            margin: 15px 0 10px 0;
            font-weight: 600;
            color: #333;
        }

        /* Ensure content is selectable */
        .translation-content, .translation-content * {
            user-select: text !important;
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            cursor: text !important;
        }

        /* Loading animation */
        .loading-spinner {
            width: 22px;
            height: 22px;
            border: 2px solid rgba(0, 122, 255, 0.2);
            border-top: 2px solid #007aff;
            border-radius: 50%;
            margin: 0 auto 15px auto;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Settings modal styles */
        .settings-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 20000;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .settings-modal {
            background-color: white;
            border-radius: 10px;
            padding: 20px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
        }

        .settings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 10px;
        }

        .settings-header h2 {
            margin: 0;
            color: #333;
        }

        .close-settings {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
        }

        .close-settings:hover {
            background-color: #f0f0f0;
        }

        .settings-group {
            margin-bottom: 15px;
        }

        .settings-group label {
            display: block;
            margin-bottom: 5px;
            color: #555;
            font-weight: 500;
            font-size: 13px;
        }

        .settings-group input,
        .settings-group select {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            box-sizing: border-box;
            font-size: 14px;
            background-color: #ffffff;
            color: #333333;
        }

        .settings-group input:focus,
        .settings-group select:focus {
            outline: none;
            border-color: #2196f3;
            box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
        }

        .save-button {
            background-color: #2196f3;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            width: 100%;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 10px;
        }

        .save-button:hover {
            background-color: #1e88e5;
        }

        .settings-status {
            text-align: center;
            padding: 10px;
            border-radius: 5px;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.3s;
        }

        .settings-status.success {
            background-color: #f1f8e9;
            color: #33691e;
            border: 1px solid #dcedc8;
            opacity: 1;
        }
    `);

  // Register menu command
  GM_registerMenuCommand(
    uiTexts[interfaceLanguage].openSettings,
    createSettingsInterface
  );

  // Initialise
  loadConfiguration();

  // Add test function, usable in console
  window.testTranslationBox = function (text, isLoading) {
    showTranslationBox(text || "This is a test translation message", isLoading);
  };

  console.log("AI translation Tampermonkey script initialisation complete");
})();
