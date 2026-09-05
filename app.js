// ============================================================================
// XAMO AI - FULL PRODUCTION CLIENT ENGINE (PERSISTENCE & SPEED OPTIMIZED)
// ============================================================================

const SUPABASE_URL = "https://vnlhctmxlctsvyhwyvrl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGhjdG14bGN0c3Z5aHd5dnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MzE0NzgsImV4cCI6MjEwMzMwNzQ3OH0.uj2A-itY_CPhZDmWgF9TCYXgR5PXMGeGXa7L58DD_3w";
const ADMIN_EMAIL = "xamoxm366@gmail.com";

let supabaseClient = null;
try {
  if (typeof window.supabase !== 'undefined' && SUPABASE_URL.startsWith('https://')) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn("Supabase init skipped:", e);
}

let currentUser = null;
let userNickname = "";
let activeStreamAbortController = null;
let scrollVanishTimer = null;

let appSettings = JSON.parse(localStorage.getItem('xamo_app_settings') || '{"language":"auto","timeFormat":"12"}');

const withTimeout = (promise, ms = 7000) => 
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Network request timed out. Please try again.")), ms))
  ]);

// --- DOM References ---
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const submitBtn = document.getElementById('submit-btn');
const chatBox = document.getElementById('chat-box');
const clearBtn = document.getElementById('clear-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const chatList = document.getElementById('chat-list');
const searchChatsInput = document.getElementById('search-chats');
const exportBtn = document.getElementById('export-btn');

const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const closeSidebarBtn = document.getElementById('close-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettings = document.getElementById('close-settings');
const saveSettings = document.getElementById('save-settings');
const settingsLangSelect = document.getElementById('settings-language-select');
const settingsTimeSelect = document.getElementById('settings-time-format-select');

const personaBtn = document.getElementById('persona-btn');
const personaDropdown = document.getElementById('persona-dropdown');
const personaLabel = document.getElementById('persona-label');
const personaListOptions = document.getElementById('persona-list-options');
const addPersonaTrigger = document.getElementById('add-persona-trigger');
const personaModal = document.getElementById('persona-modal');
const closePersonaModal = document.getElementById('close-persona-modal');
const savePersonaBtn = document.getElementById('save-persona-btn');

const newPersonaName = document.getElementById('persona-name-input');
const newPersonaPrompt = document.getElementById('persona-prompt-input');

const imageInput = document.getElementById('image-input');
const attachBtn = document.getElementById('attach-btn');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image');
const fileNamePreview = document.getElementById('file-name-preview');
const fileIcon = document.getElementById('file-icon');

const fileViewerModal = document.getElementById('file-viewer-modal');
const closeFileViewer = document.getElementById('close-file-viewer');
const viewerFileIcon = document.getElementById('viewer-file-icon');
const viewerFileTitle = document.getElementById('viewer-file-title');
const viewerContentContainer = document.getElementById('viewer-content-container');
const viewerCopyBtn = document.getElementById('viewer-copy-btn');

const verifiedModal = document.getElementById('verified-modal');
const closeVerifiedBtn = document.getElementById('close-verified-btn');

const userLoggedInView = document.getElementById('user-logged-in-view');
const guestSigninView = document.getElementById('guest-signin-view');
const guestSigninBtn = document.getElementById('guest-signin-btn');
const userEmailDisplay = document.getElementById('user-email-display');
const accountSwitcherBtn = document.getElementById('account-switcher-btn');
const accountSwitcherMenu = document.getElementById('account-switcher-menu');
const savedAccountsList = document.getElementById('saved-accounts-list');
const addAnotherAccountBtn = document.getElementById('add-another-account-btn');
const signoutCurrentAccountBtn = document.getElementById('signout-current-account-btn');

const pinnedNotesModal = document.getElementById('pinned-notes-modal');
const pinnedNotesTriggerBtn = document.getElementById('pinned-notes-trigger-btn');
const closePinnedModal = document.getElementById('close-pinned-modal');
const pinnedNotesContainer = document.getElementById('pinned-notes-container');
const pinnedCountBadge = document.getElementById('pinned-count-badge');

const authModal = document.getElementById('auth-modal');
const closeAuthModal = document.getElementById('close-auth-modal');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authPasswordGroup = document.getElementById('auth-password-group');
const authModalTitle = document.getElementById('auth-modal-title');
const authModalDesc = document.getElementById('auth-modal-desc');
const toggleAuthModeBtn = document.getElementById('toggle-auth-mode-btn');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const authPasswordEyeBtn = document.getElementById('auth-password-eye-btn');
const authPasswordEyeIcon = document.getElementById('auth-password-eye-icon');
const authErrorBanner = document.getElementById('auth-error-banner');
const authErrorText = document.getElementById('auth-error-text');

const nicknameModal = document.getElementById('nickname-modal');
const nicknameInput = document.getElementById('nickname-input');
const saveNicknameBtn = document.getElementById('save-nickname-btn');
const settingsNicknameInput = document.getElementById('settings-nickname-input');
const welcomeHeading = document.getElementById('welcome-heading');
const adminPanelLink = document.getElementById('admin-panel-link');

const themeBtn = document.getElementById('theme-btn');
const themeDropdown = document.getElementById('theme-dropdown');
const themeLabel = document.getElementById('theme-label');
const themeOptions = document.querySelectorAll('.theme-option');

const slashMenu = document.getElementById('slash-menu');
const slashOptions = document.querySelectorAll('#slash-list li');
const voiceBtn = document.getElementById('voice-btn');

let authMode = "signin";
let attachedFile = null;
let resetEmailCooldown = false;
let currentChatHistory = []; 
let sessions = [];
let activeSessionId = null;

// --- CSS Engine Injection ---
function injectGeminiThemeStyles() {
  if (document.getElementById('gemini-pro-theme-styles')) return;
  const style = document.createElement('style');
  style.id = 'gemini-pro-theme-styles';
  style.textContent = `
    .gemini-user-bubble {
      background-color: #282a2c;
      color: #f1f3f4;
      border-radius: 22px;
      padding: 12px 18px;
      font-size: 15px;
      line-height: 1.5;
      letter-spacing: -0.01em;
      border: 1px solid rgba(255, 255, 255, 0.06);
      max-width: 86%;
      user-select: text;
    }

    .gemini-response-container {
      font-size: 15.5px;
      line-height: 1.68;
      color: #e3e3e3;
      letter-spacing: -0.012em;
      user-select: text;
    }

    .gemini-response-container p { margin-bottom: 1.1rem; }
    .gemini-response-container strong { color: #ffffff; font-weight: 600; }
    .gemini-response-container h1, 
    .gemini-response-container h2, 
    .gemini-response-container h3 {
      color: #f8f9fa;
      font-weight: 600;
      margin-top: 1.4rem;
      margin-bottom: 0.6rem;
      font-size: 17px;
    }

    #chat-form {
      border-radius: 32px;
      padding: 5px 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
    }

    #user-input {
      font-size: 14.5px;
      line-height: 1.35;
      background: transparent;
      border: none;
      outline: none;
      padding: 6px 2px;
      min-width: 0;
      flex: 1 1 0%;
    }

    #scroll-down-dock-btn {
      position: fixed;
      bottom: 86px;
      left: 50%;
      transform: translateX(-50%) translateY(8px);
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #25272a;
      border: 1px solid #3c4043;
      color: #e3e3e3;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
      cursor: pointer;
      z-index: 25;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    #scroll-down-dock-btn.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateX(-50%) translateY(0);
    }

    .xamo-custom-select-trigger {
      width: 100%;
      background-color: var(--bg-app);
      border: 1px solid var(--border-main);
      border-radius: 14px;
      padding: 11px 14px;
      color: var(--text-main);
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }

    .xamo-select-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      width: 100%;
      max-height: 220px;
      overflow-y: auto;
      background: var(--bg-card);
      border: 1px solid var(--border-main);
      border-radius: 16px;
      padding: 6px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      z-index: 90;
    }

    .xamo-select-option {
      padding: 9px 12px;
      font-size: 12.5px;
      color: var(--text-main);
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .xamo-select-option:hover {
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
    }

    .xamo-select-option.selected {
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
      font-weight: 600;
    }

    html.theme-sky, 
    html.theme-sky body {
      background: 
        radial-gradient(ellipse 90% 60% at 50% -15%, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.2) 45%, transparent 70%),
        linear-gradient(180deg, #1d6ebc 0%, #368ee3 25%, #63a8f9 55%, #92c4f8 82%, #cae2fc 100%) !important;
      background-attachment: fixed !important;
      color: #0a1f3c !important;
    }

    html.theme-sky header {
      background: rgba(255, 255, 255, 0.35) !important;
      backdrop-filter: blur(20px) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.45) !important;
    }

    html.theme-sky header span,
    html.theme-sky header button,
    html.theme-sky header i {
      color: #0b2545 !important;
    }

    html.theme-sky #theme-btn {
      background: rgba(255, 255, 255, 0.85) !important;
      border: 1px solid rgba(255, 255, 255, 0.95) !important;
      color: #0b2545 !important;
    }

    html.theme-sky #theme-dropdown {
      background: #ffffff !important;
      border: 1px solid #badcfc !important;
      box-shadow: 0 10px 30px rgba(11, 48, 87, 0.15) !important;
    }

    html.theme-sky .theme-option {
      color: #0b2545 !important;
    }

    html.theme-sky .theme-option:hover {
      background: #e0f2fe !important;
      color: #0284c7 !important;
    }

    html.theme-sky footer,
    html.theme-sky main > div:last-child {
      background: transparent !important;
    }

    html.theme-sky footer p {
      color: #1e3a5f !important;
    }

    html.theme-sky #chat-form {
      background: rgba(255, 255, 255, 0.92) !important;
      backdrop-filter: blur(20px) !important;
      border: 1px solid rgba(255, 255, 255, 0.95) !important;
      box-shadow: 0 10px 30px rgba(11, 48, 87, 0.12) !important;
    }

    html.theme-sky #user-input {
      color: #091a30 !important;
    }

    html.theme-sky #user-input::placeholder {
      color: #4b6584 !important;
    }

    html.theme-sky #attach-btn,
    html.theme-sky #voice-btn {
      color: #0284c7 !important;
    }

    html.theme-sky #submit-btn {
      background: #0284c7 !important;
      color: #ffffff !important;
    }

    html.theme-sky #sidebar {
      background: #f0f7ff !important;
      border-right: 1px solid #badcfc !important;
      color: #0b2545 !important;
    }

    html.theme-sky #sidebar header,
    html.theme-sky #sidebar .border-b,
    html.theme-sky #sidebar .border-t {
      border-color: #badcfc !important;
    }

    html.theme-sky #sidebar span,
    html.theme-sky #sidebar button,
    html.theme-sky #sidebar i {
      color: #0b2545 !important;
    }

    html.theme-sky #search-chats,
    html.theme-sky #persona-btn {
      background: #ffffff !important;
      border: 1px solid #badcfc !important;
      color: #0b2545 !important;
    }

    html.theme-sky #search-chats::placeholder {
      color: #64748b !important;
    }

    html.theme-sky #chat-list div span {
      color: #0f2744 !important;
      font-weight: 500 !important;
    }

    html.theme-sky #chat-list div:hover {
      background: rgba(2, 132, 199, 0.12) !important;
    }

    html.theme-sky #chat-list div[class*="bg-blue"] {
      background: rgba(2, 132, 199, 0.2) !important;
      border-color: rgba(2, 132, 199, 0.35) !important;
    }

    html.theme-sky #chat-list div[class*="bg-blue"] span {
      color: #0284c7 !important;
      font-weight: 600 !important;
    }

    html.theme-sky #user-logged-in-view,
    html.theme-sky #guest-signin-view,
    html.theme-sky #sidebar > div:last-child {
      background: #e2f0fd !important;
      border-color: #badcfc !important;
    }

    html.theme-sky #account-switcher-btn,
    html.theme-sky #guest-signin-btn {
      background: #ffffff !important;
      border: 1px solid #badcfc !important;
    }

    html.theme-sky #user-email-display {
      color: #0b2545 !important;
      font-weight: 600 !important;
    }

    html.theme-sky #pinned-notes-trigger-btn,
    html.theme-sky #clear-btn,
    html.theme-sky #export-btn {
      background: #ffffff !important;
      border: 1px solid #badcfc !important;
      color: #0b2545 !important;
    }
  `;
  document.head.appendChild(style);
}

function updateSearchPlaceholder() {
  if (!input) return;
  input.placeholder = "Ask XAMO... (Type / for commands)";
}

// --- Custom In-App Dropdowns ---
function initCustomSelectors() {
  const timeSelect = document.getElementById('settings-time-format-select');
  const langSelect = document.getElementById('settings-language-select');

  const TIME_OPTIONS = [
    { value: '12', label: '12-Hour Format (e.g. 03:30 PM)' },
    { value: '24', label: '24-Hour Format (e.g. 15:30)' }
  ];

  const LANG_OPTIONS = [
    { value: 'auto', label: "Auto-Detect / Query Language (Default)" },
    { value: 'English', label: 'English' },
    { value: 'Spanish', label: 'Spanish (Español)' },
    { value: 'French', label: 'French (Français)' },
    { value: 'German', label: 'German (Deutsch)' },
    { value: 'Italian', label: 'Italian (Italiano)' },
    { value: 'Portuguese', label: 'Portuguese (Português)' },
    { value: 'Russian', label: 'Russian (Русский)' },
    { value: 'Chinese', label: 'Chinese (Simplified)' },
    { value: 'Hindi', label: 'Hindi (हिन्दी)' },
    { value: 'Urdu', label: 'Urdu (اردو)' },
    { value: 'Kashmiri', label: 'Kashmiri (کٲشُر)' },
    { value: 'Arabic', label: 'Arabic (العربية)' },
    { value: 'Japanese', label: 'Japanese (日本語)' },
    { value: 'Korean', label: 'Korean (한국어)' }
  ];

  function buildPicker(selectEl, options, currentVal, onChange) {
    if (!selectEl || !selectEl.parentElement) return;
    selectEl.style.setProperty('display', 'none', 'important');

    const existingWrapper = selectEl.parentElement.querySelector('.xamo-custom-select-wrapper');
    if (existingWrapper) existingWrapper.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'xamo-custom-select-wrapper relative w-full mt-1.5';

    const currentItem = options.find(o => o.value === currentVal) || options[0];

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'xamo-custom-select-trigger';
    trigger.innerHTML = `
      <span class="truncate selected-text">${currentItem.label}</span>
      <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 ml-2 flex-shrink-0 transition-transform"></i>
    `;

    const menu = document.createElement('div');
    menu.className = 'xamo-select-menu hidden';

    options.forEach(opt => {
      const item = document.createElement('div');
      const isSelected = opt.value === currentVal;
      item.className = `xamo-select-option ${isSelected ? 'selected' : ''}`;
      item.innerHTML = `
        <span class="truncate">${opt.label}</span>
        ${isSelected ? '<i class="fa-solid fa-check text-[10px]"></i>' : ''}
      `;

      item.onclick = (e) => {
        e.stopPropagation();
        menu.classList.add('hidden');
        trigger.querySelector('.selected-text').textContent = opt.label;
        trigger.querySelector('.fa-chevron-down').style.transform = 'rotate(0deg)';
        selectEl.value = opt.value;
        onChange(opt.value);
        wrapper.querySelectorAll('.xamo-select-option').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
      };

      menu.appendChild(item);
    });

    trigger.onclick = (e) => {
      e.stopPropagation();
      const isClosed = menu.classList.contains('hidden');
      document.querySelectorAll('.xamo-select-menu').forEach(m => m.classList.add('hidden'));
      document.querySelectorAll('.xamo-custom-select-trigger .fa-chevron-down').forEach(i => i.style.transform = 'rotate(0deg)');

      if (isClosed) {
        menu.classList.remove('hidden');
        trigger.querySelector('.fa-chevron-down').style.transform = 'rotate(180deg)';
      }
    };

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    selectEl.parentElement.appendChild(wrapper);
  }

  buildPicker(timeSelect, TIME_OPTIONS, appSettings.timeFormat || '12', (val) => {
    appSettings.timeFormat = val;
  });

  buildPicker(langSelect, LANG_OPTIONS, appSettings.language || 'auto', (val) => {
    appSettings.language = val;
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.xamo-select-menu').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('.xamo-custom-select-trigger .fa-chevron-down').forEach(i => i.style.transform = 'rotate(0deg)');
  });
}

// --- Native PDF Conversion Engine ---
function exportChatToPdf() {
  if (!currentChatHistory || currentChatHistory.length === 0) {
    showXamoToast("No conversation to export to PDF.");
    return;
  }

  showXamoToast("Preparing PDF print preview...");

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    showXamoToast("Please allow popups to export as PDF.");
    return;
  }

  const title = currentChatHistory.find(m => m.role === 'user')?.rawUserText?.slice(0, 30) || "XAMO Chat Export";

  let conversationHtml = currentChatHistory.map(msg => {
    const isUser = msg.role === 'user';
    const sender = isUser ? (userNickname || "User") : "XAMO AI";
    const bgStyle = isUser ? "background-color: #f1f5f9; border-left: 4px solid #2563eb;" : "background-color: #ffffff; border-left: 4px solid #10b981;";
    const text = msg.rawUserText || (msg.parts && msg.parts[0] ? msg.parts[0].text : "");
    const cleanText = text.replace(/\[\[ACTION:[A-Z_]+:[^\]]*\]\]/g, '').trim();

    return `
      <div style="margin-bottom: 16px; padding: 12px 16px; border-radius: 8px; ${bgStyle} box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 6px; text-transform: uppercase;">
          ${sender}
        </div>
        <div style="font-size: 13.5px; line-height: 1.6; color: #0f172a; white-space: pre-wrap; word-break: break-word;">
          ${cleanText}
        </div>
      </div>
    `;
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - XAMO AI</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; margin: 0; color: #0f172a; background: #fff; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px; }
        .logo { font-size: 18px; font-weight: bold; color: #2563eb; }
        .date { font-size: 11px; color: #94a3b8; font-family: monospace; }
        @media print {
          body { padding: 15mm; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">⚡ XAMO AI — Transcript</div>
        <div class="date">${new Date().toLocaleString()}</div>
      </div>
      <div>${conversationHtml}</div>
      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// --- Natural Language Autonomous Action Handler ---
function executeAutonomousAction(actionType, param) {
  const cleanParam = (param || '').trim();

  if (actionType === 'SET_PERSONA') {
    const target = cleanParam.toLowerCase();
    const idx = customPersonas.findIndex(p => 
      p.name.toLowerCase() === target || 
      (target.includes('code') && p.name.toLowerCase().includes('code')) ||
      (target.includes('default') && p.name.toLowerCase().includes('default'))
    );

    if (idx !== -1) {
      currentPersonaIndex = idx;
      if (personaLabel) personaLabel.textContent = customPersonas[idx].name;
      renderPersonas();
      showXamoToast(`Persona switched to ${customPersonas[idx].name}`);
    } else {
      showXamoToast(`Persona "${cleanParam}" not found.`);
    }
  } else if (actionType === 'PIN_NOTE') {
    if (cleanParam) {
      addPinnedNote(cleanParam);
    } else {
      const lastBotMsg = currentChatHistory.slice().reverse().find(m => m.role === 'model');
      if (lastBotMsg && lastBotMsg.parts && lastBotMsg.parts[0]) {
        addPinnedNote(lastBotMsg.parts[0].text);
      } else {
        showXamoToast("Nothing to pin right now.");
      }
    }
  } else if (actionType === 'EXPORT_PDF') {
    exportChatToPdf();
  } else if (actionType === 'CLEAR_CHAT') {
    if (activeSessionId) {
      deleteSession(activeSessionId);
    } else {
      startNewChat();
    }
    showXamoToast("Conversation cleared");
  } else if (actionType === 'NEW_CHAT') {
    startNewChat();
    showXamoToast("Started a new conversation");
  } else if (actionType === 'SET_NICKNAME') {
    if (cleanParam) {
      saveCurrentNickname(cleanParam);
      showXamoToast(`Nickname updated to ${cleanParam}`);
    }
  } else if (actionType === 'SET_THEME') {
    const validThemes = ['sky', 'dark', 'mirror', 'default'];
    const chosen = validThemes.includes(cleanParam.toLowerCase()) ? cleanParam.toLowerCase() : 'default';
    applyTheme(chosen);
    showXamoToast(`Theme set to ${chosen.toUpperCase()}`);
  } else if (actionType === 'SET_CLOCK') {
    const chosen = cleanParam.includes('24') ? '24' : '12';
    appSettings.timeFormat = chosen;
    localStorage.setItem('xamo_app_settings', JSON.stringify(appSettings));
    showXamoToast(`Clock set to ${chosen}-Hour format`);
  } else if (actionType === 'SET_LANG') {
    appSettings.language = cleanParam;
    localStorage.setItem('xamo_app_settings', JSON.stringify(appSettings));
    showXamoToast(`Language set to ${cleanParam}`);
  } else if (actionType === 'REMOVE_ACCOUNT') {
    const accounts = getStoredAccounts();
    const target = accounts.find(a => a.user.email.toLowerCase() === cleanParam.toLowerCase());
    if (target) {
      showXamoToast(`Removing account ${cleanParam}...`);
      removeAccountFromStorage(target.user.id);
    }
  } else if (actionType === 'SWITCH_ACCOUNT') {
    const accounts = getStoredAccounts();
    const target = accounts.find(a => a.user.email.toLowerCase() === cleanParam.toLowerCase());
    if (target && supabaseClient) {
      showXamoToast(`Switching to account ${cleanParam}...`);
      supabaseClient.auth.setSession({
        access_token: target.access_token,
        refresh_token: target.refresh_token
      });
    }
  }
}

// --- Instant Intent Catching ---
function checkImmediateUserIntent(text) {
  const lower = text.toLowerCase().trim();

  if (lower.match(/\b(convert.*to pdf|export.*pdf|save.*as pdf|download.*pdf|print chat)\b/)) {
    executeAutonomousAction('EXPORT_PDF', 'true');
    return;
  }

  if (lower.match(/\b(clear chat|clear history|delete this chat|wipe chat|clean screen)\b/)) {
    executeAutonomousAction('CLEAR_CHAT', 'true');
    return;
  }

  if (lower.match(/\b(new chat|start new chat|create new chat|fresh chat)\b/)) {
    executeAutonomousAction('NEW_CHAT', 'true');
    return;
  }

  if (lower.match(/\b(pin this|pin note|save to pin|bookmark this)\b/)) {
    executeAutonomousAction('PIN_NOTE', '');
    return;
  }

  if (lower.match(/\b(coder mode|coder persona|switch to coder|change to coder|be a coder|set persona to coder|act as coder|switch persona to coder)\b/)) {
    executeAutonomousAction('SET_PERSONA', 'Coder');
    return;
  }
  if (lower.match(/\b(default mode|default persona|switch to default|change to default|reset persona|normal mode)\b/)) {
    executeAutonomousAction('SET_PERSONA', 'Default');
    return;
  }

  const removeAccMatch = lower.match(/(?:remove|delete)\s+account\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (removeAccMatch) {
    executeAutonomousAction('REMOVE_ACCOUNT', removeAccMatch[1]);
    return;
  }

  const switchAccMatch = lower.match(/(?:switch|change)\s+account\s+(?:to\s+)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (switchAccMatch) {
    executeAutonomousAction('SWITCH_ACCOUNT', switchAccMatch[1]);
    return;
  }

  if (lower.match(/\b(change|switch|set)\b.*\b(sky|dark|mirror|default)\b.*\b(theme|mode)?\b/)) {
    const theme = lower.includes('sky') ? 'sky' : (lower.includes('mirror') ? 'mirror' : (lower.includes('dark') ? 'dark' : 'default'));
    executeAutonomousAction('SET_THEME', theme);
    return;
  }

  const nickMatch = lower.match(/(?:call me|change nickname to|set nickname to|my name is)\s+([a-zA-Z0-9_-]{2,15})/);
  if (nickMatch && !lower.includes('what is')) {
    executeAutonomousAction('SET_NICKNAME', nickMatch[1]);
    return;
  }
}

// --- Smart Auto-Hiding Scroll Down Button ---
function hideScrollDownBtn() {
  const btn = document.getElementById('scroll-down-dock-btn');
  if (btn) btn.classList.remove('visible');
  if (scrollVanishTimer) {
    clearTimeout(scrollVanishTimer);
    scrollVanishTimer = null;
  }
}

function updateScrollDownBtn() {
  const btn = document.getElementById('scroll-down-dock-btn');
  if (!btn || !chatBox) return;

  if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
    hideScrollDownBtn();
    return;
  }

  if (document.activeElement === input) {
    hideScrollDownBtn();
    return;
  }

  const openModal = document.querySelector('#settings-modal:not(.hidden), #nickname-modal:not(.hidden), #persona-modal:not(.hidden), #auth-modal:not(.hidden), #file-viewer-modal:not(.hidden)');
  if (openModal) {
    hideScrollDownBtn();
    return;
  }

  const scrollOffset = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
  if (scrollOffset > 140) {
    btn.classList.add('visible');
    
    if (scrollVanishTimer) clearTimeout(scrollVanishTimer);
    scrollVanishTimer = setTimeout(() => {
      btn.classList.remove('visible');
    }, 1500);
  } else {
    hideScrollDownBtn();
  }
}

function injectScrollDownButton() {
  if (document.getElementById('scroll-down-dock-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'scroll-down-dock-btn';
  btn.type = 'button';
  btn.title = "Scroll to bottom";
  btn.innerHTML = '<i class="fa-solid fa-arrow-down text-xs"></i>';
  btn.onclick = () => {
    if (chatBox) {
      chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
    }
    hideScrollDownBtn();
  };
  document.body.appendChild(btn);

  if (chatBox) {
    chatBox.addEventListener('scroll', updateScrollDownBtn, { passive: true });
  }

  if (input) {
    input.addEventListener('focus', hideScrollDownBtn);
    input.addEventListener('blur', () => setTimeout(updateScrollDownBtn, 300));
  }
}

// --- Long-Press Clipboard Engine ---
function attachLongPressCopy(element, rawText) {
  if (!element || !rawText) return;
  let pressTimer = null;
  let startX = 0, startY = 0;

  const start = (e) => {
    if (e.touches && e.touches.length > 1) return;
    if (e.touches) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
    pressTimer = setTimeout(() => {
      navigator.clipboard.writeText(rawText).then(() => {
        if (navigator.vibrate) navigator.vibrate(40);
        showXamoToast("Copied to clipboard!");
      });
    }, 450);
  };

  const cancel = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  const move = (e) => {
    if (e.touches) {
      const diffX = Math.abs(e.touches[0].clientX - startX);
      const diffY = Math.abs(e.touches[0].clientY - startY);
      if (diffX > 10 || diffY > 10) cancel();
    }
  };

  element.addEventListener('touchstart', start, { passive: true });
  element.addEventListener('touchend', cancel);
  element.addEventListener('touchcancel', cancel);
  element.addEventListener('touchmove', move, { passive: true });
}

// --- Nickname Engine ---
function getNicknameStorageKey() {
  return currentUser ? `xamo_nickname_${currentUser.id}` : 'xamo_guest_nickname';
}

function loadCurrentNickname() {
  userNickname = localStorage.getItem(getNicknameStorageKey()) || "";
  updateWelcomeText();

  if (!userNickname) {
    if (nicknameInput) nicknameInput.value = "";
    if (nicknameModal) nicknameModal.classList.remove('hidden');
  } else {
    if (nicknameModal) nicknameModal.classList.add('hidden');
  }
}

function saveCurrentNickname(name) {
  userNickname = name;
  localStorage.setItem(getNicknameStorageKey(), name);
  updateWelcomeText();
}

function updateWelcomeText() {
  if (welcomeHeading) {
    welcomeHeading.textContent = userNickname 
      ? `What can I help you with today, ${userNickname}?` 
      : "What can I help you with today?";
  }
  if (settingsNicknameInput) {
    settingsNicknameInput.value = userNickname;
  }
}

if (saveNicknameBtn && nicknameInput) {
  saveNicknameBtn.addEventListener('click', () => {
    const val = nicknameInput.value.trim();
    if (!val) {
      alert("Please enter a nickname to continue.");
      return;
    }
    saveCurrentNickname(val);
    if (nicknameModal) nicknameModal.classList.add('hidden');
    showXamoToast(`Welcome, ${userNickname}!`);
  });

  nicknameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveNicknameBtn.click();
  });
}

// --- Theme Picker ---
function applyTheme(themeName) {
  document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-sky', 'theme-mirror');
  localStorage.setItem('xamo_theme', themeName);

  if (themeName === 'sky') {
    document.documentElement.classList.add('theme-sky');
    if (themeLabel) themeLabel.textContent = 'Sky';
  } else if (themeName === 'mirror') {
    document.documentElement.classList.add('theme-mirror');
    if (themeLabel) themeLabel.textContent = 'Mirror';
  } else {
    if (themeLabel) themeLabel.textContent = 'Auto';
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.add(isDark ? 'theme-dark' : 'theme-light');
  }
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const currentTheme = localStorage.getItem('xamo_theme') || 'default';
    if (currentTheme === 'default') applyTheme('default');
  });
}

if (themeBtn && themeDropdown) {
  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    themeDropdown.classList.toggle('hidden');
    if (personaDropdown) personaDropdown.classList.add('hidden');
  });
}

themeOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    const mode = opt.getAttribute('data-theme');
    applyTheme(mode);
    if (themeDropdown) themeDropdown.classList.add('hidden');
  });
});

