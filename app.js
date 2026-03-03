// ================================================================
// OpenWebUI Mock — Chat Engine
// ================================================================

let SCRIPT = [];
let CONFIG = {};
let scriptIndex = 0;
let isStreaming = false;
let autoPlayActive = false;

const chatMessages = document.getElementById('chatMessages');
const inputField = document.getElementById('inputField');
const sendBtn = document.getElementById('sendBtn');
const sendIcon = document.getElementById('sendIcon');
const landing = document.getElementById('landing');
const sidebar = document.getElementById('sidebar');
const slashPopup = document.getElementById('slashPopup');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const uploadPreview = document.getElementById('uploadPreview');
let pendingImageUrl = null;

// ── Load script from JSON ──
async function loadScript() {
  try {
    const res = await fetch('script.json');
    const data = await res.json();
    CONFIG = data.config;
    SCRIPT = data.conversation;
    applyConfig();
    startAutoPlay();
  } catch (err) {
    console.error('Failed to load script.json:', err);
  }
}

function applyConfig() {
  // Bot name in navbar
  const modelName = document.getElementById('modelName');
  if (modelName) modelName.textContent = CONFIG.botName;

  // Bot avatar in navbar model selector
  const navModelIcon = document.getElementById('navModelIcon');
  if (navModelIcon && CONFIG.botAvatar) {
    navModelIcon.innerHTML = `<img src="${CONFIG.botAvatar}" alt="${CONFIG.botName}">`;
  }

  // Bot avatar in sidebar
  const sidebarBot = document.getElementById('sidebarBotAvatar');
  if (sidebarBot && CONFIG.botAvatar) {
    sidebarBot.innerHTML = `<img src="${CONFIG.botAvatar}" alt="${CONFIG.botName}">`;
  }

  // Landing page
  const landingIcon = document.getElementById('landingIcon');
  if (landingIcon && CONFIG.botAvatar) {
    landingIcon.innerHTML = `<img src="${CONFIG.botAvatar}" alt="${CONFIG.botName}">`;
  }
  const landingModel = document.getElementById('landingModelName');
  if (landingModel) landingModel.textContent = CONFIG.botName;

  // User info in sidebar
  const sidebarUser = document.getElementById('sidebarUserAvatar');
  if (sidebarUser) sidebarUser.textContent = CONFIG.userInitial;

  // User info in navbar
  const navUser = document.getElementById('navUserAvatar');
  if (navUser) navUser.textContent = CONFIG.userInitial;
}

// ── Sidebar toggle ──
document.getElementById('sidebarToggleBtn').addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

// ── File upload ──
uploadBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    pendingImageUrl = ev.target.result;
    showUploadPreview(pendingImageUrl, file.name);
  };
  reader.readAsDataURL(file);
  fileInput.value = '';
});

function showUploadPreview(src, name) {
  uploadPreview.innerHTML = `
    <div class="upload-thumb">
      <img src="${src}" alt="${name}">
      <button class="upload-thumb-remove" title="Remove">&times;</button>
    </div>`;
  uploadPreview.style.display = 'flex';
  uploadPreview.querySelector('.upload-thumb-remove').addEventListener('click', () => {
    clearUploadPreview();
  });
  // Enable send button since we have content
  sendBtn.disabled = false;
  sendBtn.classList.add('visible');
  const callBtn = document.querySelector('.toolbar-btn-call');
  if (callBtn) callBtn.style.display = 'none';
}

function clearUploadPreview() {
  pendingImageUrl = null;
  uploadPreview.innerHTML = '';
  uploadPreview.style.display = 'none';
  // Re-check send button state
  const hasText = inputField.value.trim() !== '';
  sendBtn.disabled = !hasText || isStreaming;
  if (!hasText) {
    sendBtn.classList.remove('visible');
    const callBtn = document.querySelector('.toolbar-btn-call');
    if (callBtn) callBtn.style.display = '';
  }
}

// ── Slash Command Popup ──
function showSlashPopup() {
  const commands = CONFIG.slashCommands || [
    { command: 'open_studio_v2', label: 'Open Studio V2', description: 'Open the image editor' }
  ];

  slashPopup.innerHTML = '';
  commands.forEach(cmd => {
    const item = document.createElement('div');
    item.className = 'slash-cmd-item';
    item.innerHTML = `
      <div class="slash-cmd-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
      </div>
      <div class="slash-cmd-info">
        <span class="slash-cmd-name">/${cmd.command}</span>
        <span class="slash-cmd-desc">${cmd.description}</span>
      </div>`;
    item.addEventListener('click', () => {
      hideSlashPopup();
      inputField.value = '';
      inputField.style.height = 'auto';
      inputField.dispatchEvent(new Event('input'));
      // Open studio directly (Option 1)
      openStudio(CONFIG.studioUrl);
    });
    slashPopup.appendChild(item);
  });
  slashPopup.classList.add('visible');
}

