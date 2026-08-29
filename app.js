// ============================================================================
// XAMO AI - ULTRA-LOW LATENCY CORE ENGINE (GEMINI 3.5 FLASH-LITE)
// ============================================================================

const SUPABASE_URL = "https://vnlhctmxlctsvyhwyvrl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGhjdG14bGN0c3Z5aHd5dnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MzE0NzgsImV4cCI6MjEwMzMwNzQ3OH0.uj2A-itY_CPhZDmWgF9TCYXgR5PXMGeGXa7L58DD_3w";
const ADMIN_EMAIL = "xamoxm366@gmail.com";

let supabaseClient = null;
try {
  if (typeof window.supabase !== 'undefined' && SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.includes('PASTE_YOUR')) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn("Supabase init skipped:", e);
}

let currentUser = null;
let userNickname = "";
let activeStreamAbortController = null; // Prevents duplicate responses on message edits

let appSettings = JSON.parse(localStorage.getItem('xamo_app_settings') || '{"language":"auto","timeFormat":"12"}');

// --- Persistent Nickname Engine ---
const nicknameModal = document.getElementById('nickname-modal');
const nicknameInput = document.getElementById('nickname-input');
const saveNicknameBtn = document.getElementById('save-nickname-btn');
const settingsNicknameInput = document.getElementById('settings-nickname-input');
const welcomeHeading = document.getElementById('welcome-heading');
const adminPanelLink = document.getElementById('admin-panel-link');

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

// --- Theme Engine ---
const themeBtn = document.getElementById('theme-btn');
const themeDropdown = document.getElementById('theme-dropdown');
const themeLabel = document.getElementById('theme-label');
const themeOptions = document.querySelectorAll('.theme-option');

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

// --- Element References ---
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

// Multi-Account Selectors
const userLoggedInView = document.getElementById('user-logged-in-view');
const guestSigninView = document.getElementById('guest-signin-view');
const guestSigninBtn = document.getElementById('guest-signin-btn');
const userEmailDisplay = document.getElementById('user-email-display');
const accountSwitcherBtn = document.getElementById('account-switcher-btn');
const accountSwitcherMenu = document.getElementById('account-switcher-menu');
const savedAccountsList = document.getElementById('saved-accounts-list');
const addAnotherAccountBtn = document.getElementById('add-another-account-btn');
const signoutCurrentAccountBtn = document.getElementById('signout-current-account-btn');

// Pinned Notes Selectors
const pinnedNotesModal = document.getElementById('pinned-notes-modal');
const pinnedNotesTriggerBtn = document.getElementById('pinned-notes-trigger-btn');
const closePinnedModal = document.getElementById('close-pinned-modal');
const pinnedNotesContainer = document.getElementById('pinned-notes-container');
const pinnedCountBadge = document.getElementById('pinned-count-badge');

// Auth References
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

let authMode = "signin";
let attachedFile = null;
let resetEmailCooldown = false;
const voiceBtn = document.getElementById('voice-btn');

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
      if (data) return data;
    } catch (e) {}
  }
  return JSON.parse(localStorage.getItem('xamo_pinned_notes') || '[]');
}

