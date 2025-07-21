console.log("Uxento AI Sniper v20: Text-Fix Edition");

// ---------- Helper ----------
function simulateTyping(inputElement, text) {
  if (!inputElement) return;
  inputElement.focus();
  inputElement.value = text;
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  inputElement.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------- Data extractor ----------
function extractTweetData(tweetElement) {
  const data = {
    mainText: '',
    quotedText: '',
    author: '',
    twitterUrl: '',
    mainImageUrl: null,
    profileImageUrl: null,
    isContentTweet: true
  };

  // Skip follow-suggestions
  if (tweetElement.querySelector('svg.lucide-user-plus, svg.lucide-user-minus')) {
    data.isContentTweet = false;
    return data;
  }

  // Tweet URL
  const viewLink = tweetElement.querySelector('a[href*="/status/"]');
  if (viewLink) data.twitterUrl = viewLink.href;

  // Author + avatar
  const authorHeader = tweetElement.querySelector('div[class*="flex items-center gap-3 p-4"]');
  if (authorHeader) {
    const authorLink = authorHeader.querySelector('a[href^="https://x.com/"]');
    if (authorLink) data.author = authorLink.href.split('/').pop().toLowerCase();
    const avatar = authorHeader.querySelector('img');
    if (avatar) data.profileImageUrl = avatar.src.replace('_normal', '_400x400');
  }

  // Main tweet text
  const mainTextEl = tweetElement.querySelector('div[class*="px-4 pb-4 text-sm leading-relaxed"]');
  if (mainTextEl) data.mainText = mainTextEl.innerText.trim();

  // Quoted tweet text (reply tweets)
  const quotedBox = tweetElement.querySelector('div[class*="mx-4 mb-4 p-3 rounded-md"]');
  if (quotedBox) {
    const quotedTextEl = quotedBox.querySelector('div[class*="text-xs leading-relaxed"]');
    if (quotedTextEl) data.quotedText = quotedTextEl.innerText.trim();
  }

  // Image
  let img = tweetElement.querySelector('img.cursor-zoom-in');
  if (!img) {
    const photoA = tweetElement.querySelector('a[href*="/photo/"]');
    if (photoA) img = photoA.querySelector('img');
  }
  if (img) data.mainImageUrl = img.src;

  // Video poster fallback
  if (!data.mainImageUrl) {
    const videoEl = tweetElement.querySelector('video');
    if (videoEl && videoEl.poster) data.mainImageUrl = videoEl.poster;
  }

  return data;
}

// ---------- Template ----------
function getCreationFormTemplate(cardId) {
  return `
    <div style="display:flex;flex-direction:column;gap:12px;width:100%;height:100%;padding:16px;box-sizing:border-box;background:#15151f;border-left:1px solid #2A2A33;">
      <button id="insta-snipe-${cardId}" style="padding:10px 12px;border:none;background:#2563eb;color:#fff;border-radius:4px;cursor:pointer;font-weight:600;font-size:14px;text-align:center;width:100%;">Quick Buy Top Suggestion</button>

      <div><label style="font-size:12px;color:#a1a1aa">Name</label>
        <input id="name-${cardId}" class="ai-input-name" placeholder="Waiting for AI..." style="width:100%;background:#27272a;border:1px solid #52525b;border-radius:4px;color:#f4f4f5;padding:8px;font-size:14px;">
      </div>

      <div><label style="font-size:12px;color:#a1a1aa">Ticker</label>
        <input id="ticker-${cardId}" class="ai-input-ticker" placeholder="..." style="width:100%;background:#27272a;border:1px solid #52525b;border-radius:4px;color:#f4f4f5;padding:8px;font-size:14px;">
      </div>

      <div style="flex-grow:1">
        <label style="font-size:12px;color:#a1a1aa">AI Suggestions (Click to Insta-Create)</label>
        <ul id="suggestions-${cardId}" class="ai-suggestions-list" style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;max-height:500px;overflow-y:auto;">
          <li style="color:#a1a1aa;text-align:center;font-size:13px">✨ Consulting the Oracle...</li>
        </ul>
      </div>

      <div><label style="font-size:12px;color:#a1a1aa">Buy Amount (SOL)</label>
        <input id="amount-${cardId}" class="ai-input-amount" value="1" style="width:100%;background:#27272a;border:1px solid #52525b;border-radius:4px;color:#f4f4f5;padding:8px;font-size:14px;">
      </div>

      <button id="create-${cardId}" class="ai-final-create-button" disabled style="padding:10px 12px;border:none;background:#3f3f46;color:#a1a1aa;border-radius:4px;cursor:not-allowed;font-weight:600;font-size:14px;text-align:center;width:100%;margin-top:auto;">Create Manually</button>
    </div>
  `;
}

// ---------- Anti-spam guard ----------
const cardFireState = {};

// ---------- Direct API call ----------
async function handleDirectAPICreate(cardId, payload) {
  if (cardFireState[cardId]) return;
  cardFireState[cardId] = true;

  const instaBtn = document.getElementById(`insta-snipe-${cardId}`);
  const createBtn = document.getElementById(`create-${cardId}`);

  [instaBtn, createBtn].forEach(b => {
    if (b) {
      b.disabled = true;
      b.innerText = 'DEPLOYING...';
    }
  });

  try {
    const name = document.getElementById(`name-${cardId}`).value;
    const ticker = document.getElementById(`ticker-${cardId}`).value;
    const amount = parseFloat(document.getElementById(`amount-${cardId}`).value);

    const body = { name, symbol: ticker, twitter: payload.twitterUrl, image: payload.mainImageUrl, amount, astralTip: 0.002 };
    const res = await fetch('https://eu-dev.uxento.io/api/v1/create/bonk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include'
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    console.log('SUCCESS', json);
    if (instaBtn) { instaBtn.innerText = 'SNIPE SUCCESSFUL!'; instaBtn.style.backgroundColor = '#16a34a'; }
    if (createBtn) { createBtn.innerText = 'SNIPE SUCCESSFUL!'; createBtn.style.backgroundColor = '#16a34a'; }
  } catch (e) {
    console.error(e);
    if (instaBtn) { instaBtn.innerText = 'API FAILED'; instaBtn.style.backgroundColor = '#ef4444'; }
    if (createBtn) { createBtn.innerText = 'API FAILED'; createBtn.style.backgroundColor = '#ef4444'; }
  }
}

// ---------- Core processing ----------
async function processTweetCard(tweetElement) {
  if (tweetElement.dataset.aiFormInjected === 'true') return;
  const articleEl = tweetElement.querySelector('article');
  if (!articleEl) return;

  const fullTweetData = extractTweetData(tweetElement);
  if (!fullTweetData.isContentTweet) {
    tweetElement.dataset.aiFormInjected = 'true';
    return;
  }

  tweetElement.dataset.aiFormInjected = 'true';
  const cardId = Date.now() + Math.random().toString(36).slice(2, 9);
  cardFireState[cardId] = false;

  // Hide original Create button
  const origBtn = tweetElement.querySelector('button.bg-blue-600\\/80');
  if (origBtn) origBtn.style.display = 'none';

  // Build payload
  const tweetDataForAPI = { ...fullTweetData };
  if (!tweetDataForAPI.mainImageUrl && tweetDataForAPI.profileImageUrl) {
    tweetDataForAPI.mainImageUrl = tweetDataForAPI.profileImageUrl;
  }

  // Concatenate text so we never send empty strings
  const effectiveText = ((fullTweetData.mainText || '').trim() + ' ' + (fullTweetData.quotedText || '').trim()).trim() || 'Empty tweet';
  const tweetDataForAI = { mainText: effectiveText, mainImageUrl: fullTweetData.mainImageUrl };

  // Inject UI
  tweetElement.style.display = 'flex';
  articleEl.style.flex = '1 1 0%';
  articleEl.style.minWidth = '0';
  const formContainer = document.createElement('div');
  formContainer.style.width = '280px';
  formContainer.style.flexShrink = '0';
  formContainer.innerHTML = getCreationFormTemplate(cardId);
  tweetElement.appendChild(formContainer);

  // Wire up buttons
  const instaBtn = document.getElementById(`insta-snipe-${cardId}`);
  const suggestionsList = document.getElementById(`suggestions-${cardId}`);

  instaBtn.addEventListener('click', () => {
    simulateTyping(document.getElementById(`name-${cardId}`), suggestionsList.children[0]?.dataset.name || 'NoAI');
    simulateTyping(document.getElementById(`ticker-${cardId}`), suggestionsList.children[0]?.dataset.ticker || 'FAIL');
    handleDirectAPICreate(cardId, tweetDataForAPI);
  });

  suggestionsList.addEventListener('click', (e) => {
    const li = e.target.closest('.ai-suggestion-item');
    if (!li) return;
    simulateTyping(document.getElementById(`name-${cardId}`), li.dataset.name);
    simulateTyping(document.getElementById(`ticker-${cardId}`), li.dataset.ticker);
    handleDirectAPICreate(cardId, tweetDataForAPI);
  });

  // Call AI
  try {
    const res = await fetch('https://ai-deployer-xi.vercel.app/api/generate-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tweetDataForAI)
    });
    if (!res.ok) throw new Error(`Server ${res.status}`);
    const results = await res.json();
    suggestionsList.innerHTML = '';
    results.forEach((s, idx) => {
      const li = document.createElement('li');
      li.className = 'ai-suggestion-item';
      li.dataset.name = s.name;
      li.dataset.ticker = s.ticker;
      li.style.cssText = 'padding:8px;border:1px solid #52525b;border-radius:4px;cursor:pointer;display:flex;justify-content:space-between;font-size:13px';
      li.innerHTML = `<span>${s.name}</span><span style="color:#a1a1aa">$${s.ticker}</span>`;
      suggestionsList.appendChild(li);
      if (idx === 0) {
        simulateTyping(document.getElementById(`name-${cardId}`), s.name);
        simulateTyping(document.getElementById(`ticker-${cardId}`), s.ticker);
        li.style.borderColor = '#4f46e5';
        const createBtn = document.getElementById(`create-${cardId}`);
        if (createBtn) {
          createBtn.disabled = false;
          createBtn.style.cssText = 'padding:10px 12px;border:none;background:#4f46e5;color:#fff;border-radius:4px;cursor:pointer;font-weight:600;font-size:14px;text-align:center;width:100%;margin-top:auto';
          createBtn.addEventListener('click', () => handleDirectAPICreate(cardId, tweetDataForAPI));
        }
      }
    });
  } catch (err) {
    console.error(err);
    suggestionsList.innerHTML = `<li style="color:#ef4444">AI failed</li>`;
  }
}

// ---------- Observer ----------
function observeDOMChanges() {
  const obs = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          if (node.matches('[data-card="true"]')) processTweetCard(node);
          node.querySelectorAll('[data-card="true"]').forEach(processTweetCard);
        }
      });
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('[data-card="true"]').forEach(processTweetCard);
}

observeDOMChanges();