function hideSlashPopup() {
  slashPopup.classList.remove('visible');
}

// Close popup on click outside or Escape
document.addEventListener('click', (e) => {
  if (!slashPopup.contains(e.target) && e.target !== inputField) {
    hideSlashPopup();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideSlashPopup();
});

// ── Input handling ──
inputField.addEventListener('input', () => {
  inputField.style.height = 'auto';
  inputField.style.height = Math.min(inputField.scrollHeight, 200) + 'px';
  const hasText = inputField.value.trim() !== '';
  sendBtn.disabled = !hasText || isStreaming;
  if (hasText) {
    sendBtn.classList.add('visible');
    const callBtn = document.querySelector('.toolbar-btn-call');
    if (callBtn) callBtn.style.display = 'none';
  } else {
    sendBtn.classList.remove('visible');
    const callBtn = document.querySelector('.toolbar-btn-call');
    if (callBtn) callBtn.style.display = '';
  }

  // Slash command detection
  const val = inputField.value;
  if (val === '/' || val === '/ ') {
    showSlashPopup();
  } else if (!val.startsWith('/')) {
    hideSlashPopup();
  }
});

// Backup: also detect slash on keyup for browsers that delay input events
inputField.addEventListener('keyup', () => {
  const val = inputField.value;
  if (val === '/' || val === '/ ') {
    showSlashPopup();
  }
});

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
  if (!userText && !pendingImageUrl) return;

  hideSlashPopup();

  if (landing) landing.style.display = 'none';
  inputField.placeholder = 'Send a Message';

  addUserMessage(userText, pendingImageUrl);
  clearUploadPreview();

  inputField.value = '';
  inputField.style.height = 'auto';
  sendBtn.disabled = true;
  sendBtn.classList.remove('visible');
  const callBtn = document.querySelector('.toolbar-btn-call');
  if (callBtn) callBtn.style.display = '';

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

// ── User message ──
function addUserMessage(text, imageUrl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message user';

  const avatar = document.createElement('div');
  avatar.className = 'message-user-avatar';
  avatar.textContent = CONFIG.userInitial || 'U';

  const body = document.createElement('div');
  body.style.cssText = 'flex:1; min-width:0;';

  const label = document.createElement('div');
  label.className = 'message-user-label';
  label.textContent = 'You';

  // Attached image (shown above text, like real OpenWebUI)
  if (imageUrl) {
    const imgWrap = document.createElement('div');
    imgWrap.className = 'user-message-image';
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = 'Uploaded image';
    imgWrap.appendChild(img);
    body.appendChild(label);
    body.appendChild(imgWrap);
  } else {
    body.appendChild(label);
  }

  if (text) {
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;
    body.appendChild(content);
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(body);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
}

// ── Bot response ──
function streamBotResponse(entry) {
  isStreaming = true;
  updateSendButton();

  const wrapper = document.createElement('div');
  wrapper.className = 'message bot';

  const contentOuter = document.createElement('div');
  contentOuter.style.cssText = 'width:100%;';

  // Bot header with avatar + name
  const header = document.createElement('div');
  header.className = 'bot-header';

  const avatar = document.createElement('div');
  avatar.className = 'bot-avatar';
  if (CONFIG.botAvatar) {
    avatar.innerHTML = `<img src="${CONFIG.botAvatar}" alt="${CONFIG.botName}">`;
  }

  const nameLabel = document.createElement('span');
  nameLabel.className = 'bot-name-label';
  nameLabel.textContent = CONFIG.botName || 'Graphic Creation Bot';

  header.appendChild(avatar);
  header.appendChild(nameLabel);
  contentOuter.appendChild(header);

  wrapper.appendChild(contentOuter);
  chatMessages.appendChild(wrapper);
  scrollToBottom();

  // Branch: studio-type response
  if (entry.type === 'studio') {
    renderStudioResponse(entry, contentOuter);
    return;
  }

  // Normal response: thinking indicator
  if (entry.thinkTime) {
    const thinkingEl = createThinkingEl();
    contentOuter.appendChild(thinkingEl);
    scrollToBottom();

    const thinkDuration = Math.min(entry.thinkTime * 200, 3000);
    setTimeout(() => {
      thinkingEl.remove();
      contentOuter.appendChild(createThoughtDoneEl(entry.thinkTime));
      startStreaming(entry, contentOuter);
    }, thinkDuration);
    return;
  }

  startStreaming(entry, contentOuter);
}

// ── Studio response ──
function renderStudioResponse(entry, contentOuter) {
  const thinkDuration1 = Math.min((entry.thinkTime || 1) * 200, 3000);
  const thinkDuration2 = Math.min((entry.thinkTime2 || 1) * 200, 3000);

  // Phase 1: First thinking
  const thinking1 = createThinkingEl();
  contentOuter.appendChild(thinking1);
  scrollToBottom();

  setTimeout(() => {
    thinking1.remove();

    // "Thought for X seconds"
    contentOuter.appendChild(createThoughtDoneEl(entry.thinkTime || 1));

    // "View Result from Open Studio V2"
    const viewResult = document.createElement('div');
    viewResult.className = 'view-result';
    viewResult.innerHTML = `View Result from <strong>Open Studio V2</strong> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
    contentOuter.appendChild(viewResult);
    scrollToBottom();

    // Phase 2: Second thinking
    const thinking2 = createThinkingEl();
    contentOuter.appendChild(thinking2);
    scrollToBottom();

    setTimeout(() => {
      thinking2.remove();

      // "Thought for X seconds"
      contentOuter.appendChild(createThoughtDoneEl(entry.thinkTime2 || 1));

      // "Image Studio" button
      const studioBtn = document.createElement('button');
      studioBtn.className = 'studio-btn';
      studioBtn.textContent = 'Image Studio';
      studioBtn.addEventListener('click', () => {
        openStudio(entry.studioUrl);
      });
      contentOuter.appendChild(studioBtn);

      // Action buttons
      appendActionButtons(contentOuter);

      isStreaming = false;
      updateSendButton();
      scrollToBottom();
      onStreamingDone(entry);
    }, thinkDuration2);
  }, thinkDuration1);
}

// ── Studio Lightbox ──
function openStudio(url) {
  const lightbox = document.getElementById('studioLightbox');
  const iframe = document.getElementById('studioIframe');
  iframe.src = url;
  lightbox.style.display = 'flex';
  lightbox.classList.add('open');
}

function closeStudio() {
  const lightbox = document.getElementById('studioLightbox');
  const iframe = document.getElementById('studioIframe');
  lightbox.classList.remove('open');
  lightbox.style.display = 'none';
  iframe.removeAttribute('src');

  // Resume auto-play after studio closes
  if (CONFIG.autoPlay && autoPlayActive) {
    setTimeout(() => advanceAutoPlay(), 1500);
  }
}

document.getElementById('studioCloseBtn').addEventListener('click', closeStudio);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeStudio();
});

// ── Streaming ──
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

      appendActionButtons(contentOuter);

      isStreaming = false;
      updateSendButton();
      scrollToBottom();
      onStreamingDone(entry);
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

// ── Shared UI helpers ──
function createThinkingEl() {
  const el = document.createElement('div');
  el.className = 'thinking-indicator';
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83"/></svg> <span>Thinking...</span>`;
  return el;
}

function createThoughtDoneEl(seconds) {
  const el = document.createElement('div');
  el.className = 'thinking-done';
  el.innerHTML = `Thought for ${seconds} second${seconds > 1 ? 's' : ''} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
  return el;
}

function appendActionButtons(container) {
  const actions = document.createElement('div');
  actions.className = 'bot-actions visible';
  actions.innerHTML = `
    <button title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
    <button title="Copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
    <button title="Read aloud"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg></button>
    <button title="Good response"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg></button>
    <button title="Bad response"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15V19a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg></button>
    <button title="Continue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg></button>
    <button title="Regenerate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg></button>
  `;
  container.appendChild(actions);
}

// ── Other helpers ──
function updateSendButton() {
  if (isStreaming) {
    sendBtn.disabled = false;
    sendBtn.classList.add('stop-btn');
    sendIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor"/>';
  } else {
    sendBtn.classList.remove('stop-btn');
    sendIcon.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>';
    sendBtn.disabled = inputField.value.trim() === '';
    if (!inputField.value.trim()) {
      sendBtn.classList.remove('visible');
      const callBtn = document.querySelector('.toolbar-btn-call');
      if (callBtn) callBtn.style.display = '';
    }
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

// ── Auto-play engine ──
function startAutoPlay() {
  if (!CONFIG.autoPlay) return;
  autoPlayActive = true;
  const startDelay = CONFIG.startDelay || 3000;
  setTimeout(() => advanceAutoPlay(), startDelay);
}

function advanceAutoPlay() {
  if (!autoPlayActive || scriptIndex >= SCRIPT.length) return;

  const entry = SCRIPT[scriptIndex];

  if ('userMessage' in entry) {
    if (entry.userMessage === null) {
      // Wait for manual user input — auto-play resumes via onStreamingDone
      return;
    }
    // Auto-type user message then send
    const preDelay = entry.preDelay || 1500;
    setTimeout(() => {
      autoTypeMessage(entry.userMessage, () => {
        setTimeout(() => sendMessage(), 600);
      });
    }, preDelay);
  } else {
    // Continuation — no user message, immediately trigger bot response
    const currentEntry = entry;
    scriptIndex++;
    setTimeout(() => streamBotResponse(currentEntry), 1000);
  }
}

function onStreamingDone(entry) {
  if (!CONFIG.autoPlay || !autoPlayActive) return;

  // After a bot response with openStudio, auto-type "/" and open studio
  if (entry && entry.openStudio) {
    // Use per-entry studioUrl if provided, otherwise fall back to config
    const studioUrlOverride = entry.studioUrl || null;
    setTimeout(() => {
      inputField.value = '/';
      inputField.dispatchEvent(new Event('input'));
      // Popup appears, click it after a beat
      setTimeout(() => {
        if (studioUrlOverride) {
          // Open directly with override URL instead of clicking popup
          hideSlashPopup();
          inputField.value = '';
          inputField.dispatchEvent(new Event('input'));
          openStudio(studioUrlOverride);
        } else {
          const item = slashPopup.querySelector('.slash-cmd-item');
          if (item) item.click();
        }
      }, 1000);
    }, 2000);
    return;
  }

  // Otherwise advance to next entry
  advanceAutoPlay();
}

function autoTypeMessage(text, callback) {
  const baseSpeed = CONFIG.typeSpeed || 75;

  // Parse typo markers: ~wrong~correct~
  const segments = [];
  let remaining = text;
  while (remaining.length > 0) {
    const idx = remaining.indexOf('~');
    if (idx === -1) {
      segments.push({ type: 'normal', text: remaining });
      break;
    }
    if (idx > 0) {
      segments.push({ type: 'normal', text: remaining.substring(0, idx) });
    }
    remaining = remaining.substring(idx + 1);
    const wrongEnd = remaining.indexOf('~');
    const wrong = remaining.substring(0, wrongEnd);
    remaining = remaining.substring(wrongEnd + 1);
    const correctEnd = remaining.indexOf('~');
    const correct = remaining.substring(0, correctEnd);
    remaining = remaining.substring(correctEnd + 1);
    segments.push({ type: 'typo', wrong, correct });
  }

  let currentText = '';
  inputField.value = '';
  inputField.dispatchEvent(new Event('input'));
  let segIndex = 0;

  function processNextSegment() {
    if (segIndex >= segments.length) {
      if (callback) callback();
      return;
    }
    const seg = segments[segIndex];
    segIndex++;

    if (seg.type === 'normal') {
      typeChars(seg.text, processNextSegment);
    } else {
      // Type wrong text, pause, backspace, type correct
      typeChars(seg.wrong, () => {
        setTimeout(() => {
          backspaceChars(seg.wrong.length, () => {
            typeChars(seg.correct, processNextSegment);
          });
        }, 500);
      });
    }
  }

  function typeChars(chars, done) {
    let i = 0;
    function next() {
      if (i >= chars.length) { done(); return; }
      currentText += chars[i];
      inputField.value = currentText;
      inputField.dispatchEvent(new Event('input'));
      const ch = chars[i];
      i++;
      let delay = baseSpeed + Math.floor(Math.random() * 40) - 20;
      if ('.!?,;:'.includes(ch)) delay += 120;
      if (ch === ' ') delay += 30;
      setTimeout(next, delay);
    }
    next();
  }

  function backspaceChars(count, done) {
    let left = count;
    function next() {
      if (left <= 0) { done(); return; }
      currentText = currentText.substring(0, currentText.length - 1);
      inputField.value = currentText;
      inputField.dispatchEvent(new Event('input'));
      left--;
      setTimeout(next, 55);
    }
    next();
  }

  processNextSegment();
}

// ── Init ──
loadScript();