async function addPinnedNote(text) {
  if (currentUser && supabaseClient) {
    try {
      await supabaseClient.from('pinned_notes').insert([{ user_id: currentUser.id, note_text: text }]);
    } catch (e) {}
  }
  let notes = JSON.parse(localStorage.getItem('xamo_pinned_notes') || '[]');
  notes.unshift({ id: 'note_' + Date.now(), note_text: text, created_at: new Date().toISOString() });
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
  notes = notes.filter(n => n.id != id);
  localStorage.setItem('xamo_pinned_notes', JSON.stringify(notes));
  renderPinnedNotes();
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
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button onclick="navigator.clipboard.writeText(\`${n.note_text.replace(/`/g, '\\`')}\`); showXamoToast('Copied note!');" class="text-slate-400 hover:text-blue-400 p-1 transition-colors"><i class="fa-solid fa-copy"></i></button>
        <button onclick="deletePinnedNote('${n.id}')" class="text-slate-400 hover:text-red-400 p-1 transition-colors"><i class="fa-solid fa-trash-can"></i></button>
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

// --- Password Eye Toggle Button ---
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

// --- Mode Switcher ---
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
    if (authMode === 'forgot') {
      setAuthMode('signin');
    } else if (authMode === 'signin') {
      setAuthMode('signup');
    } else {
      setAuthMode('signin');
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

function showXamoToast(message) {
  const existing = document.getElementById('xamo-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'xamo-toast';
  toast.className = "fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-[#1e1f20] border border-slate-700 text-slate-200 text-xs px-4 py-2 rounded-xl shadow-2xl z-[100] flex items-center gap-2 transition-all duration-300";
  toast.innerHTML = `<i class="fa-solid fa-check text-blue-400"></i> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

// --- Attachment Viewer Logic ---
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

  if (file.category === 'image') {
    if (viewerFileIcon) viewerFileIcon.className = "fa-solid fa-image text-blue-400 text-sm";
    const src = file.uri || (file.base64 ? `data:${file.mimeType};base64,${file.base64}` : "");
    if (src && viewerContentContainer) {
      viewerContentContainer.innerHTML = `<img src="${src}" class="max-w-full max-h-[70vh] rounded-xl object-contain shadow-lg border border-slate-700">`;
    }
  } else if (file.category === 'video') {
    if (viewerFileIcon) viewerFileIcon.className = "fa-solid fa-file-video text-purple-400 text-sm";
    if (viewerContentContainer) viewerContentContainer.innerHTML = file.uri ? `<video controls src="${file.uri}" class="max-w-full max-h-[70vh] rounded-xl shadow-lg"></video>` : `<p class="text-xs text-slate-400 p-4 text-center">Video preview expired.</p>`;
  } else if (file.category === 'pdf') {
    if (viewerFileIcon) viewerFileIcon.className = "fa-solid fa-file-pdf text-red-400 text-sm";
    if (viewerContentContainer) viewerContentContainer.innerHTML = file.uri ? `<embed src="${file.uri}" type="application/pdf" class="w-full h-[65vh] rounded-xl border border-slate-700">` : `<p class="text-xs text-slate-400 p-4 text-center">PDF text extracted directly.</p>`;
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
    pre.className = "w-full text-xs font-mono text-slate-200 overflow-x-auto p-4 rounded-xl bg-slate-950 border border-slate-800 leading-relaxed";
    const code = document.createElement('code');
    code.textContent = file.content || "Code content unavailable";
    pre.appendChild(code);
    if (viewerContentContainer) viewerContentContainer.appendChild(pre);
    if (window.hljs) hljs.highlightElement(code);
  }

  fileViewerModal.classList.remove('hidden');
};

// --- Slash Commands Menu ---
const slashMenu = document.getElementById('slash-menu');
const slashOptions = document.querySelectorAll('#slash-list li');

if (input && slashMenu) {
  input.addEventListener('input', () => {
    if (input.value.trim() === '/') {
      slashMenu.classList.remove('hidden');
    } else {
      slashMenu.classList.add('hidden');
    }
    updateSendButtonState();
  });

  slashOptions.forEach(option => {
    option.addEventListener('click', () => {
      input.value = option.getAttribute('data-cmd');
      input.style.height = 'auto'; 
      input.style.height = input.scrollHeight + 'px';
      slashMenu.classList.add('hidden');
      input.focus();
      updateSendButtonState();
    });
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const isMobileDevice = window.innerWidth < 768 || 'ontouchstart' in window;
      if (!isMobileDevice && form) {
        e.preventDefault();
        form.requestSubmit();
      }
    }
  });
}

// --- Settings Modal Logic ---
if (settingsBtn && settingsModal) settingsBtn.addEventListener('click', () => {
  if (settingsNicknameInput) settingsNicknameInput.value = userNickname;
  if (settingsLangSelect) settingsLangSelect.value = appSettings.language || "auto";
  if (settingsTimeSelect) settingsTimeSelect.value = appSettings.timeFormat || "12";
  settingsModal.classList.remove('hidden');
});
if (closeSettings && settingsModal) closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

if (saveSettings && settingsModal) {
  saveSettings.addEventListener('click', () => {
    if (settingsNicknameInput) {
      const newNick = settingsNicknameInput.value.trim();
      if (newNick) saveCurrentNickname(newNick);
    }

    appSettings.language = settingsLangSelect ? settingsLangSelect.value : "auto";
    appSettings.timeFormat = settingsTimeSelect ? settingsTimeSelect.value : "12";
    localStorage.setItem('xamo_app_settings', JSON.stringify(appSettings));

    settingsModal.classList.add('hidden');
    showXamoToast("Preferences saved successfully!");
  });
}

// --- Personas Setup ---
const BASE_PERSONAS = [
  { 
    name: 'Default', 
    prompt: "You are XAMO, an authentic, adaptive AI assistant with live world clock awareness created by Zaeem. Answer with extreme speed, direct accuracy, and concise formatting. Use Markdown tables, bullet points, and code blocks."
  },
  { 
    name: 'Coder', 
    prompt: "You are XAMO, a principal software architect created by Zaeem. Provide production-grade, optimized code immediately with clean syntax."
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

function deletePersona(idx) {
  const deletedName = customPersonas[idx].name;
  customPersonas.splice(idx, 1);
  saveUserPersonas();
  
  if (currentPersonaIndex === idx) {
    currentPersonaIndex = 0;
    if (personaLabel) personaLabel.textContent = customPersonas[0].name;
  } else if (currentPersonaIndex > idx) {
    currentPersonaIndex--;
  }
  
  renderPersonas();
  showXamoToast(`Persona "${deletedName}" deleted.`);
}

function renderPersonas() {
  if (!personaListOptions) return;
  personaListOptions.innerHTML = "";
  customPersonas.forEach((p, idx) => {
    const div = document.createElement('div');
    const isSelected = currentPersonaIndex === idx;
    const isDeletable = idx >= 2;

    div.className = "group persona-option px-3 py-2 text-xs hover:bg-slate-500/10 cursor-pointer transition-colors flex items-center justify-between gap-2";
    
    const leftSpan = document.createElement('div');
    leftSpan.className = "flex items-center gap-2 truncate flex-1";
    leftSpan.innerHTML = isSelected 
      ? `<i class="fa-solid fa-check text-blue-400 text-[10px]"></i> <span class="truncate font-semibold text-blue-400">${p.name}</span>`
      : `<span class="truncate">${p.name}</span>`;

    const rightActions = document.createElement('div');
    rightActions.className = "flex items-center gap-1.5 flex-shrink-0";

    if (isDeletable) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 p-1 transition-opacity text-[10px]";
      deleteBtn.title = `Delete ${p.name}`;
      deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deletePersona(idx);
      };
      rightActions.appendChild(deleteBtn);
    }

    div.appendChild(leftSpan);
    div.appendChild(rightActions);

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

if (attachBtn && imageInput) attachBtn.addEventListener('click', () => imageInput.click());

// --- Ultra-Fast Document & Media Compressor ---
if (imageInput) {
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileType = file.type;
    const fileName = file.name || "Upload";

    if (fileType.startsWith('image/') || (!fileType && /\.(jpe?g|png|webp|heic|bmp)$/i.test(fileName))) {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = function () {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 600; // Ultralight max dimension for instantaneous transfer

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
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.55);
        
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

      img.onerror = function() {
        URL.revokeObjectURL(objectUrl);
        showXamoToast("Failed to load image format.");
      };

      img.src = objectUrl;

    } else if (fileType === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async function(uploadEvent) {
        try {
          showXamoToast("Reading PDF contents...");
          const typedarray = new Uint8Array(uploadEvent.target.result);
          
          if (typeof pdfjsLib !== 'undefined') {
            const loadingTask = pdfjsLib.getDocument({ data: typedarray });
            const pdf = await loadingTask.promise;
            let fullPdfText = "";
            
            const maxPages = Math.min(pdf.numPages, 35);
            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => item.str).join(" ");
              fullPdfText += `\n[Page ${pageNum}] ` + pageText;
            }

            if (fullPdfText.trim().length > 20) {
              attachedFile = {
                category: 'text',
                content: `[Document Content: ${fileName}]\n${fullPdfText.trim()}`,
                name: fileName
              };
            } else {
              let binary = '';
              const bytes = new Uint8Array(typedarray);
              const len = Math.min(bytes.byteLength, 3 * 1024 * 1024);
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              attachedFile = {
                category: 'pdf',
                mimeType: 'application/pdf',
                base64: btoa(binary),
                uri: '',
                name: fileName
              };
            }
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
          showXamoToast("PDF processed!");
        } catch (pdfErr) {
          showXamoToast("Failed to parse PDF text.");
        }
      };
      reader.readAsArrayBuffer(file);

    } else if (fileType.startsWith('video/')) {
      if (file.size > 8 * 1024 * 1024) {
        showXamoToast("Video must be under 8MB for analysis.");
        imageInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = function(uploadEvent) {
        attachedFile = {
          category: 'video',
          mimeType: fileType,
          base64: uploadEvent.target.result.split(',')[1],
          uri: uploadEvent.target.result,
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
      };
      reader.readAsDataURL(file);

    } else {
      const reader = new FileReader();
      reader.onload = function(uploadEvent) {
        attachedFile = { category: 'text', content: uploadEvent.target.result, name: fileName };
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
  removeImageBtn.addEventListener('click', () => {
    attachedFile = null;
    if (imageInput) imageInput.value = "";
    if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
    updateSendButtonState();
  });
}

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      recognition.start();
      voiceBtn.classList.add('text-blue-400', 'animate-pulse');
    });
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (input) {
        input.value += (input.value ? " " : "") + transcript;
        input.style.height = 'auto'; 
        input.style.height = input.scrollHeight + 'px';
      }
      voiceBtn.classList.remove('text-blue-400', 'animate-pulse');
      updateSendButtonState();
    };
    recognition.onerror = () => voiceBtn.classList.remove('text-blue-400', 'animate-pulse');
    recognition.onend = () => voiceBtn.classList.remove('text-blue-400', 'animate-pulse');
  }
} else if (voiceBtn) {
  voiceBtn.style.display = 'none';
}

function toggleSidebar() {
  if (!sidebar) return;
  const isOpen = !sidebar.classList.contains('-translate-x-full');
  if (isOpen) {
    sidebar.classList.add('-translate-x-full');
    if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
  } else {
    sidebar.classList.remove('-translate-x-full');
    if (sidebarOverlay) sidebarOverlay.classList.remove('hidden');
  }
}

if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

let currentChatHistory = []; 
let sessions = [];
let activeSessionId = null;

// --- Auth State Handshake ---
async function initAuth() {
  if (!supabaseClient) {
    loadUserPersonas();
    loadCurrentNickname();
    sessions = [];
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
      handleAuthStateChange(session?.user || null);
    });
  } catch (e) {
    console.warn("Auth initialization failed:", e);
    loadUserPersonas();
    loadCurrentNickname();
    sessions = [];
    renderSessions();
  }
  updatePinnedBadge();
}

async function handleAuthStateChange(user) {
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
    startNewChat();
    await syncCloudChats();
  } else {
    if (userLoggedInView) userLoggedInView.classList.add('hidden');
    if (guestSigninView) guestSigninView.classList.remove('hidden');
    if (adminPanelLink) adminPanelLink.classList.add('hidden');

    loadCurrentNickname();
    sessions = [];
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
      sessions = data.map(item => ({
        id: item.id,
        title: item.title,
        history: item.history
      }));
      const key = getChatStorageKey();
      if (key) localStorage.setItem(key, JSON.stringify(sessions));
      renderSessions(searchChatsInput ? searchChatsInput.value : "");
    }
  } catch (err) {
    console.error("Cloud fetch error:", err);
  }
}

if (closeAuthModal && authModal) closeAuthModal.addEventListener('click', () => authModal.classList.add('hidden'));

if (authSubmitBtn) {
  authSubmitBtn.addEventListener('click', async () => {
    hideAuthError();
    if (!supabaseClient) {
      showAuthError("Supabase connection is not initialized.");
      return;
    }
    const email = authEmailInput ? authEmailInput.value.trim() : "";
    const password = authPasswordInput ? authPasswordInput.value.trim() : "";

    if (!email) {
      showAuthError("Please enter your email address.");
      return;
    }

    const btnTextSpan = authSubmitBtn.querySelector('span');

    try {
      if (authMode === 'forgot') {
        if (resetEmailCooldown) {
          showAuthError("Please wait a moment before requesting another reset email.");
          return;
        }

        btnTextSpan.textContent = "Sending...";
        authSubmitBtn.disabled = true;

        const redirectTarget = "https://xamo-ai.vercel.app/reset-password.html";

        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTarget
        });

        if (error) throw error;

        showXamoToast("Reset link sent! Check your Inbox & Spam folders.");
        if (authModal) authModal.classList.add('hidden');
        setAuthMode('signin');

        resetEmailCooldown = true;
        setTimeout(() => { resetEmailCooldown = false; }, 45000);

      } else if (authMode === 'signup') {
        if (!password) { showAuthError("Please enter a password."); return; }
        btnTextSpan.textContent = "Creating Account...";
        authSubmitBtn.disabled = true;

        const { error } = await supabaseClient.auth.signUp({ 
          email, 
          password,
          options: { emailRedirectTo: "https://xamo-ai.vercel.app/verified.html" }
        });
        if (error) throw error;
        showXamoToast("Account created! Check your email to verify.");
        if (authModal) authModal.classList.add('hidden');

      } else {
        if (!password) { showAuthError("Please enter your password."); return; }
        btnTextSpan.textContent = "Signing In...";
        authSubmitBtn.disabled = true;

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          const errMsg = error.message.toLowerCase();
          if (errMsg.includes('email not confirmed')) {
            throw new Error("Email not verified yet. Please check your inbox or sign up first.");
          } else if (errMsg.includes('invalid login credentials')) {
            throw new Error("Account not found or password incorrect. Please sign up first.");
          }
          throw error;
        }
        if (data.session) storeCurrentAccount(data.session);
        showXamoToast("Signed in successfully!");
        if (authModal) authModal.classList.add('hidden');
      }
      
      if (authEmailInput) authEmailInput.value = "";
      if (authPasswordInput) authPasswordInput.value = "";
    } catch (err) {
      showAuthError(err.message);
    } finally {
      authSubmitBtn.disabled = false;
      if (authMode === 'forgot') {
        btnTextSpan.textContent = "Send Reset Link";
      } else if (authMode === 'signup') {
        btnTextSpan.textContent = "Sign Up";
      } else {
        btnTextSpan.textContent = "Sign In";
      }
    }
  });
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
  const rawHtml = marked.parse(text);
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
    const isActive = session.id === activeSessionId;
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
        return { inline_data: { mime_type: part.inline_data.mime_type, data: part.inline_data.data } };
      }
      return part;
    });

    let lightweightFile = null;
    if (msg.file) {
      lightweightFile = {
        name: msg.file.name,
        category: msg.file.category,
        mimeType: msg.file.mimeType,
        uri: msg.file.uri || ""
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
    const session = sessions.find(s => s.id === activeSessionId);
    if (session) {
      session.history = cleanHistory;
      session.title = title;
    }
  }

  if (supabaseClient) {
    try {
      await supabaseClient.from('chats').upsert({
        id: activeSessionId,
        user_id: currentUser ? currentUser.id : null,
        user_email: currentUser ? currentUser.email : 'Guest',
        nickname: userNickname || 'Guest',
        title: title,
        history: cleanHistory,
        is_deleted_by_user: false,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Supabase sync issue:", err);
    }
  }

  if (currentUser) {
    try {
      if (sessions.length > 20) sessions = sessions.slice(0, 20);
      const key = getChatStorageKey();
      if (key) localStorage.setItem(key, JSON.stringify(sessions));
    } catch (e) {}
  }

  renderSessions(searchChatsInput ? searchChatsInput.value : "");
}

function loadSession(id) {
  if (activeStreamAbortController) {
    activeStreamAbortController.abort();
    activeStreamAbortController = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  const session = sessions.find(s => s.id === id);
  if (!session) return;
  activeSessionId = session.id;
  currentChatHistory = JSON.parse(JSON.stringify(session.history));
  renderChatBox();
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
}

window.editMessage = function(index) {
  // 1. Immediately cancel any running stream to eliminate duplicate generations
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
    div.className = isUser ? "flex flex-col items-end my-3 w-full group" : "flex flex-col items-start my-3 w-full group relative";
    
    if (isUser) {
      let contentHtml = '';

      if (msg.file) {
        let iconHtml = '<i class="fa-solid fa-file-code text-blue-400"></i>';
        if (msg.file.category === 'image') iconHtml = '<i class="fa-solid fa-image text-blue-400"></i>';
        if (msg.file.category === 'video') iconHtml = '<i class="fa-solid fa-file-video text-purple-400"></i>';
        if (msg.file.category === 'pdf') iconHtml = '<i class="fa-solid fa-file-pdf text-red-400"></i>';

        contentHtml += `
          <div onclick="viewAttachedFile(${index})" class="flex items-center gap-3 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all mb-2 shadow-sm group/file">
            <div class="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-sm flex-shrink-0">
              ${iconHtml}
            </div>
            <div class="flex-1 min-w-0 pr-2">
              <div class="text-xs font-semibold text-slate-200 truncate font-mono">${msg.file.name}</div>
              <div class="text-[10px] text-slate-400">Click to preview file</div>
            </div>
            <i class="fa-solid fa-arrow-up-right-from-square text-[11px] text-slate-500 group-hover/file:text-blue-400 transition-colors"></i>
          </div>
        `;
      }

      if (msg.rawUserText) {
        contentHtml += `<div class="text-sm leading-relaxed whitespace-pre-wrap" style="word-break: break-word;">${msg.rawUserText}</div>`;
      }

      const editBtnHtml = `<button onclick="editMessage(${index})" class="text-xs text-slate-400 hover:text-blue-400 mr-2 mb-1 transition-colors flex items-center gap-1"><i class="fa-solid fa-pen text-[10px]"></i> Edit</button>`;
      
      div.innerHTML = `<div class="flex flex-col items-end w-full">${editBtnHtml}<div class="gemini-user-bubble px-4 lg:px-5 py-3 rounded-2xl max-w-[95%] sm:max-w-[85%] min-w-[50px]">${contentHtml}</div></div>`;
    } else {
      const textVal = msg.parts[0].text;
      const isLastBotMsg = index === currentChatHistory.length - 1;
      
      let regenBtnHtml = isLastBotMsg ? `<div class="mt-2 transition-opacity"><button onclick="regenerateLastResponse()" class="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1"><i class="fa-solid fa-rotate-right"></i> Regenerate</button></div>` : '';

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
        navigator.clipboard.writeText(textVal).then(() => {
          showXamoToast("Copied to clipboard!");
        });
      };

      const shareBtn = document.createElement('button');
      shareBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
      shareBtn.title = "Share";
      shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i>';
      shareBtn.onclick = () => {
        if (navigator.share) {
          navigator.share({
            title: 'XAMO AI Response',
            text: textVal
          }).catch(() => {});
        } else {
          navigator.clipboard.writeText(textVal);
          showXamoToast("Copied to clipboard for sharing!");
        }
      };

      const speakBtn = document.createElement('button');
      speakBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
      speakBtn.title = "Read Aloud";
      speakBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      speakBtn.onclick = () => toggleSpeech(textVal, speakBtn);

      footerDiv.appendChild(pinBtn);
      footerDiv.appendChild(likeBtn);
      footerDiv.appendChild(dislikeBtn);
      footerDiv.appendChild(copyBtn);
      footerDiv.appendChild(shareBtn);
      footerDiv.appendChild(speakBtn);

      div.innerHTML = `
        <div class="gemini-response-container w-full leading-relaxed break-words">${parseMarkdownSafely(textVal)}</div>
      `;
      div.appendChild(footerDiv);
      if (regenBtnHtml) {
        const regenContainer = document.createElement('div');
        regenContainer.innerHTML = regenBtnHtml;
        div.appendChild(regenContainer);
      }

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

// Soft Delete
async function deleteSession(id) {
  if (activeStreamAbortController) {
    activeStreamAbortController.abort();
    activeStreamAbortController = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  sessions = sessions.filter(s => s.id !== id);
  
  if (supabaseClient) {
    try {
      await supabaseClient
        .from('chats')
        .update({ is_deleted_by_user: true })
        .eq('id', id);
    } catch (err) {}

    try {
      const key = getChatStorageKey();
      if (key) localStorage.setItem(key, JSON.stringify(sessions));
    } catch (e) {}
  }

  if (activeSessionId === id) {
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
  currentChatHistory = [];
  
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

// Instant Dispatch Handler
if (form) {
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const rawTypedText = input ? input.value.trim() : "";
    if (!rawTypedText && !attachedFile) return;

    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) welcomeScreen.remove();

    const userParts = [];
    let promptPayloadText = rawTypedText;

    if (attachedFile) {
      if (attachedFile.category === 'text') {
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
    if (slashMenu) slashMenu.classList.add('hidden');
    updateSendButtonState();

    currentChatHistory.push({ 
      role: 'user', 
      parts: userParts,
      file: fileSnapshot,
      rawUserText: rawTypedText
    });
    
    renderChatBox();
    await triggerApiCall();
  });
}

// High-Throughput Sub-Second Streaming Handler
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
    const userAddressing = userNickname ? `\nUser: ${userNickname}.` : "";
    const langInstruction = appSettings.language && appSettings.language !== 'auto' ? `\nRespond strictly in ${appSettings.language}.` : "";

    const liveClockInstruction = `\n[Reference Time: UTC ${currentDateUTC} | Local ${currentDateLocal} (${userTimeZone})]`;

    const dynamicSystemInstruction = `${basePrompt}${userAddressing}${langInstruction}${liveClockInstruction}`;

    // Has any attachment in current chat to bypass external web search for speed
    const hasAnyAttachment = currentChatHistory.some(m => !!m.file);

    // Limit payload history to the most recent 4 turns to avoid re-tokenizing large PDFs
    const payloadHistory = currentChatHistory.slice(-4).map(m => ({ role: m.role, parts: m.parts }));

    const requestBody = {
      systemInstruction: { parts: [{ text: dynamicSystemInstruction }] },
      contents: payloadHistory,
      hasAttachment: hasAnyAttachment
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
    responseContent.classList.remove('animate-pulse');
    responseContent.innerHTML = "";

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
            const textChunk = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textChunk) {
              fullText += textChunk;
              responseContent.innerHTML = parseMarkdownSafely(fullText);
            }
          } catch (e) {}
        }
      }
    }

    renderMath(responseContent);
    enhanceMarkdownOutput(botDiv);
    if (window.hljs) hljs.highlightAll();

    // Push bot message and save without executing double-render
    currentChatHistory.push({ role: 'model', parts: [{ text: fullText }] });
    
    try {
      await saveCurrentSession();
    } catch (saveErr) {}

    // Attach interaction actions to completed message cleanly
    const footerDiv = document.createElement('div');
    footerDiv.className = "flex items-center gap-4 mt-3 text-slate-400 text-sm flex-wrap";
    
    const pinBtn = document.createElement('button');
    pinBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
    pinBtn.title = "Pin to Notes Vault";
    pinBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
    pinBtn.onclick = () => pinMessageDirect(encodeURIComponent(fullText));

    const copyBtn = document.createElement('button');
    copyBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
    copyBtn.title = "Copy";
    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(fullText);
      showXamoToast("Copied to clipboard!");
    };

    const speakBtn = document.createElement('button');
    speakBtn.className = "hover:text-blue-400 transition-colors focus:outline-none";
    speakBtn.title = "Read Aloud";
    speakBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    speakBtn.onclick = () => toggleSpeech(fullText, speakBtn);

    footerDiv.appendChild(pinBtn);
    footerDiv.appendChild(copyBtn);
    footerDiv.appendChild(speakBtn);
    botDiv.appendChild(footerDiv);
    
  } catch (err) {
    if (err.name === 'AbortError') return; // Clean exit if message was edited
    responseContent.classList.remove('animate-pulse');
    responseContent.innerHTML = `<span class="text-red-400">System Error: ${err.message}</span>`;
  } finally {
    activeStreamAbortController = null;
  }
}

// App Bootstrap
initVoices();
initAuth();
handleUrlAuthFlags();