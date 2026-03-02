// ================================================================
// OpenWebUI Mock — Chat Engine
// ================================================================
// Loads the conversation script from script.json and drives the
// scripted chat interaction with streaming animation.
// ================================================================

let SCRIPT = [];
let CONFIG = {};
let scriptIndex = 0;
let isStreaming = false;

const chatMessages = document.getElementById('chatMessages');
const inputField = document.getElementById('inputField');
const sendBtn = document.getElementById('sendBtn');
const sendIcon = document.getElementById('sendIcon');
const landing = document.getElementById('landing');
const sidebar = document.getElementById('sidebar');

// ── Load script from JSON ──
async function loadScript() {
  try {
    const res = await fetch('script.json');
    const data = await res.json();
    CONFIG = data.config;
    SCRIPT = data.conversation;
    applyConfig();
  } catch (err) {
    console.error('Failed to load script.json:', err);
  }
}

function applyConfig() {
  // Apply bot name
  const modelName = document.getElementById('modelName');
  if (modelName) modelName.textContent = CONFIG.botName;

  const footerText = document.querySelector('.input-footer');
  if (footerText) footerText.textContent = `${CONFIG.botName} can make mistakes. Check important info.`;

  // Apply bot avatar to landing page
  const landingIcon = document.querySelector('.landing-icon');
  if (landingIcon && CONFIG.botAvatar) {
    landingIcon.innerHTML = `<img src="${CONFIG.botAvatar}" alt="${CONFIG.botName}">`;
  }

  // Apply bot avatar to model selector
  const modelIcon = document.querySelector('.model-icon');
  if (modelIcon && CONFIG.botAvatar) {
    modelIcon.innerHTML = `<img src="${CONFIG.botAvatar}" alt="${CONFIG.botName}">`;
  }

  // Apply user name
  const userName = document.querySelector('.user-name');
  if (userName) userName.textContent = CONFIG.userName;

  const userAvatar = document.querySelector('.user-avatar');
  if (userAvatar) userAvatar.textContent = CONFIG.userInitial;

  // Apply landing greeting
  const greeting = document.querySelector('.landing-greeting');
  if (greeting) greeting.textContent = `Hello, ${CONFIG.userName}`;

  const landingModel = document.querySelector('.landing-model');
  if (landingModel) landingModel.textContent = CONFIG.botName;
}

// ── Sidebar toggle ──
function toggleSidebar() {
  sidebar.classList.toggle('collapsed');
}

// Wire up sidebar toggle buttons
document.getElementById('sidebarCloseBtn').addEventListener('click', toggleSidebar);
document.getElementById('sidebarOpenBtn').addEventListener('click', toggleSidebar);

// ── Auto-resize textarea ──
inputField.addEventListener('input', () => {
  inputField.style.height = 'auto';
  inputField.style.height = Math.min(inputField.scrollHeight, 200) + 'px';
  sendBtn.disabled = inputField.value.trim() === '' || isStreaming;
});

// ── Send on Enter (Shift+Enter for newline) ──
inputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener('click', () => {
  if (!sendBtn.disabled) sendMessage();
});

// ── Send message ──
function sendMessage() {
  if (isStreaming) return;

  const userText = inputField.value.trim();
  if (!userText) return;

  // Hide landing page
  if (landing) landing.style.display = 'none';

  // Add user message
  addUserMessage(userText);

  // Clear input
  inputField.value = '';
  inputField.style.height = 'auto';
  sendBtn.disabled = true;

  // Get next scripted response
  if (scriptIndex < SCRIPT.length) {
    const entry = SCRIPT[scriptIndex];
    scriptIndex++;
    const delay = entry.delay || 800;
    setTimeout(() => streamBotResponse(entry), delay);
  } else {
    setTimeout(() => {
      streamBotResponse({
        botResponse: "That's all for this demo! Feel free to refresh the page to start over.",
        images: []
      });
    }, 800);
  }
}

// ── Add user message bubble ──
function addUserMessage(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message user';
  wrapper.innerHTML = `<div class="message-content">${escapeHtml(text)}</div>`;
  chatMessages.appendChild(wrapper);
  scrollToBottom();
}

