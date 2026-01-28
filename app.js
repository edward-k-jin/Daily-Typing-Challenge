// State Management
const STATE = {
    language: 'en',
    stage: 0, // 0-indexed (0, 1, 2)
    startTime: null,
    timerInterval: null,
    quotes: [], // Loaded for the current language
    currentQuote: "",
    ui: {}, // UI strings
    isFinished: false
};

const UI_ELEMENTS = {
    timer: document.getElementById('timer'),
    currentStage: document.getElementById('current-stage'),
    totalStages: document.getElementById('total-stages'),
    quoteDisplay: document.getElementById('quote-display'),
    typingInput: document.getElementById('typing-input'),
    feedback: document.getElementById('feedback-message'),
    restartBtn: document.getElementById('restart-btn'),
    resetRecordsBtn: document.getElementById('reset-records-btn'),
    langSelect: document.getElementById('language-dropdown'),
    inputHint: document.getElementById('input-hint'),
    statsSection: {
        langTitle: document.getElementById('stats-lang-title'),
        playCount: document.getElementById('stat-play-count'),
        bestTime: document.getElementById('stat-best-time'),
        lastTime: document.getElementById('stat-last-time'),
        allRecords: document.getElementById('all-records-panel')
    }
};

const LANGUAGES = ['ko', 'en', 'ja', 'es', 'fr'];
const TOTAL_STAGES = 3;

/**
 * Initialization
 */
async function init() {
    loadLanguagePreference();
    setupEventListeners();
    await loadResources(STATE.language);
    resetGame();
    updateStatsUI();
}

/**
 * Resource Loading
 */
async function loadResources(lang) {
    // Parallel fetch
    try {
        const [uiRes, quotesRes] = await Promise.all([
            fetch(`i18n/ui.${lang}.json`),
            fetch(`sentences/sentences.${lang}.json`)
        ]);

        const uiData = await uiRes.json();
        const quotesData = await quotesRes.json();

        STATE.ui = uiData.ui;
        STATE.quotes = quotesData.stages;

        applyUITranslations();
    } catch (e) {
        console.error("Failed to load resources:", e);
        UI_ELEMENTS.feedback.textContent = "Error loading data. Please refresh.";
    }
}

function applyUITranslations() {
    const ui = STATE.ui;
    document.title = ui.title || "DailyType";
    document.querySelector('.logo').textContent = ui.title || "DailyType";

    UI_ELEMENTS.restartBtn.textContent = ui.restart;
    UI_ELEMENTS.resetRecordsBtn.textContent = ui.resetRecords;
    UI_ELEMENTS.inputHint.textContent = ui.pressEnter;
    UI_ELEMENTS.typingInput.placeholder = ui.inputPlaceholder || "Type the quote exactly...";

    // Stats Labels (Static parts are updated, dynamic parts handled in updateStatsUI)
    updateStatsUI();
}

/**
 * Game Logic
 */
function resetGame() {
    STATE.stage = 0;
    STATE.startTime = null;
    STATE.isFinished = false;
    clearInterval(STATE.timerInterval);

    UI_ELEMENTS.timer.textContent = "0.00";
    UI_ELEMENTS.typingInput.value = "";
    UI_ELEMENTS.typingInput.disabled = false;
    UI_ELEMENTS.typingInput.focus();
    UI_ELEMENTS.feedback.textContent = "";
    UI_ELEMENTS.typingInput.classList.remove('error');

    updateStageUI();
}

function updateStageUI() {
    if (STATE.isFinished) {
        finishGame();
        return;
    }

    // Select Quote using KST Date + Stage + Language as Seed
    const seedString = getKSTDateString() + STATE.language + STATE.stage;
    const quoteIndex = hashStringToIndex(seedString, STATE.quotes[STATE.stage].length);
    STATE.currentQuote = STATE.quotes[STATE.stage][quoteIndex];

    UI_ELEMENTS.quoteDisplay.textContent = STATE.currentQuote;
    UI_ELEMENTS.currentStage.textContent = STATE.stage + 1;
    UI_ELEMENTS.totalStages.textContent = TOTAL_STAGES;
    UI_ELEMENTS.typingInput.value = "";
    UI_ELEMENTS.feedback.textContent = "";
}