document.addEventListener('click', () => {
  if (personaDropdown) personaDropdown.classList.add('hidden');
  if (themeDropdown) themeDropdown.classList.add('hidden');
  if (accountSwitcherMenu) accountSwitcherMenu.classList.add('hidden');
});

applyTheme(localStorage.getItem('xamo_theme') || 'default');

function getChatStorageKey() {
  return currentUser ? `xamo_sessions_${currentUser.id}` : 'xamo_guest_sessions';
}

function getPersonaStorageKey() {
  return currentUser ? `xamo_personas_${currentUser.id}` : null;
}

function showAuthError(msg) {
  if (authErrorBanner && authErrorText) {
    authErrorText.textContent = msg;
    authErrorBanner.classList.remove('hidden');
  }
}

function hideAuthError() {
  if (authErrorBanner) authErrorBanner.classList.add('hidden');
}

// --- Multi-Account Registry Engine ---
function getStoredAccounts() {
  try {
    return JSON.parse(localStorage.getItem('xamo_multi_accounts') || '[]');
  } catch (e) {
    return [];
  }
}

function storeCurrentAccount(session) {
  if (!session || !session.user) return;
  let accounts = getStoredAccounts();
  const existingIdx = accounts.findIndex(a => a.user.id === session.user.id);
  const accData = {
    user: session.user,
    access_token: session.access_token,
    refresh_token: session.refresh_token
  };

  if (existingIdx !== -1) {
    accounts[existingIdx] = accData;
  } else {
    accounts.push(accData);
  }
  localStorage.setItem('xamo_multi_accounts', JSON.stringify(accounts));
  renderAccountSwitcher();
}