// ── Stream bot response ──
function streamBotResponse(entry) {
  isStreaming = true;
  updateSendButton();

  const wrapper = document.createElement('div');
  wrapper.className = 'message bot';

  const avatar = document.createElement('div');
  avatar.className = 'bot-avatar';
  if (CONFIG.botAvatar) {
    avatar.innerHTML = `<img src="${CONFIG.botAvatar}" alt="${CONFIG.botName}">`;
  } else {
    avatar.textContent = CONFIG.botName ? CONFIG.botName[0] : 'B';
  }

  const contentOuter = document.createElement('div');
  contentOuter.style.cssText = 'flex:1; min-width:0;';

  // Show thinking indicator if thinkTime is set
  if (entry.thinkTime) {
    const thinkingEl = document.createElement('div');
    thinkingEl.className = 'thinking-indicator';
    thinkingEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83"/></svg> <span>Thinking...</span>`;
    contentOuter.appendChild(thinkingEl);
    wrapper.appendChild(avatar);
    wrapper.appendChild(contentOuter);
    chatMessages.appendChild(wrapper);
    scrollToBottom();

    const thinkDuration = Math.min(entry.thinkTime * 200, 3000);
    setTimeout(() => {
      thinkingEl.remove();
      const thoughtDone = document.createElement('div');
      thoughtDone.className = 'thinking-done';
      thoughtDone.textContent = `Thought for ${entry.thinkTime} second${entry.thinkTime > 1 ? 's' : ''}`;
      contentOuter.appendChild(thoughtDone);
      startStreaming(entry, contentOuter);
    }, thinkDuration);
    return;
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(contentOuter);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
  startStreaming(entry, contentOuter);
}

// ── Start word-by-word streaming ──
function startStreaming(entry, contentOuter) {
  const content = document.createElement('div');
  content.className = 'message-content';

  const cursor = document.createElement('span');
  cursor.className = 'streaming-cursor';

  content.appendChild(cursor);
  contentOuter.appendChild(content);
  scrollToBottom();

  const processedText = processMarkdown(entry.botResponse);
  const wordDelay = entry.wordDelay || 40;

  const words = processedText.split(/(\s+)/);
  let wordIndex = 0;
  let currentHtml = '';

  function streamNext() {
    if (wordIndex >= words.length) {
      cursor.remove();

      // Show images if any
      if (entry.images && entry.images.length > 0) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'message-images';
        entry.images.forEach(src => {
          const img = document.createElement('img');
          img.src = src;
          img.alt = 'Generated graphic';
          img.onerror = function() {
            this.style.display = 'none';
            const placeholder = document.createElement('div');
            placeholder.style.cssText = 'width:400px;height:400px;background:var(--gray-850);border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--gray-500);font-size:14px;border:1px dashed var(--gray-700);text-align:center;';
            placeholder.innerHTML = 'Image placeholder<br><small style="opacity:0.6">(' + escapeHtml(src) + ')</small>';
            imgContainer.appendChild(placeholder);
          };
          imgContainer.appendChild(img);
        });
        contentOuter.appendChild(imgContainer);
      }

      // Show action buttons
      const actions = document.createElement('div');
      actions.className = 'bot-actions visible';
      actions.innerHTML = `
        <button title="Copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
        <button title="Good response"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg></button>
        <button title="Bad response"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15V19a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg></button>
        <button title="Regenerate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg></button>
      `;
      contentOuter.appendChild(actions);

      isStreaming = false;
      updateSendButton();
      scrollToBottom();
      return;
    }

    currentHtml += words[wordIndex];
    content.innerHTML = currentHtml;
    content.appendChild(cursor);
    wordIndex++;
    scrollToBottom();

    const nextDelay = words[wordIndex - 1].trim() === '' ? 5 : wordDelay;
    setTimeout(streamNext, nextDelay);
  }

  streamNext();
}

// ── Helpers ──
function updateSendButton() {
  if (isStreaming) {
    sendBtn.disabled = false;
    sendBtn.classList.add('stop-btn');
    sendIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor"/>';
  } else {
    sendBtn.classList.remove('stop-btn');
    sendIcon.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>';
    sendBtn.disabled = inputField.value.trim() === '';
  }
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function processMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
    .replace(/^- (.+)/gm, '&bull; $1');
}

// ── Init ──
loadScript();
