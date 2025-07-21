document.addEventListener('DOMContentLoaded', () => {
    const autoCreateToggle = document.getElementById('autoCreateToggle');
    const sniperModeToggle = document.getElementById('sniperModeToggle');
    const sniperListElement = document.getElementById('sniper-list');
    const usernameInput = document.getElementById('sniper-username');
    const addButton = document.getElementById('add-sniper-btn');

    let sniperList = [];

    function renderSniperList() {
        sniperListElement.innerHTML = '';
        if (sniperList.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No users in sniper list.';
            li.style.color = '#71717a';
            sniperListElement.appendChild(li);
        } else {
            sniperList.forEach(username => {
                const li = document.createElement('li');
                li.innerHTML = `<span>@${username}</span><button class="remove-btn" data-username="${username}">×</button>`;
                sniperListElement.appendChild(li);
            });
        }
    }

    function loadSettings() {
        chrome.storage.sync.get(['autoCreateEnabled', 'sniperList', 'sniperModeEnabled'], (result) => {
            autoCreateToggle.checked = !!result.autoCreateEnabled;
            sniperModeToggle.checked = !!result.sniperModeEnabled;
            sniperList = result.sniperList || [];
            renderSniperList();
        });
    }

    addButton.addEventListener('click', () => {
        const username = usernameInput.value.trim().toLowerCase().replace('@', '');
        if (username && !sniperList.includes(username)) {
            sniperList.push(username);
            chrome.storage.sync.set({ sniperList: sniperList }, () => {
                renderSniperList();
                usernameInput.value = '';
            });
        }
    });

    sniperListElement.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) {
            const usernameToRemove = e.target.dataset.username;
            sniperList = sniperList.filter(user => user !== usernameToRemove);
            chrome.storage.sync.set({ sniperList: sniperList }, () => {
                renderSniperList();
            });
        }
    });

    autoCreateToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ autoCreateEnabled: autoCreateToggle.checked });
    });

    // --- NEW --- Add listener for the master sniper switch
    sniperModeToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ sniperModeEnabled: sniperModeToggle.checked });
        console.log("Sniper Mode is now:", sniperModeToggle.checked);
    });

    loadSettings();
});