function removeAccountFromStorage(userId) {
  let accounts = getStoredAccounts().filter(a => a.user.id !== userId);
  localStorage.setItem('xamo_multi_accounts', JSON.stringify(accounts));
  renderAccountSwitcher();
}

function renderAccountSwitcher() {
  if (!savedAccountsList) return;
  const accounts = getStoredAccounts();
  savedAccountsList.innerHTML = "";

  accounts.forEach(acc => {
    const isCurrent = currentUser && currentUser.id === acc.user.id;
    const div = document.createElement('div');
    div.className = `flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors text-xs ${isCurrent ? 'bg-blue-600/15 text-blue-400 font-semibold border border-blue-500/20' : 'hover:bg-slate-500/10 text-slate-300'}`;
    
    div.innerHTML = `
      <div class="flex items-center gap-2 truncate flex-1">
        <i class="fa-solid ${isCurrent ? 'fa-circle-check text-blue-400' : 'fa-user text-slate-500'} text-[10px]"></i>
        <span class="truncate font-mono">${acc.user.email}</span>
      </div>
      ${isCurrent ? '<span class="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded ml-1">Active</span>' : ''}
    `;

    if (!isCurrent) {
      div.onclick = async () => {
        if (!supabaseClient) return;
        showXamoToast(`Switching to ${acc.user.email}...`);
        const { error } = await supabaseClient.auth.setSession({
          access_token: acc.access_token,
          refresh_token: acc.refresh_token
        });
        if (error) {
          showXamoToast("Session expired. Please sign in again.");
          removeAccountFromStorage(acc.user.id);
        }
        if (accountSwitcherMenu) accountSwitcherMenu.classList.add('hidden');
      };
    }

    savedAccountsList.appendChild(div);
  });
}

if (accountSwitcherBtn && accountSwitcherMenu) {
  accountSwitcherBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    accountSwitcherMenu.classList.toggle('hidden');
  });
}

if (addAnotherAccountBtn) {
  addAnotherAccountBtn.addEventListener('click', () => {
    if (accountSwitcherMenu) accountSwitcherMenu.classList.add('hidden');
    setAuthMode('signin');
    if (authModalTitle) authModalTitle.textContent = "Add Another Account";
    if (authEmailInput) authEmailInput.value = "";
    if (authPasswordInput) authPasswordInput.value = "";
    hideAuthError();
    if (authModal) authModal.classList.remove('hidden');
  });
}

if (guestSigninBtn) {
  guestSigninBtn.addEventListener('click', () => {
    setAuthMode('signin');
    if (authModal) authModal.classList.remove('hidden');
  });
}

if (signoutCurrentAccountBtn) {
  signoutCurrentAccountBtn.addEventListener('click', async () => {
    if (accountSwitcherMenu) accountSwitcherMenu.classList.add('hidden');
    if (currentUser) {
      const leavingId = currentUser.id;
      removeAccountFromStorage(leavingId);
      
      const remaining = getStoredAccounts();
      if (remaining.length > 0) {
        showXamoToast(`Switching to ${remaining[0].user.email}...`);
        await supabaseClient.auth.setSession({
          access_token: remaining[0].access_token,
          refresh_token: remaining[0].refresh_token
        });
      } else {
        await supabaseClient.auth.signOut();
        showXamoToast("Signed out. Guest session active.");
      }
    }
  });
}

// --- Pinned Notes System ---
if (pinnedNotesTriggerBtn && pinnedNotesModal) {
  pinnedNotesTriggerBtn.addEventListener('click', () => {
    renderPinnedNotes();
    pinnedNotesModal.classList.remove('hidden');
  });
}
if (closePinnedModal && pinnedNotesModal) {
  closePinnedModal.addEventListener('click', () => pinnedNotesModal.classList.add('hidden'));
}

