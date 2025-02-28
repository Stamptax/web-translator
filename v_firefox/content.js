console.log("AI translation content script loaded");

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
  },
};

// Initialisation - Get configuration
browser.storage.local
  .get(["delaySeconds", "maxWidth", "targetLanguage", "interfaceLanguage"])
  .then((result) => {
    if (result.delaySeconds !== undefined) {
      delaySeconds = result.delaySeconds;
      console.log("Delay setting loaded:", delaySeconds, "seconds");
    }
    if (result.maxWidth !== undefined) {
      maxWidth = result.maxWidth;
      console.log("Maximum width setting loaded:", maxWidth, "px");
    }
    if (result.targetLanguage) {
      targetLanguage = result.targetLanguage;
      console.log("Target language setting loaded:", targetLanguage);
    }
    if (result.interfaceLanguage) {
      interfaceLanguage = result.interfaceLanguage;
      console.log("Interface language setting loaded:", interfaceLanguage);
    }
  });

// Monitor storage changes, update settings
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.delaySeconds) {
      delaySeconds = changes.delaySeconds.newValue;
      console.log("Delay setting updated:", delaySeconds, "seconds");
    }
    if (changes.maxWidth) {
      maxWidth = changes.maxWidth.newValue;
      console.log("Maximum width setting updated:", maxWidth, "px");
    }
    if (changes.targetLanguage) {
      targetLanguage = changes.targetLanguage.newValue;
      console.log("Target language setting updated:", targetLanguage);
    }
    if (changes.interfaceLanguage) {
      interfaceLanguage = changes.interfaceLanguage.newValue;
      console.log("Interface language setting updated:", interfaceLanguage);
    }
  }
});

// Monitor mouse movement
document.addEventListener("mousemove", (event) => {
  lastMousePosition.x = event.clientX;
  lastMousePosition.y = event.clientY;
});

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

  // Request background script to translate
  browser.runtime
    .sendMessage({
      action: "translateText",
      text: selectedText,
      preserveFormat: true,
      targetLanguage: targetLanguage,
    })
    .then((response) => {
      if (response.success) {
        showTranslationBox(response.translation, false);
      } else {
        showTranslationBox(
          response.error || uiTexts[interfaceLanguage].translationFailed,
          false
        );
      }
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

// Analyse text structure
function analyzeTextStructure(text) {
  // Analyse text structure, such as paragraphs, headings, etc.
  const lines = text.split("\n");
  const structure = lines.map((line) => {
    // Try to determine if this is a heading
    if (line.trim().length > 0) {
      // Simple logic to determine if it's a heading (can be extended as needed)
      const words = line.trim().split(/\s+/);
      if (words.length <= 7 && line.length <= 100) {
        return { type: "heading", content: line };
      } else {
        return { type: "paragraph", content: line };
      }
    } else {
      return { type: "break", content: "" };
    }
  });

  return structure;
}

// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);

  if (message.action === "showTranslation") {
    console.log("Displaying translation:", message.translation);
    showTranslationBox(message.translation, message.isLoading);
    sendResponse({ status: "Translation box displayed" });
    return true;
  }

  if (message.action === "showLoading") {
    console.log("Displaying loading prompt");
    showTranslationBox("Translating...", true);
    sendResponse({ status: "Loading prompt displayed" });
    return true;
  }
});

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

    // Add CSS styles
    const style = document.createElement("style");
    style.textContent = `
      .macos-style {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
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
    `;
    document.head.appendChild(style);
  }

  // Get viewport and document dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );

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

// Add test function, usable in console
window.testTranslationBox = function (text, isLoading) {
  showTranslationBox(text || "This is a test translation message", isLoading);
};

console.log("AI translation content script initialisation complete");
