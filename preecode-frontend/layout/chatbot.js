/* chatbot.js – AI Learning Mentor */
(function () {
  if (!localStorage.getItem('token')) return;

  var conversationContext = [];

  // ── Floating Action Button ──
  var fab = document.createElement('button');
  fab.className = 'ai-chat-fab';
  fab.setAttribute('aria-label', 'Open AI Mentor');
  fab.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' +
    '<span class="ai-fab-ripple"></span>';

  // ── Backdrop Overlay ──
  var backdrop = document.createElement('div');
  backdrop.className = 'ai-chat-backdrop';

  // ── Chat Panel ──
  var panel = document.createElement('div');
  panel.className = 'ai-chat-panel';
  panel.innerHTML =
    // Header
    '<div class="ai-chat-header">' +
      '<div class="ai-chat-header-left">' +
        '<div class="ai-header-avatar">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' +
        '</div>' +
        '<div class="ai-header-info">' +
          '<span class="ai-header-title">Preecode <span class="ai-header-accent">AI</span></span>' +
          '<span class="ai-status-indicator"><span class="ai-status-dot"></span>Online</span>' +
        '</div>' +
      '</div>' +
      '<div class="ai-chat-header-actions">' +
        '<button id="aiChatClose" class="ai-header-btn" aria-label="Close chat">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>' +

    // Messages
    '<div class="ai-chat-messages" id="aiChatMessages">' +
      '<div class="ai-msg-wrapper bot">' +
        '<div class="ai-msg-avatar">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' +
        '</div>' +
        '<div class="ai-msg-content">' +
          '<div class="ai-msg bot">Hey \u{1F44B} I\'m your AI learning mentor.\nAsk me coding doubts, DSA questions, or planning help.\nI can also calculate your learning timeline based on your pace.</div>' +
          '<span class="ai-msg-time">Just now</span>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // Suggestion chips
    '<div class="ai-prompt-chips" id="aiPromptChips">' +
      '<button class="ai-chip" data-prompt="When will I finish DSA?">\u{1F4C5} When will I finish DSA?</button>' +
      '<button class="ai-chip" data-prompt="Explain stacks simply">\u{1F4DA} Explain stacks simply</button>' +
      '<button class="ai-chip" data-prompt="Give me a practice problem">\u{1F9E0} Give me a practice problem</button>' +
      '<button class="ai-chip" data-prompt="Plan my week">\u{1F4C8} Plan my week</button>' +
    '</div>' +

    // Trust text + Input
    '<div class="ai-chat-footer">' +
      '<span class="ai-trust-text">\u{1F512} Your conversations are private.</span>' +
      '<div class="ai-chat-input-row">' +
        '<input type="text" id="aiChatInput" placeholder="Ask anything about coding, DSA, or your goals\u2026" autocomplete="off" />' +
        '<button id="aiChatSend" aria-label="Send message">' +
          '<span class="ai-send-label"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></span>' +
          '<span class="ai-send-spinner" style="display:none"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle></svg></span>' +
        '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(fab);
  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  // ── Helpers ──
  function formatTime() {
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function scrollToBottom(el) {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }

  // Streaming text effect
  function streamText(el, text, cb) {
    var i = 0;
    var speed = 12;
    var messages = document.getElementById('aiChatMessages');
    function type() {
      if (i < text.length) {
        var chunk = text.slice(i, i + 2);
        el.textContent += chunk;
        i += 2;
        scrollToBottom(messages);
        requestAnimationFrame(function () {
          setTimeout(type, speed);
        });
      } else {
        if (cb) cb();
      }
    }
    type();
  }

  // ── Close panel (fully hide with animation) ──
  function closePanel() {
    panel.classList.add('closing');
    panel.classList.remove('open');
    setTimeout(function () {
      panel.classList.remove('closing');
    }, 250);
  }

  // ── FAB click ──
  fab.addEventListener('click', function () {
    var ripple = fab.querySelector('.ai-fab-ripple');
    ripple.classList.remove('active');
    void ripple.offsetWidth;
    ripple.classList.add('active');

    if (panel.classList.contains('open')) {
      closePanel();
    } else {
      panel.classList.add('open');
      document.getElementById('aiChatInput').focus();
      scrollToBottom(document.getElementById('aiChatMessages'));
    }
  });

  // ── Close button ──
  document.getElementById('aiChatClose').addEventListener('click', function (e) {
    e.stopPropagation();
    closePanel();
  });

  // ── Click outside to close ──
  document.addEventListener('click', function (e) {
    if (!panel.classList.contains('open')) return;
    if (panel.contains(e.target) || fab.contains(e.target)) return;
    closePanel();
  });

  // ── ESC key ──
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      closePanel();
    }
  });

  // ── Suggestion chips ──
  document.querySelectorAll('.ai-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var input = document.getElementById('aiChatInput');
      input.value = chip.getAttribute('data-prompt');
      input.focus();
    });
  });

  // ── Copy to clipboard ──
  function addCopyButton(msgEl) {
    var copyBtn = document.createElement('button');
    copyBtn.className = 'ai-msg-copy';
    copyBtn.title = 'Copy';
    copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(msgEl.textContent).then(function () {
        copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(function () {
          copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
        }, 1500);
      });
    });
    return copyBtn;
  }

  // ── Send message ──
  function sendMessage() {
    var input = document.getElementById('aiChatInput');
    var msg = input.value.trim();
    if (!msg) return;

    var messages = document.getElementById('aiChatMessages');
    var sendBtn = document.getElementById('aiChatSend');
    var sendLabel = sendBtn.querySelector('.ai-send-label');
    var sendSpinner = sendBtn.querySelector('.ai-send-spinner');
    var chips = document.getElementById('aiPromptChips');

    // Hide chips after first message
    if (chips) {
      chips.classList.add('hidden');
    }

    // User message
    var userWrapper = document.createElement('div');
    userWrapper.className = 'ai-msg-wrapper user';
    var userContent = document.createElement('div');
    userContent.className = 'ai-msg-content';
    var userDiv = document.createElement('div');
    userDiv.className = 'ai-msg user';
    userDiv.textContent = msg;
    var userTime = document.createElement('span');
    userTime.className = 'ai-msg-time';
    userTime.textContent = formatTime();
    var userCopy = addCopyButton(userDiv);
    userContent.appendChild(userDiv);
    userContent.appendChild(userCopy);
    userContent.appendChild(userTime);
    userWrapper.appendChild(userContent);
    messages.appendChild(userWrapper);

    input.value = '';
    sendBtn.disabled = true;
    sendLabel.style.display = 'none';
    sendSpinner.style.display = 'inline-flex';
    scrollToBottom(messages);

    // Typing indicator
    var botWrapper = document.createElement('div');
    botWrapper.className = 'ai-msg-wrapper bot';
    var botAvatar = document.createElement('div');
    botAvatar.className = 'ai-msg-avatar';
    botAvatar.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
    var botContent = document.createElement('div');
    botContent.className = 'ai-msg-content';
    var loadDiv = document.createElement('div');
    loadDiv.className = 'ai-msg bot loading';
    loadDiv.innerHTML = '<span class="typing-indicator"><span></span><span></span><span></span></span>';
    botContent.appendChild(loadDiv);
    botWrapper.appendChild(botAvatar);
    botWrapper.appendChild(botContent);
    messages.appendChild(botWrapper);
    scrollToBottom(messages);

    conversationContext.push({ role: 'user', content: msg });

    Api.chatWithAI(msg, { context: conversationContext })
      .then(function (data) {
        loadDiv.classList.remove('loading');
        loadDiv.innerHTML = '';
        var response = data.response || data.hint || data.review || 'Unable to get response';
        conversationContext.push({ role: 'bot', content: response });

        // Stream the text in
        streamText(loadDiv, response, function () {
          var botCopy = addCopyButton(loadDiv);
          var botTime = document.createElement('span');
          botTime.className = 'ai-msg-time';
          botTime.textContent = formatTime();
          botContent.appendChild(botCopy);
          botContent.appendChild(botTime);
        });
      })
      .catch(function (err) {
        loadDiv.classList.remove('loading');
        loadDiv.innerHTML = '';
        loadDiv.textContent = 'Error: ' + (err.message || 'Something went wrong');
        loadDiv.classList.add('error');
      })
      .finally(function () {
        sendBtn.disabled = false;
        sendLabel.style.display = 'inline-flex';
        sendSpinner.style.display = 'none';
        scrollToBottom(messages);
      });
  }

  document.getElementById('aiChatSend').addEventListener('click', sendMessage);
  document.getElementById('aiChatInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
})();
