console.log("Uxento AI Sniper v16: Injection Core Fixed");

// --- Helper Functions ---
function simulateTyping(inputElement, text) {
    if (!inputElement) return;
    inputElement.focus();
    inputElement.value = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
}

// --- DATA EXTRACTION FUNCTION (Reverted to a more stable version) ---
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
    
    if (tweetElement.querySelector('svg.lucide-user-plus, svg.lucide-user-minus')) {
        data.isContentTweet = false;
        return data;
    }
    
    const viewLink = tweetElement.querySelector('a[href*="/status/"]');
    if (viewLink) data.twitterUrl = viewLink.href;

    const authorHeader = tweetElement.querySelector('div[class*="flex items-center gap-3 p-4"]');
    if (authorHeader) {
        const authorLink = authorHeader.querySelector('a[href^="https://x.com/"]');
        if (authorLink) data.author = authorLink.href.split('/').pop().toLowerCase();
        
        const avatarElement = authorHeader.querySelector('img');
        if (avatarElement) {
            data.profileImageUrl = avatarElement.src.replace('_normal', '_400x400');
        }
    }
    
    const mainTextElement = tweetElement.querySelector('div[class*="px-4 pb-4 text-sm leading-relaxed"]');
    if (mainTextElement) data.mainText = mainTextElement.innerText.trim();

    const quotedTweetContainer = tweetElement.querySelector('div[class*="mx-4 mb-4 p-3 rounded-md"]');
    if (quotedTweetContainer) {
        const quotedTextElement = quotedTweetContainer.querySelector('div[class*="text-xs leading-relaxed"]');
        if (quotedTextElement) data.quotedText = quotedTextElement.innerText.trim();
    }
    
    // Simplified and more robust image search
    let mainImage = tweetElement.querySelector('img.cursor-zoom-in');
    if (!mainImage) {
        const photoLink = tweetElement.querySelector('a[href*="/photo/"]');
        if (photoLink) mainImage = photoLink.querySelector('img');
    }
    
    if (mainImage) {
        data.mainImageUrl = mainImage.src;
    } else {
        const videoElement = tweetElement.querySelector('video');
        if (videoElement && videoElement.poster) {
            data.mainImageUrl = videoElement.poster;
        }
    }

    return data;
}

// --- HTML Template for the UI Panel ---
function getCreationFormTemplate(cardId) {
    return `
        <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; height: 100%; padding: 16px; box-sizing: border-box; background-color: #15151f; border-left: 1px solid #2A2A33;">
            <div><label style="font-size: 12px; color: #a1a1aa; display: block; margin-bottom: 4px;">Name</label><input type="text" id="name-${cardId}" class="ai-input-name" placeholder="Select a suggestion..." style="width: 100%; background-color: #27272a; border: 1px solid #52525b; border-radius: 4px; color: #f4f4f5; padding: 8px; font-size: 14px;"></div>
            <div><label style="font-size: 12px; color: #a1a1aa; display: block; margin-bottom: 4px;">Ticker</label><input type="text" id="ticker-${cardId}" class="ai-input-ticker" placeholder="..." style="width: 100%; background-color: #27272a; border: 1px solid #52525b; border-radius: 4px; color: #f4f4f5; padding: 8px; font-size: 14px;"></div>
            <div style="flex-grow: 1;"><label style="font-size: 12px; color: #a1a1aa; display: block; margin-bottom: 8px;">AI Suggestions (Click to Insta-Create)</label><ul id="suggestions-${cardId}" class="ai-suggestions-list" style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; max-height: 2000px; overflow-y: auto;"><li style="color: #a1a1aa; text-align: center; font-size: 13px;">✨ Consulting the Oracle...</li></ul></div>
            <div><label style="font-size: 12px; color: #a1a1aa; display: block; margin-bottom: 4px;">Buy Amount (SOL)</label><input type="text" id="amount-${cardId}" class="ai-input-amount" value="1" style="width: 100%; background-color: #27272a; border: 1px solid #52525b; border-radius: 4px; color: #f4f4f5; padding: 8px; font-size: 14px;"></div>
            <button id="create-${cardId}" class="ai-final-create-button" disabled style="padding: 10px 12px; border: none; background-color: #3f3f46; color: #a1a1aa; border-radius: 4px; cursor: not-allowed; font-weight: 600; font-size: 14px; text-align: center; width: 100%; margin-top: auto;">Create Manually</button>
        </div>
    `;
}