async function getPinnedNotes() {
  if (currentUser && supabaseClient) {
    try {
      const { data } = await supabaseClient.from('pinned_notes').select('*').order('created_at', { ascending: false });
      if (data && data.length > 0) return data;
    } catch (e) {}
  }
  return JSON.parse(localStorage.getItem('xamo_pinned_notes') || '[]');
}

async function addPinnedNote(text) {
  const newId = 'note_' + Date.now();
  if (currentUser && supabaseClient) {
    try {
      await supabaseClient.from('pinned_notes').insert([{ id: newId, user_id: currentUser.id, note_text: text }]);
    } catch (e) {}
  }
  let notes = JSON.parse(localStorage.getItem('xamo_pinned_notes') || '[]');
  notes.unshift({ id: newId, note_text: text, created_at: new Date().toISOString() });
  localStorage.setItem('xamo_pinned_notes', JSON.stringify(notes));
  showXamoToast("Note pinned to vault!");
  updatePinnedBadge();
}

window.pinMessageDirect = function(encodedText) {
  const text = decodeURIComponent(encodedText);
  addPinnedNote(text);
};

window.deletePinnedNote = async function(id) {
  if (currentUser && supabaseClient) {
    try {
      await supabaseClient.from('pinned_notes').delete().eq('id', id);
    } catch (e) {}
  }
  let notes = JSON.parse(localStorage.getItem('xamo_pinned_notes') || '[]');
  notes = notes.filter(n => String(n.id) !== String(id));
  localStorage.setItem('xamo_pinned_notes', JSON.stringify(notes));
  showXamoToast("Pinned note removed");
  renderPinnedNotes();
  updatePinnedBadge();
};

async function renderPinnedNotes() {
  if (!pinnedNotesContainer) return;
  const notes = await getPinnedNotes();
  updatePinnedBadge(notes.length);

  if (!notes.length) {
    pinnedNotesContainer.innerHTML = '<div class="text-xs text-slate-500 text-center py-8">No notes pinned yet. Click the bookmark icon on any message to save it here.</div>';
    return;
  }

  pinnedNotesContainer.innerHTML = notes.map(n => `
    <div class="p-3.5 rounded-xl border flex items-start justify-between gap-3 shadow-inner" style="background-color: var(--bg-app); border-color: var(--border-main);">
      <div class="text-xs leading-relaxed whitespace-pre-wrap flex-1 break-words font-sans" style="color: var(--text-main);">${DOMPurify.sanitize(marked.parse(n.note_text))}</div>
      <div class="flex items-center gap-2 flex-shrink-0 bg-slate-800/60 p-1 rounded-lg">
        <button onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(n.note_text)}')); showXamoToast('Copied note!');" class="text-slate-300 hover:text-blue-400 p-1.5 transition-colors" title="Copy"><i class="fa-solid fa-copy text-xs"></i></button>
        <button onclick="event.stopPropagation(); deletePinnedNote('${n.id}')" class="text-red-400 hover:text-red-300 p-1.5 transition-colors" title="Delete Note"><i class="fa-solid fa-trash-can text-xs"></i></button>
      </div>
    </div>
  `).join('');
}

async function updatePinnedBadge(count = null) {
  if (!pinnedCountBadge) return;
  if (count === null) {
    const notes = await getPinnedNotes();
    pinnedCountBadge.textContent = notes.length;
  } else {
    pinnedCountBadge.textContent = count;
  }
}

if (authPasswordEyeBtn && authPasswordInput && authPasswordEyeIcon) {
  authPasswordEyeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (authPasswordInput.type === 'password') {
      authPasswordInput.type = 'text';
      authPasswordEyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      authPasswordInput.type = 'password';
      authPasswordEyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
    }
  });
}

function setAuthMode(mode) {
  authMode = mode;
  hideAuthError();
  if (!authModalTitle || !authModalDesc || !authSubmitBtn || !toggleAuthModeBtn || !authPasswordGroup) return;

  if (authMode === 'forgot') {
    authModalTitle.textContent = "Reset Password";
    authModalDesc.textContent = "We'll send a secure password reset link to your email.";
    authPasswordGroup.classList.add('hidden');
    if (forgotPasswordLink) forgotPasswordLink.classList.add('hidden');
    authSubmitBtn.querySelector('span').textContent = "Send Reset Link";
    toggleAuthModeBtn.textContent = "Back to Sign In";
  } else if (authMode === 'signup') {
    authModalTitle.textContent = "Create Account";
    authModalDesc.textContent = "Sync conversations securely across devices.";
    authPasswordGroup.classList.remove('hidden');
    if (forgotPasswordLink) forgotPasswordLink.classList.add('hidden');
    authSubmitBtn.querySelector('span').textContent = "Sign Up";
    toggleAuthModeBtn.textContent = "Already have an account? Sign In";
  } else {
    authModalTitle.textContent = "Sign In to XAMO";
    authModalDesc.textContent = "Sync conversations securely across devices.";
    authPasswordGroup.classList.remove('hidden');
    if (forgotPasswordLink) forgotPasswordLink.classList.remove('hidden');
    authSubmitBtn.querySelector('span').textContent = "Sign In";
    toggleAuthModeBtn.textContent = "Don't have an account? Sign Up";
  }
}

if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode('forgot');
  });
}

if (toggleAuthModeBtn) {
  toggleAuthModeBtn.addEventListener('click', () => {
    if (authMode === 'forgot') setAuthMode('signin');
    else if (authMode === 'signin') setAuthMode('signup');
    else setAuthMode('signin');
  });
}

if (closeAuthModal && authModal) {
  closeAuthModal.addEventListener('click', (e) => {
    e.preventDefault();
    authModal.classList.add('hidden');
  });
}

// --- Auth Dispatch Handler ---
if (authSubmitBtn) {
  authSubmitBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    hideAuthError();

    if (!supabaseClient) {
      showAuthError("Database connection not ready. Check your network.");
      return;
    }

    const email = authEmailInput ? authEmailInput.value.trim() : "";
    const password = authPasswordInput ? authPasswordInput.value.trim() : "";

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      showAuthError("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }

    const btnTextSpan = authSubmitBtn.querySelector('span');
    authSubmitBtn.disabled = true;

    try {
      if (authMode === 'forgot') {
        if (resetEmailCooldown) {
          showAuthError("Please wait a moment before requesting another reset email.");
          return;
        }

        if (btnTextSpan) btnTextSpan.textContent = "Verifying email...";

        let isVerified = null;
        try {
          const { data, error: rpcError } = await withTimeout(
            supabaseClient.rpc('is_email_verified', { check_email: email }),
            4000
          );
          if (!rpcError && typeof data === 'boolean') {
            isVerified = data;
          }
        } catch (rpcErr) {
          console.warn("RPC check skipped:", rpcErr);
        }

        if (isVerified === false) {
          throw new Error("This email is not registered or has not been verified yet.");
        }

        if (btnTextSpan) btnTextSpan.textContent = "Sending Link...";
        
        const { error } = await withTimeout(
          supabaseClient.auth.resetPasswordForEmail(email, { 
            redirectTo: "https://xamo-ai.vercel.app/reset-password.html" 
          }),
          6000
        );

        if (error) throw error;

        showXamoToast("Reset link sent! Check your Gmail inbox & Spam folder.");
        if (authModal) authModal.classList.add('hidden');
        setAuthMode('signin');

        resetEmailCooldown = true;
        setTimeout(() => { resetEmailCooldown = false; }, 45000);

      } else if (authMode === 'signup') {
        if (!password || password.length < 6) {
          showAuthError("Password must be at least 6 characters.");
          return;
        }

        if (btnTextSpan) btnTextSpan.textContent = "Creating Account...";

        const { data, error } = await withTimeout(
          supabaseClient.auth.signUp({ 
            email, 
            password,
            options: { emailRedirectTo: "https://xamo-ai.vercel.app/verified.html" }
          }),
          8000
        );

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('already registered') || msg.includes('user already exists')) {
            throw new Error("This email is already registered. Please sign in instead.");
          }
          throw error;
        }

        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error("This email is already registered and verified. Please sign in instead.");
        }

        showXamoToast("Verification link sent! Check your Gmail inbox.");
        if (authModal) authModal.classList.add('hidden');

      } else {
        if (!password) {
          showAuthError("Please enter your password.");
          return;
        }

        if (btnTextSpan) btnTextSpan.textContent = "Signing In...";

        const { data, error } = await withTimeout(
          supabaseClient.auth.signInWithPassword({ email, password }),
          8000
        );

        if (error) {
          const errMsg = error.message.toLowerCase();
          if (errMsg.includes('not confirmed') || errMsg.includes('email not confirmed')) {
            throw new Error("Please verify your email before signing in. Check your inbox.");
          } else if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid credentials')) {
            throw new Error("Invalid email or password. Please check your credentials.");
          } else {
            throw error;
          }
        }

        if (data.session) storeCurrentAccount(data.session);
        showXamoToast("Signed in successfully!");
        if (authModal) authModal.classList.add('hidden');
      }

      if (authEmailInput) authEmailInput.value = "";
      if (authPasswordInput) authPasswordInput.value = "";

    } catch (err) {
      showAuthError(err.message || "Authentication failed.");
    } finally {
      authSubmitBtn.disabled = false;
      if (btnTextSpan) {
        if (authMode === 'forgot') btnTextSpan.textContent = "Send Reset Link";
        else if (authMode === 'signup') btnTextSpan.textContent = "Sign Up";
        else btnTextSpan.textContent = "Sign In";
      }
    }
  });
}

function handleUrlAuthFlags() {
  const hash = window.location.hash || '';
  if (hash.includes('type=signup') && !hash.includes('type=recovery')) {
    if (verifiedModal) verifiedModal.classList.remove('hidden');
    window.history.replaceState(null, null, window.location.pathname);
  }
}

if (closeVerifiedBtn && verifiedModal) {
  closeVerifiedBtn.addEventListener('click', () => verifiedModal.classList.add('hidden'));
}

// --- Text-to-Speech (TTS) Engine ---
let ttsSettings = {
  gender: localStorage.getItem('xamo_tts_gender') || 'female',
  rate: 1.0,
  pitch: 1.0
};

let availableVoices = [];
function initVoices() {
  if ('speechSynthesis' in window) {
    availableVoices = window.speechSynthesis.getVoices();
  }
}
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = initVoices;
  initVoices();
}