function handleInput(e) {
    if (STATE.isFinished) return;

    // Start timer on first character of first stage
    if (STATE.stage === 0 && !STATE.startTime && UI_ELEMENTS.typingInput.value.length > 0) {
        startTimer();
    }

    // Enter Key
    if (e.key === 'Enter') {
        validateSubmission();
    } else {
        // Clear error state on typing
        UI_ELEMENTS.typingInput.classList.remove('error');
        UI_ELEMENTS.feedback.textContent = "";
    }
}

function validateSubmission() {
    const inputVal = UI_ELEMENTS.typingInput.value;

    if (inputVal === STATE.currentQuote) {
        // Correct
        STATE.stage++;
        if (STATE.stage >= TOTAL_STAGES) {
            STATE.isFinished = true;
            stopTimer();
            saveRecord();
            finishGame();
        } else {
            updateStageUI();
        }
    } else {
        // Incorrect
        UI_ELEMENTS.typingInput.classList.add('error');
        UI_ELEMENTS.feedback.textContent = STATE.ui.errorMismatch || "Mismatch";
    }
}

function startTimer() {
    STATE.startTime = Date.now();
    STATE.timerInterval = setInterval(() => {
        const elapsed = (Date.now() - STATE.startTime) / 1000;
        UI_ELEMENTS.timer.textContent = elapsed.toFixed(2);
    }, 10); // Update every 10ms for smooth look
}

function stopTimer() {
    clearInterval(STATE.timerInterval);
    const elapsed = (Date.now() - STATE.startTime) / 1000;
    UI_ELEMENTS.timer.textContent = elapsed.toFixed(2);
    return elapsed;
}

function finishGame() {
    UI_ELEMENTS.quoteDisplay.textContent = STATE.ui.completed || "Done!";
    UI_ELEMENTS.typingInput.disabled = true;
    UI_ELEMENTS.typingInput.value = "";
    UI_ELEMENTS.feedback.textContent = "";
    updateStatsUI();
}

/**
 * Statistics
 */
function saveRecord() {
    const finalTime = parseFloat(UI_ELEMENTS.timer.textContent);
    const key = `typingStats_${STATE.language}`;
    let data = JSON.parse(localStorage.getItem(key)) || { playCount: 0, lastTimeMs: null, bestTimeMs: null };

    data.playCount++;
    data.lastTimeMs = finalTime;

    if (data.bestTimeMs === null || finalTime < data.bestTimeMs) {
        data.bestTimeMs = finalTime;
    }

    localStorage.setItem(key, JSON.stringify(data));
}

function resetAllRecords() {
    if (confirm("Are you sure you want to delete all records? / 모든 기록을 삭제하시겠습니까?")) {
        LANGUAGES.forEach(lang => localStorage.removeItem(`typingStats_${lang}`));
        updateStatsUI();
    }
}

function updateStatsUI() {
    const key = `typingStats_${STATE.language}`;
    const data = JSON.parse(localStorage.getItem(key)) || { playCount: 0, lastTimeMs: null, bestTimeMs: null };
    const ui = STATE.ui;

    // Current Stats Card
    UI_ELEMENTS.statsSection.langTitle.textContent = getLanguageName(STATE.language);
    UI_ELEMENTS.statsSection.playCount.previousElementSibling.textContent = ui.statPlayed;
    UI_ELEMENTS.statsSection.playCount.textContent = data.playCount;

    UI_ELEMENTS.statsSection.bestTime.previousElementSibling.textContent = ui.statBest;
    UI_ELEMENTS.statsSection.bestTime.textContent = data.bestTimeMs !== null ? data.bestTimeMs.toFixed(2) + "s" : "-";

    UI_ELEMENTS.statsSection.lastTime.previousElementSibling.textContent = ui.statLast;
    UI_ELEMENTS.statsSection.lastTime.textContent = data.lastTimeMs !== null ? data.lastTimeMs.toFixed(2) + "s" : "-";

    // All Records Panel
    renderAllRecords();
}