// --- Function to call the Uxento Backend API ---
async function handleDirectAPICreate(cardId, tweetDataForAPI) {
    const createButton = document.getElementById(`create-${cardId}`);
    if(createButton) { createButton.disabled = true; createButton.innerText = 'DEPLOYING...'; }
    try {
        const name = document.getElementById(`name-${cardId}`).value;
        const ticker = document.getElementById(`ticker-${cardId}`).value;
        const amount = document.getElementById(`amount-${cardId}`).value;
        const payload = { name, symbol: ticker, twitter: tweetDataForAPI.twitterUrl, image: tweetDataForAPI.mainImageUrl, amount: parseFloat(amount), astralTip: 0.002 };
        console.log("Sending final payload to Uxento API:", payload);
        const response = await fetch('https://eu-dev.uxento.io/api/v1/create/bonk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' });
        if (!response.ok) { const errorData = await response.json(); throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`); }
        const result = await response.json();
        console.log("SUCCESS! COIN CREATED VIA DIRECT API:", result);
        if(createButton) createButton.innerText = 'SNIPE SUCCESSFUL!';
    } catch (error) {
        console.error("CRITICAL FAILURE during direct API call:", error);
        if(createButton) { createButton.innerText = 'API FAILED'; createButton.style.backgroundColor = '#ef4444'; }
    }
}

// --- The Core Function that processes each card ---
async function processTweetCard(tweetElement) {
    if (tweetElement.dataset.aiFormInjected === 'true') return;

    // We must ensure there's an article to work with before proceeding.
    const articleElement = tweetElement.querySelector('article');
    if (!articleElement) return;

    const fullTweetData = extractTweetData(tweetElement);
    if (!fullTweetData.isContentTweet) {
        tweetElement.dataset.aiFormInjected = 'true';
        return;
    }
    
    tweetElement.dataset.aiFormInjected = 'true';
    const cardId = Date.now() + Math.random().toString(36).substring(2, 9);
    
    // --- THIS IS THE FIX ---
    // We now find the button and hide it if it exists,
    // but its absence will NOT stop the script.
    const originalCreateButton = tweetElement.querySelector('button.bg-blue-600\\/80');
    if (originalCreateButton) {
        originalCreateButton.style.display = 'none';
    }
    
    const tweetDataForAPI = { ...fullTweetData };
    if (!tweetDataForAPI.mainImageUrl && tweetDataForAPI.profileImageUrl) {
        tweetDataForAPI.mainImageUrl = tweetDataForAPI.profileImageUrl;
    }
    const tweetDataForAI = { ...fullTweetData };
    if (!tweetDataForAI.mainImageUrl) {
        delete tweetDataForAI.mainImageUrl;
    }

    tweetElement.style.display = 'flex';
    articleElement.style.flex = '1 1 0%';
    articleElement.style.minWidth = '0'; 
    const formContainer = document.createElement('div');
    formContainer.style.width = '280px';
    formContainer.style.flexShrink = '0';
    formContainer.innerHTML = getCreationFormTemplate(cardId);
    tweetElement.appendChild(formContainer);

    const suggestionsList = document.getElementById(`suggestions-${cardId}`);
    
    suggestionsList.addEventListener('click', (e) => {
        const selectedItem = e.target.closest('.ai-suggestion-item');
        if (!selectedItem) return;
        simulateTyping(document.getElementById(`name-${cardId}`), selectedItem.dataset.name);
        simulateTyping(document.getElementById(`ticker-${cardId}`), selectedItem.dataset.ticker);
        handleDirectAPICreate(cardId, tweetDataForAPI);
    });

    try {
        const response = await fetch('https://ai-deployer-six.vercel.app/api/generate-name', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tweetDataForAI)
        });
        if (!response.ok) throw new Error(`Server Error: ${response.status}`);
        
        const results = await response.json();
        suggestionsList.innerHTML = '';
        results.forEach((suggestion, index) => {
            const li = document.createElement('li');
            li.className = 'ai-suggestion-item';
            li.style.cssText = `padding: 8px; border: 1px solid #52525b; border-radius: 4px; cursor: pointer; display: flex; justify-content: space-between; font-size: 13px; transition: border-color 0.2s;`;
            li.dataset.name = suggestion.name;
            li.dataset.ticker = suggestion.ticker;
            li.innerHTML = `<span>${suggestion.name}</span><span style="color: #a1a1aa;">$${suggestion.ticker}</span>`;
            suggestionsList.appendChild(li);
            if (index === 0) {
                simulateTyping(document.getElementById(`name-${cardId}`), suggestion.name);
                simulateTyping(document.getElementById(`ticker-${cardId}`), suggestion.ticker);
                li.style.borderColor = '#4f46e5';
                const createBtn = document.getElementById(`create-${cardId}`);
                if (createBtn) {
                    createBtn.disabled = false;
                    createBtn.style.cssText = `padding: 10px 12px; border: none; background-color: #4f46e5; color: white; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 14px; text-align: center; width: 100%; margin-top: auto;`;
                }
            }
        });
        chrome.storage.sync.get(['sniperList', 'sniperModeEnabled'], (storageResult) => {
            if (storageResult.sniperModeEnabled && storageResult.sniperList && storageResult.sniperList.includes(fullTweetData.author)) {
                console.log(`SNIPER MATCH for @${fullTweetData.author}. Firing!`);
                chrome.storage.sync.set({ sniperModeEnabled: false }, () => console.log("Sniper mode disabled after firing."));
                handleDirectAPICreate(cardId, tweetDataForAPI);
            }
        });
    } catch (error) {
        console.error(`AI Error for card ${cardId}:`, error);
        if (suggestionsList) {
            suggestionsList.innerHTML = `<li style="color: #ef4444;">AI failed. Check Vercel logs.</li>`;
        }
    }
}


// --- Observer ---
function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches('[data-card="true"]')) {
                        processTweetCard(node);
                    }
                    const cards = node.querySelectorAll('[data-card="true"]');
                    cards.forEach(processTweetCard);
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial run for any cards already on the page
    document.querySelectorAll('[data-card="true"]').forEach(processTweetCard);
}

observeDOMChanges();