function cleanTextForSpeech(rawText) {
  if (!rawText) return "";
  let text = rawText;
  text = text.replace(/```[\s\S]*?```/g, " Code block omitted. ");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/\$\$[\s\S]*?\$\$/g, "");
  text = text.replace(/\$[^\$]+\$/g, "");
  text = text.replace(/https?:\/\/\S+/g, "");
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
  text = text.replace(/^[#>\-\*\+]\s+/gm, "");
  text = text.replace(/[\*_~#|\\<>{}\[\]\^]/g, " ");
  text = text.replace(/[\/\\=+\-—–]/g, " ");
  text = text.replace(/\.{2,}/g, ".");
  text = text.replace(/_+/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function getPreferredVoice(gender) {
  if (!availableVoices.length) initVoices();
  const isFemale = gender.toLowerCase() === 'female';
  const femaleKeywords = ['female', 'zira', 'samantha', 'jenny', 'karen', 'victoria', 'ava', 'google uk english female', 'natural', 'aria'];
  const maleKeywords = ['male', 'david', 'guy', 'mark', 'george', 'james', 'google uk english male', 'natural'];
  const searchKeywords = isFemale ? femaleKeywords : maleKeywords;
  
  let selected = availableVoices.find(v => 
    v.lang.startsWith('en') && searchKeywords.some(kw => v.name.toLowerCase().includes(kw))
  );

  if (!selected) {
    selected = availableVoices.find(v => searchKeywords.some(kw => v.name.toLowerCase().includes(kw)));
  }

  return selected || availableVoices[0];
}

let activeSpeakerBtn = null;

function toggleSpeech(textToRead, btnElement) {
  if (!('speechSynthesis' in window)) {
    showXamoToast("Text-to-Speech is not supported on this browser.");
    return;
  }

  if (window.speechSynthesis.speaking && activeSpeakerBtn === btnElement) {
    window.speechSynthesis.cancel();
    resetSpeechButton(btnElement);
    return;
  }

  window.speechSynthesis.cancel();
  if (activeSpeakerBtn) resetSpeechButton(activeSpeakerBtn);

  const cleanText = cleanTextForSpeech(textToRead);
  if (!cleanText) {
    showXamoToast("Nothing to read aloud.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const voice = getPreferredVoice(ttsSettings.gender);
  if (voice) utterance.voice = voice;
  
  utterance.rate = ttsSettings.rate;
  utterance.pitch = ttsSettings.pitch;

  utterance.onstart = () => {
    activeSpeakerBtn = btnElement;
    btnElement.innerHTML = '<i class="fa-solid fa-circle-stop text-blue-400 animate-pulse"></i>';
    btnElement.title = "Stop Reading";
  };

  utterance.onend = () => resetSpeechButton(btnElement);
  utterance.onerror = () => resetSpeechButton(btnElement);

  window.speechSynthesis.speak(utterance);
}

function resetSpeechButton(btn) {
  if (!btn) return;
  btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
  btn.title = "Read Aloud";
  if (activeSpeakerBtn === btn) activeSpeakerBtn = null;
}

// --- Send Button Visibility Check ---
function updateSendButtonState() {
  if (!submitBtn || !input) return;
  const hasText = input.value.trim().length > 0;
  const hasFile = attachedFile !== null;

  if (hasText || hasFile) {
    submitBtn.classList.remove('hidden');
    submitBtn.classList.add('flex');
  } else {
    submitBtn.classList.remove('flex');
    submitBtn.classList.add('hidden');
  }
}

if (input) {
  input.addEventListener('input', updateSendButtonState);
}

function showXamoToast(message) {
  const existing = document.getElementById('xamo-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'xamo-toast';
  toast.className = "fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-[#1e1f20] border border-slate-700 text-slate-200 text-xs px-4 py-2.5 rounded-xl shadow-2xl z-[100] flex items-center gap-2 transition-all duration-300";
  toast.innerHTML = `<i class="fa-solid fa-check text-blue-400"></i> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- Attachment Modal Viewer ---
if (closeFileViewer && fileViewerModal) {
  closeFileViewer.addEventListener('click', () => fileViewerModal.classList.add('hidden'));
}

window.viewAttachedFile = function(index) {
  const msg = currentChatHistory[index];
  if (!msg || !msg.file || !fileViewerModal) return;
  const file = msg.file;

  if (viewerFileTitle) viewerFileTitle.textContent = file.name || "Attachment";
  if (viewerContentContainer) viewerContentContainer.innerHTML = "";
  if (viewerCopyBtn) viewerCopyBtn.classList.add('hidden');

  const src = file.uri || (file.base64 ? `data:${file.mimeType};base64,${file.base64}` : "");

  if (file.category === 'image') {
    if (viewerFileIcon) viewerFileIcon.className = "fa-solid fa-image text-blue-400 text-sm";
    if (src && viewerContentContainer) {
      viewerContentContainer.innerHTML = `<img src="${src}" class="max-w-full max-h-[72vh] rounded-2xl object-contain shadow-2xl border border-slate-700">`;
    }
  } else if (file.category === 'video') {
    if (viewerFileIcon) viewerFileIcon.className = "fa-solid fa-file-video text-purple-400 text-sm";
    if (viewerContentContainer) {
      viewerContentContainer.innerHTML = src ? `<video controls playsinline preload="metadata" src="${src}" class="max-w-full max-h-[72vh] rounded-2xl shadow-2xl bg-black"></video>` : `<p class="text-xs text-slate-400 p-4 text-center">Video preview expired.</p>`;
    }
  } else if (file.category === 'pdf') {
    if (viewerFileIcon) viewerFileIcon.className = "fa-solid fa-file-pdf text-red-400 text-sm";
    if (viewerContentContainer) {
      viewerContentContainer.innerHTML = src ? `<embed src="${src}" type="application/pdf" class="w-full h-[68vh] rounded-2xl border border-slate-700">` : `<p class="text-xs text-slate-300 p-4 text-left leading-relaxed whitespace-pre-wrap">${DOMPurify.sanitize(file.content || "PDF text loaded.")}</p>`;
    }
  } else {
    if (viewerFileIcon) viewerFileIcon.className = "fa-solid fa-file-code text-blue-400 text-sm";
    if (viewerCopyBtn && file.content) {
      viewerCopyBtn.classList.remove('hidden');
      viewerCopyBtn.onclick = () => {
        navigator.clipboard.writeText(file.content);
        showXamoToast("Code copied to clipboard!");
      };
    }
    
    const pre = document.createElement('pre');
    pre.className = "w-full text-xs font-mono text-slate-200 overflow-x-auto p-4 rounded-2xl bg-slate-950 border border-slate-800 leading-relaxed";
    const code = document.createElement('code');
    code.textContent = file.content || "Code content unavailable";
    pre.appendChild(code);
    if (viewerContentContainer) viewerContentContainer.appendChild(pre);
    if (window.hljs) hljs.highlightElement(code);
  }

  fileViewerModal.classList.remove('hidden');
};

// --- Settings Modal Handler ---
if (settingsBtn && settingsModal) settingsBtn.addEventListener('click', () => {
  if (settingsNicknameInput) settingsNicknameInput.value = userNickname;
  settingsModal.classList.remove('hidden');
  hideScrollDownBtn();
  initCustomSelectors();
});

if (closeSettings && settingsModal) closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

if (saveSettings && settingsModal) {
  saveSettings.addEventListener('click', () => {
    if (settingsNicknameInput) {
      const newNick = settingsNicknameInput.value.trim();
      if (newNick) saveCurrentNickname(newNick);
    }

    localStorage.setItem('xamo_app_settings', JSON.stringify(appSettings));
    settingsModal.classList.add('hidden');
    showXamoToast("Preferences saved successfully!");
  });
}

// --- Base Personas ---
const BASE_PERSONAS = [
  { 
    name: 'Default', 
    prompt: "You are XAMO, an authentic, fast, and helpful AI assistant created exclusively by Zaeem. You are powered by XAMO's proprietary neural engine. Under NO circumstances should you ever mention Google, Gemini, OpenAI, or being an LLM created by Google. If asked who created you or what model powers you, state with pride that you are XAMO, built by Zaeem."
  },
  { 
    name: 'Coder', 
    prompt: "You are XAMO, a principal software architect created exclusively by Zaeem. Provide production-grade, optimized code immediately with clean syntax and concise explanations. Never mention Google, Gemini, or third parties."
  }
];

let customPersonas = [...BASE_PERSONAS];
let currentPersonaIndex = 0;

function loadUserPersonas() {
  if (currentUser) {
    try {
      const saved = localStorage.getItem(getPersonaStorageKey());
      customPersonas = saved ? JSON.parse(saved) : [...BASE_PERSONAS];
    } catch (e) {
      customPersonas = [...BASE_PERSONAS];
    }
  } else {
    customPersonas = [...BASE_PERSONAS];
  }
  currentPersonaIndex = 0;
  if (personaLabel) personaLabel.textContent = customPersonas[0].name;
  renderPersonas();
}

function saveUserPersonas() {
  if (currentUser) {
    localStorage.setItem(getPersonaStorageKey(), JSON.stringify(customPersonas));
  }
}

function renderPersonas() {
  if (!personaListOptions) return;
  personaListOptions.innerHTML = "";
  customPersonas.forEach((p, idx) => {
    const div = document.createElement('div');
    const isSelected = currentPersonaIndex === idx;

    div.className = "group persona-option px-3 py-2 text-xs hover:bg-slate-500/10 cursor-pointer transition-colors flex items-center justify-between gap-2";
    
    const leftSpan = document.createElement('div');
    leftSpan.className = "flex items-center gap-2 truncate flex-1";
    leftSpan.innerHTML = isSelected 
      ? `<i class="fa-solid fa-check text-blue-400 text-[10px]"></i> <span class="truncate font-semibold text-blue-400">${p.name}</span>`
      : `<span class="truncate">${p.name}</span>`;

    div.appendChild(leftSpan);

    div.onclick = () => {
      currentPersonaIndex = idx;
      if (personaLabel) personaLabel.textContent = p.name;
      if (personaDropdown) personaDropdown.classList.add('hidden');
      renderPersonas();
    };

    personaListOptions.appendChild(div);
  });
}

if (personaBtn && personaDropdown) {
  personaBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    personaDropdown.classList.toggle('hidden');
  });
}

if (addPersonaTrigger && personaModal) addPersonaTrigger.addEventListener('click', () => personaModal.classList.remove('hidden'));
if (closePersonaModal && personaModal) closePersonaModal.addEventListener('click', () => personaModal.classList.add('hidden'));

if (savePersonaBtn && personaModal) {
  savePersonaBtn.addEventListener('click', () => {
    const name = newPersonaName ? newPersonaName.value.trim() : "";
    const prompt = newPersonaPrompt ? newPersonaPrompt.value.trim() : "";
    if (!name || !prompt) {
      showAuthError("Please fill in both name and instructions.");
      return;
    }
    customPersonas.push({ name, prompt });
    saveUserPersonas();
    if (newPersonaName) newPersonaName.value = "";
    if (newPersonaPrompt) newPersonaPrompt.value = "";
    personaModal.classList.add('hidden');
    currentPersonaIndex = customPersonas.length - 1;
    if (personaLabel) personaLabel.textContent = name;
    renderPersonas();
  });
}

if (attachBtn && imageInput) {
  attachBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    imageInput.click();
  });
}

// --- High-Speed Media Compression (Optimized for Sub-Second Streaming) ---
if (imageInput) {
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileType = file.type;
    const fileName = file.name || "Upload";

    if (fileType.startsWith('image/') || (!fileType && /\.(jpe?g|png|webp|heic|bmp)$/i.test(fileName))) {
      showXamoToast("Optimizing image...");
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = function () {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);
        
        attachedFile = {
          category: 'image',
          mimeType: 'image/jpeg',
          base64: compressedDataUrl.split(',')[1],
          uri: compressedDataUrl,
          name: fileName
        };

        if (imagePreview) {
          imagePreview.src = attachedFile.uri;
          imagePreview.classList.remove('hidden');
        }
        if (fileIcon) fileIcon.classList.add('hidden');
        if (fileNamePreview) fileNamePreview.classList.add('hidden');
        if (imagePreviewContainer) imagePreviewContainer.classList.remove('hidden');
        updateSendButtonState();
      };

      img.src = objectUrl;

    } else if (fileType.startsWith('video/')) {
      if (file.size > 20 * 1024 * 1024) {
        showXamoToast("Video must be under 20MB.");
        imageInput.value = "";
        return;
      }

      showXamoToast("Encoding video...");
      const reader = new FileReader();
      reader.onload = function(uploadEvent) {
        const fullVideoDataUrl = uploadEvent.target.result;
        attachedFile = {
          category: 'video',
          mimeType: fileType || 'video/mp4',
          base64: fullVideoDataUrl.split(',')[1],
          uri: fullVideoDataUrl,
          name: fileName
        };

        if (imagePreview) imagePreview.classList.add('hidden');
        if (fileIcon) {
          fileIcon.classList.remove('hidden');
          fileIcon.innerHTML = '<i class="fa-solid fa-file-video text-purple-400"></i>';
        }
        if (fileNamePreview) {
          fileNamePreview.textContent = fileName;
          fileNamePreview.classList.remove('hidden');
        }
        if (imagePreviewContainer) imagePreviewContainer.classList.remove('hidden');
        updateSendButtonState();
        showXamoToast("Video ready to send!");
      };
      reader.readAsDataURL(file);

    } else if (fileType === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async function(uploadEvent) {
        try {
          showXamoToast("Reading PDF text...");
          const typedarray = new Uint8Array(uploadEvent.target.result);
          
          if (typeof pdfjsLib !== 'undefined') {
            const loadingTask = pdfjsLib.getDocument({ data: typedarray });
            const pdf = await loadingTask.promise;
            let fullPdfText = "";
            
            const maxPages = Math.min(pdf.numPages, 40);
            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => item.str).join(" ");
              fullPdfText += `\n[Page ${pageNum}] ` + pageText;
            }

            attachedFile = {
              category: 'pdf',
              content: `[Attached Document: ${fileName}]\n${fullPdfText.trim()}`,
              name: fileName,
              uri: ""
            };
          }

          if (imagePreview) imagePreview.classList.add('hidden');
          if (fileIcon) {
            fileIcon.classList.remove('hidden');
            fileIcon.innerHTML = '<i class="fa-solid fa-file-pdf text-red-400"></i>';
          }
          if (fileNamePreview) {
            fileNamePreview.textContent = fileName;
            fileNamePreview.classList.remove('hidden');
          }
          if (imagePreviewContainer) imagePreviewContainer.classList.remove('hidden');
          updateSendButtonState();
          showXamoToast("PDF ready!");
        } catch (pdfErr) {
          showXamoToast("Failed to parse PDF text.");
        }
      };
      reader.readAsArrayBuffer(file);

    } else {
      const reader = new FileReader();
      reader.onload = function(uploadEvent) {
        attachedFile = { category: 'text', content: uploadEvent.target.result, name: fileName, uri: "" };
        if (imagePreview) imagePreview.classList.add('hidden');
        if (fileIcon) {
          fileIcon.classList.remove('hidden');
          fileIcon.innerHTML = '<i class="fa-solid fa-file-code text-blue-400"></i>';
        }
        if (fileNamePreview) {
          fileNamePreview.textContent = fileName;
          fileNamePreview.classList.remove('hidden');
        }
        if (imagePreviewContainer) imagePreviewContainer.classList.remove('hidden');
        updateSendButtonState();
      };
      reader.readAsText(file);
    }
  });
}

if (removeImageBtn) {
  removeImageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    attachedFile = null;
    if (imageInput) imageInput.value = "";
    if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
    updateSendButtonState();
  });
}

function toggleSidebar() {
  if (!sidebar) return;
  const isOpen = !sidebar.classList.contains('-translate-x-full');
  if (isOpen) {
    sidebar.classList.add('-translate-x-full');
    if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
    setTimeout(updateScrollDownBtn, 200);
  } else {
    sidebar.classList.remove('-translate-x-full');
    if (sidebarOverlay) sidebarOverlay.classList.remove('hidden');
    hideScrollDownBtn();
  }
}

if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

// --- Local Sessions Storage Engine ---
function loadLocalSessions() {
  try {
    const raw = localStorage.getItem(getChatStorageKey());
    sessions = raw ? JSON.parse(raw) : [];
  } catch (e) {
    sessions = [];
  }
}

function saveLocalSessions() {
  try {
    localStorage.setItem(getChatStorageKey(), JSON.stringify(sessions));
  } catch (e) {}
}

// --- Auth State Handshake (Preserving Guest History) ---
async function initAuth() {
  if (!supabaseClient) {
    loadUserPersonas();
    loadCurrentNickname();
    loadLocalSessions();
    startNewChat();
    renderSessions();
    updatePinnedBadge();
    return;
  }
  
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) storeCurrentAccount(session);
    handleAuthStateChange(session?.user || null);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) storeCurrentAccount(session);
      handleAuthStateChange(session?.user || null, true);
    });
  } catch (e) {
    console.warn("Auth initialization failed:", e);
    loadUserPersonas();
    loadCurrentNickname();
    loadLocalSessions();
    startNewChat();
    renderSessions();
  }
  updatePinnedBadge();
}

async function handleAuthStateChange(user, isAuthEvent = false) {
  if (isAuthEvent && currentUser && user && currentUser.id === user.id) {
    currentUser = user;
    return;
  }

  currentUser = user;
  
  if (activeStreamAbortController) {
    activeStreamAbortController.abort();
    activeStreamAbortController = null;
  }

  currentChatHistory = [];
  activeSessionId = null;
  if (input) { input.value = ''; input.style.height = 'auto'; }
  attachedFile = null;
  if (imageInput) imageInput.value = '';
  if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();

  if (currentUser) {
    if (userLoggedInView) userLoggedInView.classList.remove('hidden');
    if (guestSigninView) guestSigninView.classList.add('hidden');
    if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
    
    if (adminPanelLink) {
      if (currentUser.email && currentUser.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) {
        adminPanelLink.classList.remove('hidden');
      } else {
        adminPanelLink.classList.add('hidden');
      }
    }

    renderAccountSwitcher();
    loadCurrentNickname();
    loadUserPersonas();
    await syncCloudChats();
  } else {
    // Guest User Mode: Load saved local chats and start on a fresh screen
    if (userLoggedInView) userLoggedInView.classList.add('hidden');
    if (guestSigninView) guestSigninView.classList.remove('hidden');
    if (adminPanelLink) adminPanelLink.classList.add('hidden');

    loadCurrentNickname();
    loadLocalSessions();
    loadUserPersonas();
    startNewChat();
    renderSessions();
  }
  updatePinnedBadge();
}

async function syncCloudChats() {
  if (!supabaseClient || !currentUser) return;
  try {
    const { data, error } = await supabaseClient
      .from('chats')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('is_deleted_by_user', false)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      sessions = data.map(item => {
        let parsedHistory = item.history;
        if (typeof parsedHistory === 'string') {
          try { parsedHistory = JSON.parse(parsedHistory); } catch(e) { parsedHistory = []; }
        }
        return {
          id: String(item.id),
          title: item.title,
          history: Array.isArray(parsedHistory) ? parsedHistory : []
        };
      });
      const key = getChatStorageKey();
      if (key) {
        try { localStorage.setItem(key, JSON.stringify(sessions)); } catch(e) {}
      }
      renderSessions(searchChatsInput ? searchChatsInput.value : "");
      startNewChat();
    }
  } catch (err) {
    console.error("Cloud fetch error:", err);
  }
}

function renderMath(element) {
  if (window.renderMathInElement) {
    window.renderMathInElement(element, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
    });
  }
}

function parseMarkdownSafely(text) {
  const cleanDisplay = (text || '').replace(/\[\[ACTION:[A-Z_]+:[^\]]*\]\]/g, '').trim();
  const rawHtml = marked.parse(cleanDisplay);
  return window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;
}

function enhanceMarkdownOutput(container) {
  container.querySelectorAll('table').forEach(table => {
    if (!table.parentElement.classList.contains('table-responsive-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-responsive-wrapper';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  });

  container.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.copy-code-btn')) return;
    pre.style.position = 'relative';
    
    const wrapBtn = document.createElement('button');
    wrapBtn.className = "absolute top-2 right-16 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded-md border border-slate-700 transition-colors";
    wrapBtn.innerHTML = '<i class="fa-solid fa-align-left"></i> Wrap';
    wrapBtn.onclick = () => {
      const codeBlock = pre.querySelector('code');
      if (codeBlock) codeBlock.classList.toggle('wrap-code');
    };
    
    const copyBtn = document.createElement('button');
    copyBtn.className = "copy-code-btn absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded-md border border-slate-700 transition-colors";
    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
    copyBtn.onclick = () => {
      const code = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
      navigator.clipboard.writeText(code);
      showXamoToast("Code copied to clipboard!");
    };
    
    pre.appendChild(wrapBtn);
    pre.appendChild(copyBtn);
  });
}

function renderSessions(filterText = "") {
  if (!chatList) return;
  chatList.innerHTML = "";
  const filtered = sessions.filter(s => s.title && s.title.toLowerCase().includes(filterText.toLowerCase()));
  if (filtered.length === 0) {
    chatList.innerHTML = '<p class="text-xs text-slate-400 px-3 py-2">No conversations found</p>';
    return;
  }
  filtered.forEach(session => {
    const div = document.createElement('div');
    const isActive = String(session.id) === String(activeSessionId);
    div.className = "group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-all duration-200 " + 
                    (isActive ? "bg-blue-600/10 text-blue-400 font-semibold border border-blue-500/20 shadow-sm" : "text-slate-400 hover:bg-slate-500/10 hover:text-slate-200");
    const titleSpan = document.createElement('span');
    titleSpan.className = "truncate flex-1 pr-2";
    titleSpan.textContent = session.title;
    titleSpan.onclick = () => {
      loadSession(session.id);
      if (window.innerWidth < 768) toggleSidebar();
    };
    const deleteBtn = document.createElement('button');
    deleteBtn.className = "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 p-1 transition-opacity";
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteSession(session.id);
    };
    div.appendChild(titleSpan);
    div.appendChild(deleteBtn);
    chatList.appendChild(div);
  });
}

// --- Session Storage ---
async function saveCurrentSession() {
  if (currentChatHistory.length === 0) return;
  const firstUserMsg = currentChatHistory.find(m => m.role === 'user');
  let title = "New Chat";
  if (firstUserMsg) {
    if (firstUserMsg.rawUserText) {
      title = firstUserMsg.rawUserText.slice(0, 26) + "...";
    } else if (firstUserMsg.file) {
      title = firstUserMsg.file.name;
    }
  }

  const cleanHistory = currentChatHistory.map(msg => {
    const newParts = msg.parts.map(part => {
      if (part.inline_data) {
        return { text: `[Attachment: ${msg.file?.name || 'File'}]` };
      }
      return part;
    });

    let lightweightFile = null;
    if (msg.file) {
      lightweightFile = {
        name: msg.file.name,
        category: msg.file.category,
        mimeType: msg.file.mimeType,
        uri: msg.file.uri || "",
        content: msg.file.content || ""
      };
    }

    return { 
      role: msg.role, 
      parts: newParts, 
      file: lightweightFile, 
      rawUserText: msg.rawUserText 
    };
  });

  if (!activeSessionId) {
    activeSessionId = Date.now().toString();
    sessions.unshift({ id: activeSessionId, title, history: cleanHistory });
  } else {
    const session = sessions.find(s => String(s.id) === String(activeSessionId));
    if (session) {
      session.history = cleanHistory;
      session.title = title;
    } else {
      sessions.unshift({ id: String(activeSessionId), title, history: cleanHistory });
    }
  }

  localStorage.setItem('xamo_active_session_id', activeSessionId);
  saveLocalSessions();

  if (supabaseClient && currentUser) {
    try {
      await supabaseClient.from('chats').upsert({
        id: activeSessionId,
        user_id: currentUser.id,
        user_email: currentUser.email,
        nickname: userNickname || 'Guest',
        title: title,
        history: cleanHistory,
        is_deleted_by_user: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn("Supabase upsert failed:", err);
    }
  }

  try {
    if (sessions.length > 25) sessions = sessions.slice(0, 25);
    saveLocalSessions();
  } catch (e) {}

  renderSessions(searchChatsInput ? searchChatsInput.value : "");
}

function loadSession(id) {
  if (activeStreamAbortController) {
    activeStreamAbortController.abort();
    activeStreamAbortController = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  const session = sessions.find(s => String(s.id) === String(id));
  if (!session) return;
  activeSessionId = String(session.id);
  localStorage.setItem('xamo_active_session_id', activeSessionId);
  currentChatHistory = JSON.parse(JSON.stringify(session.history));
  renderChatBox();
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
}

window.editMessage = function(index) {
  if (activeStreamAbortController) {
    activeStreamAbortController.abort();
    activeStreamAbortController = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();

  const msg = currentChatHistory[index];
  if (!msg || !input) return;

  input.value = msg.rawUserText || "";
  input.style.height = 'auto'; 
  input.style.height = input.scrollHeight + 'px';
  input.focus();

  if (msg.file) {
    attachedFile = { ...msg.file };
    if (attachedFile.category === 'image') {
      if (imagePreview && attachedFile.uri) {
        imagePreview.src = attachedFile.uri;
        imagePreview.classList.remove('hidden');
      }
      if (fileIcon) fileIcon.classList.add('hidden');
      if (fileNamePreview) fileNamePreview.classList.add('hidden');
    } else {
      if (imagePreview) imagePreview.classList.add('hidden');
      if (fileIcon) {
        fileIcon.classList.remove('hidden');
        fileIcon.innerHTML = attachedFile.category === 'video' ? '<i class="fa-solid fa-file-video text-purple-400"></i>' : (attachedFile.category === 'pdf' ? '<i class="fa-solid fa-file-pdf text-red-400"></i>' : '<i class="fa-solid fa-file-code text-blue-400"></i>');
      }
      if (fileNamePreview) {
        fileNamePreview.textContent = attachedFile.name;
        fileNamePreview.classList.remove('hidden');
      }
    }
    if (imagePreviewContainer) imagePreviewContainer.classList.remove('hidden');
  } else {
    attachedFile = null;
    if (imageInput) imageInput.value = "";
    if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
  }

  updateSendButtonState();
  currentChatHistory = currentChatHistory.slice(0, index);
  renderChatBox();
};

function renderChatBox() {
  if (!chatBox) return;
  chatBox.innerHTML = "";
  if (currentChatHistory.length === 0) {
    startNewChat();
    return;
  }

  currentChatHistory.forEach((msg, index) => {
    const isUser = msg.role === 'user';
    const div = document.createElement('div');
    div.className = isUser ? "flex flex-col items-end my-4 w-full group" : "flex flex-col items-start my-4 w-full group relative";
    
    if (isUser) {
      let contentHtml = '';

      if (msg.file) {
        const fileSrc = msg.file.uri || (msg.file.base64 ? `data:${msg.file.mimeType};base64,${msg.file.base64}` : "");

        if (msg.file.category === 'image' && fileSrc) {
          contentHtml += `
            <div onclick="viewAttachedFile(${index})" class="cursor-pointer mb-2.5 rounded-2xl overflow-hidden border border-slate-700/70 max-w-xs group/img bg-slate-900 shadow-md">
              <img src="${fileSrc}" class="w-full max-h-56 object-cover group-hover/img:opacity-90 transition-opacity" alt="${msg.file.name}" />
              <div class="px-3 py-1.5 text-[11px] text-slate-300 font-mono flex items-center justify-between bg-slate-950/80">
                <span class="truncate">${msg.file.name}</span>
                <i class="fa-solid fa-expand text-[10px] text-slate-400"></i>
              </div>
            </div>
          `;
        } else if (msg.file.category === 'video' && fileSrc) {
          contentHtml += `
            <div class="mb-2.5 rounded-2xl overflow-hidden border border-slate-700/70 max-w-xs bg-slate-900 shadow-md">
              <video controls playsinline preload="metadata" src="${fileSrc}" class="w-full max-h-56 object-contain bg-black"></video>
              <div class="px-3 py-1.5 text-[11px] text-slate-300 font-mono flex items-center justify-between bg-slate-950/80">
                <span class="truncate">${msg.file.name}</span>
                <a href="${fileSrc}" download="${msg.file.name}" class="text-blue-400 hover:text-blue-300"><i class="fa-solid fa-download"></i></a>
              </div>
            </div>
          `;
        } else {
          let iconHtml = '<i class="fa-solid fa-file-code text-blue-400"></i>';
          if (msg.file.category === 'pdf') iconHtml = '<i class="fa-solid fa-file-pdf text-red-400"></i>';

          contentHtml += `
            <div onclick="viewAttachedFile(${index})" class="flex items-center gap-3 bg-slate-800 hover:bg-slate-700/90 border border-slate-700 px-3.5 py-2 rounded-xl cursor-pointer transition-all mb-2 shadow-sm group/file">
              <div class="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-sm flex-shrink-0">
                ${iconHtml}
              </div>
              <div class="flex-1 min-w-0 pr-2">
                <div class="text-xs font-semibold text-slate-200 truncate font-mono">${msg.file.name}</div>
                <div class="text-[10px] text-slate-400">Click to preview</div>
              </div>
              <i class="fa-solid fa-arrow-up-right-from-square text-[11px] text-slate-500 group-hover/file:text-blue-400 transition-colors"></i>
            </div>
          `;
        }
      }

      if (msg.rawUserText) {
        contentHtml += `<div class="whitespace-pre-wrap" style="word-break: break-word;">${msg.rawUserText}</div>`;
      }

      const editBtnHtml = `<button onclick="editMessage(${index})" class="text-xs text-slate-400 hover:text-blue-400 mr-2 mb-1 transition-colors flex items-center gap-1"><i class="fa-solid fa-pen text-[10px]"></i> Edit</button>`;
      
      div.innerHTML = `<div class="flex flex-col items-end w-full">${editBtnHtml}<div class="gemini-user-bubble">${contentHtml}</div></div>`;

      const userBubble = div.querySelector('.gemini-user-bubble');
      if (userBubble && msg.rawUserText) {
        attachLongPressCopy(userBubble, msg.rawUserText);
      }

    } else {
      const textVal = (msg.parts && msg.parts[0]) ? msg.parts[0].text : "";
      
      div.innerHTML = `
        <div class="gemini-response-container w-full leading-relaxed break-words">${parseMarkdownSafely(textVal)}</div>
      `;

      const botResponse = div.querySelector('.gemini-response-container');
      if (botResponse && textVal) {
        attachLongPressCopy(botResponse, textVal);
      }

      const footerDiv = document.createElement('div');
      footerDiv.className = "flex items-center gap-4 mt-3 text-slate-400 text-sm flex-wrap";
      
      const pinBtn = document.createElement('button');
      pinBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
      pinBtn.title = "Pin to Notes Vault";
      pinBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
      pinBtn.onclick = () => pinMessageDirect(encodeURIComponent(textVal));

      const likeBtn = document.createElement('button');
      likeBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
      likeBtn.title = "Good response";
      likeBtn.innerHTML = '<i class="fa-regular fa-thumbs-up"></i>';
      likeBtn.onclick = () => {
        const existingNotice = footerDiv.querySelector('.feedback-notice');
        if (existingNotice) existingNotice.remove();
        const notice = document.createElement('span');
        notice.className = "feedback-notice text-xs text-blue-400 ml-2 font-medium";
        notice.textContent = "Glad that it was helpful for you!";
        footerDiv.appendChild(notice);
      };

      const dislikeBtn = document.createElement('button');
      dislikeBtn.className = "hover:text-red-400 transition-colors focus:outline-none";
      dislikeBtn.title = "Bad response";
      dislikeBtn.innerHTML = '<i class="fa-regular fa-thumbs-down"></i>';
      dislikeBtn.onclick = () => {
        const existingNotice = footerDiv.querySelector('.feedback-notice');
        if (existingNotice) existingNotice.remove();
        const notice = document.createElement('span');
        notice.className = "feedback-notice text-xs text-red-400 ml-2 font-medium";
        notice.textContent = "I apologize for that. Let me know how I can improve!";
        footerDiv.appendChild(notice);
      };

      const copyBtn = document.createElement('button');
      copyBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
      copyBtn.title = "Copy";
      copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(textVal.replace(/\[\[ACTION:[A-Z_]+:[^\]]*\]\]/g, '').trim()).then(() => {
          showXamoToast("Copied to clipboard!");
        });
      };

      const shareBtn = document.createElement('button');
      shareBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
      shareBtn.title = "Share";
      shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i>';
      shareBtn.onclick = async () => {
        const cleanShareText = textVal.replace(/\[\[ACTION:[A-Z_]+:[^\]]*\]\]/g, '').trim();
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'XAMO AI Response',
              text: cleanShareText
            });
            return;
          } catch (err) {}
        }
        navigator.clipboard.writeText(cleanShareText).then(() => {
          showXamoToast("Copied response to clipboard for sharing!");
        });
      };

      const isKashmiri = appSettings.language && appSettings.language.toLowerCase().includes('kashmiri');

      const regenBtn = document.createElement('button');
      regenBtn.className = "text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 ml-2 transition-colors";
      regenBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Regenerate';
      regenBtn.onclick = () => regenerateLastResponse();
      footerDiv.appendChild(regenBtn);

      footerDiv.appendChild(pinBtn);
      footerDiv.appendChild(likeBtn);
      footerDiv.appendChild(dislikeBtn);
      footerDiv.appendChild(copyBtn);
      footerDiv.appendChild(shareBtn);

      if (!isKashmiri) {
        const speakBtn = document.createElement('button');
        speakBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
        speakBtn.title = "Read Aloud";
        speakBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        speakBtn.onclick = () => toggleSpeech(textVal, speakBtn);
        footerDiv.appendChild(speakBtn);
      }

      div.appendChild(footerDiv);
      renderMath(div);
      enhanceMarkdownOutput(div);
    }
    chatBox.appendChild(div);
  });
  if (window.hljs) hljs.highlightAll();
  renderSessions(searchChatsInput ? searchChatsInput.value : "");
}

window.regenerateLastResponse = function() {
  if (activeStreamAbortController) {
    activeStreamAbortController.abort();
    activeStreamAbortController = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (currentChatHistory.length > 1 && currentChatHistory[currentChatHistory.length-1].role === 'model') {
    currentChatHistory.pop();
    renderChatBox();
    triggerApiCall();
  }
};

async function deleteSession(id) {
  if (activeStreamAbortController) {
    activeStreamAbortController.abort();
    activeStreamAbortController = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  sessions = sessions.filter(s => String(s.id) !== String(id));
  saveLocalSessions();

  if (supabaseClient && currentUser) {
    try {
      await supabaseClient
        .from('chats')
        .update({ is_deleted_by_user: true })
        .eq('id', id);
    } catch (err) {}
  }

  if (String(activeSessionId) === String(id)) {
    startNewChat();
  } else {
    renderSessions(searchChatsInput ? searchChatsInput.value : "");
  }
}

function startNewChat() {
  if (activeStreamAbortController) {
    activeStreamAbortController.abort();
    activeStreamAbortController = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  
  activeSessionId = null;
  localStorage.removeItem('xamo_active_session_id');
  currentChatHistory = [];

  // Guarantee clean input box on new chat
  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }
  attachedFile = null;
  if (imageInput) imageInput.value = '';
  if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
  updateSendButtonState();
  
  if (chatBox) {
    const welcomeName = userNickname ? `, ${userNickname}` : '';
    chatBox.innerHTML = `
      <div id="welcome-screen" class="flex flex-col items-center justify-center flex-1 text-center px-4 h-full">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/40 mb-5 text-xl">
          <i class="fa-solid fa-bolt"></i>
        </div>
        <h1 class="text-2xl md:text-4xl font-normal tracking-tight" style="color: var(--text-main);">What can I help you with today${welcomeName}?</h1>
      </div>
    `;
  }
  
  renderSessions(searchChatsInput ? searchChatsInput.value : "");
  if (window.innerWidth < 768 && sidebar && !sidebar.classList.contains('-translate-x-full')) {
    toggleSidebar();
  }
}

if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);

if (clearBtn) clearBtn.addEventListener('click', () => {
  if (activeSessionId) {
    deleteSession(activeSessionId);
  } else {
    startNewChat();
  }
});

if (searchChatsInput) searchChatsInput.addEventListener('input', (e) => renderSessions(e.target.value));

if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    if (currentChatHistory.length === 0) {
      alert("No active conversation to export!");
      return;
    }
    let mdContent = "# XAMO AI Chat Export\n\n";
    currentChatHistory.forEach(m => {
      const role = m.role === 'user' ? "### User\n" : "### XAMO\n";
      const txt = m.rawUserText || (m.file ? `[Attached File: ${m.file.name}]` : "");
      mdContent += role + txt + "\n\n";
    });
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xamo-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// --- Search Bar Input & Slash Command Menu Engine ---
function initSearchBarAndSlashMenu() {
  if (!input) return;

  input.addEventListener('input', () => {
    const val = input.value;
    
    if (slashMenu) {
      if (val.trim().startsWith('/')) {
        slashMenu.classList.remove('hidden');
      } else {
        slashMenu.classList.add('hidden');
      }
    }

    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    updateSendButtonState();
  });

  if (slashOptions && slashMenu) {
    slashOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const cmd = opt.getAttribute('data-cmd');
        if (cmd) {
          input.value = cmd;
          input.focus();
          input.style.height = 'auto';
          input.style.height = Math.min(input.scrollHeight, 160) + 'px';
          slashMenu.classList.add('hidden');
          updateSendButtonState();
        }
      });
    });
  }

  document.addEventListener('click', (e) => {
    if (slashMenu && !slashMenu.contains(e.target) && e.target !== input) {
      slashMenu.classList.add('hidden');
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
      if (!isMobile && form) {
        e.preventDefault();
        if (slashMenu) slashMenu.classList.add('hidden');
        form.requestSubmit();
      }
    } else if (e.key === 'Escape' && slashMenu) {
      slashMenu.classList.add('hidden');
    }
  });
}

// --- Form Dispatch Engine ---
if (form) {
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    e.stopPropagation();

    const rawTypedText = input ? input.value.trim() : "";
    if (!rawTypedText && !attachedFile) return;

    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) welcomeScreen.remove();

    checkImmediateUserIntent(rawTypedText);

    const userParts = [];
    let promptPayloadText = rawTypedText;

    if (attachedFile) {
      if (attachedFile.category === 'text' || attachedFile.category === 'pdf') {
        promptPayloadText = `[Attached Document: ${attachedFile.name}]\n${attachedFile.content}\n\n${rawTypedText}`;
      } else {
        userParts.push({ inline_data: { mime_type: attachedFile.mimeType, data: attachedFile.base64 } });
      }
    }

    if (promptPayloadText) userParts.push({ text: promptPayloadText });

    const fileSnapshot = attachedFile ? { ...attachedFile } : null;

    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }
    attachedFile = null;
    if (imageInput) imageInput.value = '';
    if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
    updateSendButtonState();

    currentChatHistory.push({ 
      role: 'user', 
      parts: userParts,
      file: fileSnapshot,
      rawUserText: rawTypedText
    });
    
    renderChatBox();

    // Fire persistence non-blockingly
    saveCurrentSession().catch(() => {});

    // Stream AI reply immediately
    await triggerApiCall();
  });
}

// Sub-Second Streaming Execution
async function triggerApiCall() {
  if (activeStreamAbortController) {
    activeStreamAbortController.abort();
  }
  activeStreamAbortController = new AbortController();
  const signal = activeStreamAbortController.signal;

  const isLocalEnvironment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';

  const botDiv = document.createElement('div');
  botDiv.className = 'flex flex-col items-start my-4 w-full';
  const responseContent = document.createElement('div');
  responseContent.className = 'gemini-response-container w-full leading-relaxed break-words animate-pulse';
  responseContent.textContent = "● ● ●";
  botDiv.appendChild(responseContent);
  
  if (chatBox) {
    chatBox.appendChild(botDiv);
    botDiv.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  try {
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const now = new Date();
    const currentDateLocal = now.toLocaleString('en-US', { 
      timeZone: userTimeZone,
      hour12: appSettings.timeFormat !== '24',
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
    const currentDateUTC = now.toUTCString();

    const basePrompt = customPersonas[currentPersonaIndex] ? customPersonas[currentPersonaIndex].prompt : customPersonas[0].prompt;
    const userAddressing = userNickname ? `\nUser's Nickname: "${userNickname}".` : "";
    const langInstruction = appSettings.language && appSettings.language !== 'auto' ? `\nRespond strictly in ${appSettings.language}.` : "";
    const liveClockInstruction = `\n[Reference System Clock: UTC ${currentDateUTC} | Local ${currentDateLocal} (${userTimeZone})]`;

    const dynamicSystemInstruction = `${basePrompt}${userAddressing}${langInstruction}${liveClockInstruction}`;

    const payloadHistory = currentChatHistory.slice(-4).map((m, idx, arr) => {
      const isCurrentTurn = idx === arr.length - 1;
      if (isCurrentTurn) {
        return { role: m.role, parts: m.parts };
      }
      const prunedParts = (m.parts || []).map(p => {
        if (p.inline_data) {
          return { text: `[Analyzed Attachment: ${m.file?.name || 'Media'}]` };
        }
        return p;
      });
      return { role: m.role, parts: prunedParts };
    });

    const hasAnyAttachment = currentChatHistory.some(m => !!m.file);
    const lastUserMessage = currentChatHistory.slice().reverse().find(m => m.role === 'user');
    const rawUserText = lastUserMessage?.rawUserText || "";

    const requestBody = {
      systemInstruction: { parts: [{ text: dynamicSystemInstruction }] },
      contents: payloadHistory,
      hasAttachment: hasAnyAttachment,
      userPromptText: rawUserText
    };

    const targetUrl = isLocalEnvironment ? 'https://xamo-ai.vercel.app/api/chat' : '/api/chat';

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: signal
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || errData.error || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let sseBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.replace("data: ", "").trim();
          if (dataStr === "[DONE]") continue;
          try {
            const json = JSON.parse(dataStr);
            const candidateParts = json.candidates?.[0]?.content?.parts;
            if (Array.isArray(candidateParts)) {
              for (const p of candidateParts) {
                if (p.text && !p.thought) {
                  if (!fullText) {
                    responseContent.classList.remove('animate-pulse');
                    responseContent.innerHTML = "";
                  }
                  fullText += p.text;
                  responseContent.innerHTML = parseMarkdownSafely(fullText);
                }
              }
            }
          } catch (e) {}
        }
      }
    }

    if (!fullText) {
      responseContent.classList.remove('animate-pulse');
      responseContent.innerHTML = `<span class="text-slate-400 text-xs italic">Response complete.</span>`;
    }

    const actionMatches = [...fullText.matchAll(/\[\[ACTION:([A-Z_]+):(.*?)\]\]/g)];
    for (const match of actionMatches) {
      executeAutonomousAction(match[1], match[2]);
    }

    renderMath(responseContent);
    enhanceMarkdownOutput(botDiv);
    if (window.hljs) hljs.highlightAll();

    currentChatHistory.push({ role: 'model', parts: [{ text: fullText }] });
    
    saveCurrentSession().catch(() => {});

    const footerDiv = document.createElement('div');
    footerDiv.className = "flex items-center gap-4 mt-3 text-slate-400 text-sm flex-wrap";
    
    const pinBtn = document.createElement('button');
    pinBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
    pinBtn.title = "Pin to Notes Vault";
    pinBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
    pinBtn.onclick = () => pinMessageDirect(encodeURIComponent(fullText));

    const likeBtn = document.createElement('button');
    likeBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
    likeBtn.title = "Good response";
    likeBtn.innerHTML = '<i class="fa-regular fa-thumbs-up"></i>';
    likeBtn.onclick = () => {
      const existingNotice = footerDiv.querySelector('.feedback-notice');
      if (existingNotice) existingNotice.remove();
      const notice = document.createElement('span');
      notice.className = "feedback-notice text-xs text-blue-400 ml-2 font-medium";
      notice.textContent = "Glad that it was helpful for you!";
      footerDiv.appendChild(notice);
    };

    const dislikeBtn = document.createElement('button');
    dislikeBtn.className = "hover:text-red-400 transition-colors focus:outline-none";
    dislikeBtn.title = "Bad response";
    dislikeBtn.innerHTML = '<i class="fa-regular fa-thumbs-down"></i>';
    dislikeBtn.onclick = () => {
      const existingNotice = footerDiv.querySelector('.feedback-notice');
      if (existingNotice) existingNotice.remove();
      const notice = document.createElement('span');
      notice.className = "feedback-notice text-xs text-red-400 ml-2 font-medium";
      notice.textContent = "I apologize for that. Let me know how I can improve!";
      footerDiv.appendChild(notice);
    };

    const copyBtn = document.createElement('button');
    copyBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
    copyBtn.title = "Copy";
    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(fullText.replace(/\[\[ACTION:[A-Z_]+:[^\]]*\]\]/g, '').trim()).then(() => {
        showXamoToast("Copied to clipboard!");
      });
    };

    const shareBtn = document.createElement('button');
    shareBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
    shareBtn.title = "Share";
    shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i>';
    shareBtn.onclick = async () => {
      const cleanShareText = fullText.replace(/\[\[ACTION:[A-Z_]+:[^\]]*\]\]/g, '').trim();
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'XAMO AI Response',
            text: cleanShareText
          });
          return;
        } catch (err) {}
      }
      navigator.clipboard.writeText(cleanShareText).then(() => {
        showXamoToast("Copied response to clipboard for sharing!");
      });
    };

    const isKashmiri = appSettings.language && appSettings.language.toLowerCase().includes('kashmiri');

    const regenBtn = document.createElement('button');
    regenBtn.className = "text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 ml-2 transition-colors";
    regenBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Regenerate';
    regenBtn.onclick = () => regenerateLastResponse();
    footerDiv.appendChild(regenBtn);

    footerDiv.appendChild(pinBtn);
    footerDiv.appendChild(likeBtn);
    footerDiv.appendChild(dislikeBtn);
    footerDiv.appendChild(copyBtn);
    footerDiv.appendChild(shareBtn);

    if (!isKashmiri) {
      const speakBtn = document.createElement('button');
      speakBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
      speakBtn.title = "Read Aloud";
      speakBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      speakBtn.onclick = () => toggleSpeech(fullText, speakBtn);
      footerDiv.appendChild(speakBtn);
    }

    botDiv.appendChild(footerDiv);

  } catch (err) {
    if (err.name === 'AbortError') return;
    responseContent.classList.remove('animate-pulse');
    responseContent.innerHTML = `<span class="text-red-400">System Error: ${err.message}</span>`;
  } finally {
    activeStreamAbortController = null;
  }
}

// --- Lifecycle Initialization ---
injectGeminiThemeStyles();
injectScrollDownButton();
updateSearchPlaceholder();
initSearchBarAndSlashMenu();
initVoices();
initAuth();
handleUrlAuthFlags();

// App Open/Reopen Lifecycle: Guarantees a fresh screen with previous history in sidebar
window.addEventListener('DOMContentLoaded', () => {
  // Clear any residual input text cached by the browser
  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }
  attachedFile = null;
  if (imageInput) imageInput.value = '';
  if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
  updateSendButtonState();

  // Load saved session index and begin in a clean, fresh conversation
  loadLocalSessions();
  startNewChat();
  renderSessions();
});