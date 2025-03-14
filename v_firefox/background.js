console.log("AI translation background script loading");

// Create context menu
browser.contextMenus.create(
  {
    id: "translate-with-ai",
    title: "Translate with AI",
    contexts: ["selection"],
  },
  () => {
    if (browser.runtime.lastError) {
      console.error("Error creating context menu:", browser.runtime.lastError);
    } else {
      console.log("Context menu created successfully");
    }
  }
);

// Listen for messages from content script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translateText") {
    console.log("Translation request received:", request.text);
    console.log("Preserve format:", request.preserveFormat);
    console.log("Target language:", request.targetLanguage);

    // Start translation processing, pass all parameters
    translateText(
      request.text,
      request.preserveFormat,
      request.structure,
      request.targetLanguage
    )
      .then((translation) => {
        console.log("Translation complete");
        sendResponse({
          success: true,
          translation: translation,
        });
      })
      .catch((error) => {
        console.error("Translation error:", error);
        sendResponse({
          success: false,
          error: `Translation error: ${error.message}`,
        });
      });

    return true; // Keep message channel open to support async response
  }
});

// Listen for context menu clicks
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("Context menu clicked:", info);
  if (info.menuItemId === "translate-with-ai") {
    try {
      // Get stored API key and AI model
      const { apiKey, selectedAI } = await browser.storage.local.get([
        "apiKey",
        "selectedAI",
      ]);
      const text = info.selectionText;

      console.log("Currently selected AI:", selectedAI);
      console.log("API key exists:", apiKey ? "yes" : "no");
      console.log("Text to translate:", text);

      // First display loading prompt
      try {
        await browser.tabs.sendMessage(tab.id, {
          action: "showLoading",
          translation: "Translating...",
        });
      } catch (error) {
        console.error("Failed to send loading prompt:", error);
        try {
          // Try injecting content script
          await browser.tabs.executeScript(tab.id, {
            file: "content.js",
          });
          await browser.tabs.sendMessage(tab.id, {
            action: "showLoading",
            translation: "Translating...",
          });
        } catch (err) {
          console.error("Failed to inject content script:", err);
        }
      }

      // Check if API key and AI model are set
      if (!apiKey || !selectedAI) {
        console.log(
          "API key or AI model not set, sending notification message"
        );
        try {
          await browser.tabs.sendMessage(tab.id, {
            action: "showTranslation",
            translation:
              "Please enter an API key and select an AI model in the extension settings first.",
          });
        } catch (error) {
          console.error("Failed to send message:", error);
          // Try injecting content script
          await browser.tabs.executeScript(tab.id, {
            file: "content.js",
          });
          // Resend message
          await browser.tabs.sendMessage(tab.id, {
            action: "showTranslation",
            translation:
              "Please enter an API key and select an AI model in the extension settings first.",
          });
        }
        return;
      }

      // Start translation
      console.log("Starting text translation");
      const translation = await translateText(text);
      console.log("Translation result received");

      // Send translation result to content script
      try {
        await browser.tabs.sendMessage(tab.id, {
          action: "showTranslation",
          translation: translation,
          isLoading: false,
        });
        console.log("Translation result sent to content script");
      } catch (error) {
        console.error("Failed to send translation result:", error);
        // Try injecting content script and resending message
        await browser.tabs.executeScript(tab.id, {
          file: "content.js",
        });
        await browser.tabs.sendMessage(tab.id, {
          action: "showTranslation",
          translation: translation,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error("Error processing context menu click:", error);
      try {
        await browser.tabs.sendMessage(tab.id, {
          action: "showTranslation",
          translation: `Translation error: ${error.message}`,
          isLoading: false,
        });
      } catch (sendError) {
        console.error("Failed to send error message:", sendError);
      }
    }
  }
});

// Get target language text description
function getTargetLanguageDescription(langCode) {
  const languages = {
    chinese: "Chinese",
    japanese: "Japanese",
    "british-english": "English",
  };
  return languages[langCode] || "Chinese";
}

// Add UI text localisation support
const uiTexts = {
  en: {
    pleaseConfigureApi:
      "Please configure an API key and select an AI model in the extension settings first.",
    translationError: "Translation error: ",
  },
  zh: {
    pleaseConfigureApi: "请先在扩展设置中输入 API 密钥并选择 AI 模型。",
    translationError: "翻译错误: ",
  },
};

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
    const { apiKey, selectedAI, targetLanguage, interfaceLanguage } =
      await browser.storage.local.get([
        "apiKey",
        "selectedAI",
        "targetLanguage",
        "interfaceLanguage",
      ]);

    // Default to Chinese interface
    const uiLang = interfaceLanguage || "zh";

    if (!apiKey) {
      return uiTexts[uiLang].pleaseConfigureApi;
    }

    if (!selectedAI) {
      return uiTexts[uiLang].pleaseConfigureApi;
    }

    // Prioritise target language from request, then stored setting, then default to Chinese
    const languageCode = requestTargetLang || targetLanguage || "chinese";
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

    if (selectedAI === "openai") {
      // OpenAI API call
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: getSystemPrompt(languageCode, preserveFormat),
              },
              { role: "user", content: prompt },
            ],
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "OpenAI API error");
      }

      const data = await response.json();
      translatedText = data.choices[0].message.content.trim();
    } else if (selectedAI === "gemini") {
      // Google Gemini API call
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
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
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Google Gemini API error");
      }

      const data = await response.json();
      translatedText = data.candidates[0].content.parts[0].text.trim();
    }

    return translatedText;
  } catch (error) {
    console.error("Error during translation:", error);
    const interfaceLanguage = await browser.storage.local
      .get("interfaceLanguage")
      .then((result) => result.interfaceLanguage || "zh");
    return `${uiTexts[interfaceLanguage].translationError}${error.message}`;
  }
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

console.log("AI translation background script loaded");