function renderAllRecords() {
    const container = UI_ELEMENTS.statsSection.allRecords;
    container.innerHTML = ""; // Clear

    LANGUAGES.forEach(lang => {
        const key = `typingStats_${lang}`;
        const data = JSON.parse(localStorage.getItem(key));
        if (data) {
            const el = document.createElement('div');
            el.className = 'mini-stat-row';
            if (lang === STATE.language) el.classList.add('current');

            // Format: [KO] Best: 12.34s | Plays: 5
            el.innerHTML = `
                <span class="lang-tag">${lang.toUpperCase()}</span>
                <span class="stat-info">
                   Best: <b>${data.bestTimeMs !== null ? data.bestTimeMs.toFixed(2) + 's' : '-'}</b>
                   <span class="divider">|</span>
                   Plays: ${data.playCount}
                </span>
            `;
            container.appendChild(el);
        }
    });
}

function getLanguageName(code) {
    const map = {
        'en': 'English',
        'ko': '한국어',
        'ja': '日本語',
        'es': 'Español',
        'fr': 'Français'
    };
    return map[code] || code.toUpperCase();
}

/**
 * Utilities
 */
function getKSTDateString() {
    // Get current time in KST (UTC+9)
    // We create a date string for 'Asia/Seoul'
    const now = new Date();
    const kstString = now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // en-CA gives YYYY-MM-DD
    return kstString;
}

// Simple seeded random to pick daily quote index
// Mulberry32 algorithm
function hashStringToIndex(seedStr, maxIndex) {
    let h = 0xdeadbeef;
    for (let i = 0; i < seedStr.length; i++) {
        h = Math.imul(h ^ seedStr.charCodeAt(i), 2654435761);
    }

    // Create a PRNG function from the hash
    const rand = function () {
        h += 0x6D2B79F5;
        let t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Warm up
    rand(); rand();

    const randomVal = rand();
    return Math.floor(randomVal * maxIndex);
}

/**
 * Language Handling
 */
function loadLanguagePreference() {
    const stored = localStorage.getItem('typingLanguage');
    if (stored && LANGUAGES.includes(stored)) {
        STATE.language = stored;
    } else {
        // More robust detection: Check navigator.languages array first, then navigator.language
        const langs = navigator.languages || [navigator.language || 'en'];
        // Check for 'ko', 'ko-KR', 'ko-KR' etc.
        const isKorean = langs.some(lang => /ko/i.test(lang));
        STATE.language = isKorean ? 'ko' : 'en';
    }
    UI_ELEMENTS.langSelect.value = STATE.language;
}

async function changeLanguage(newLang) {
    if (STATE.language === newLang) return;

    if (STATE.startTime && !STATE.isFinished) {
        if (!confirm(STATE.ui.changeLangWarning || "Change language?")) {
            UI_ELEMENTS.langSelect.value = STATE.language;
            return;
        }
    }

    // Save preference and force reload as requested
    localStorage.setItem('typingLanguage', newLang);
    location.reload();
}

/**
 * Events Setup
 */
function setupEventListeners() {
    UI_ELEMENTS.typingInput.addEventListener('keyup', handleInput);
    UI_ELEMENTS.typingInput.addEventListener('keydown', (e) => {
        // Prevent default submission if inside a form, though we don't have one
        if (e.key === 'Enter') e.preventDefault();
    });

    // Anti-Abuse: Disable Paste
    UI_ELEMENTS.typingInput.addEventListener('paste', (e) => {
        e.preventDefault();
        // Optional: Provide feedback like "No pasting allowed!"
    });

    UI_ELEMENTS.restartBtn.addEventListener('click', () => {
        resetGame();
    });

    UI_ELEMENTS.resetRecordsBtn.addEventListener('click', resetAllRecords);

    UI_ELEMENTS.langSelect.addEventListener('change', (e) => {
        changeLanguage(e.target.value);
    });
}

// Start
init();
