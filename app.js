// State Management
const STATE = {
    language: 'en',
    stage: 0, // 0-indexed (0, 1, 2)
    startTime: null,
    timerInterval: null,
    quotes: [], // Loaded for the current language
    currentQuote: "",
    ui: {}, // UI strings
    isFinished: false,
    totalCharsTyped: 0
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
    guideTitle: document.getElementById('guide-title'),
    guideList: document.getElementById('guide-list'),
    badge: document.getElementById('challenge-badge'),
    statsSection: {
        langTitle: document.getElementById('stats-lang-title'),
        rankLabel: document.getElementById('rank-label'),
        rankValue: document.getElementById('rank-value'),
        rankSubtext: document.getElementById('rank-subtext'),
        rankingList: document.getElementById('ranking-list')
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
        const timestamp = new Date().getTime();
        const [uiRes, quotesRes] = await Promise.all([
            fetch(`i18n/ui.${lang}.json?v=${timestamp}`),
            fetch(`sentences/sentences.${lang}.json?v=${timestamp}`)
        ]);

        const uiData = await uiRes.json();
        const quotesData = await quotesRes.json();

        STATE.ui = uiData.ui;
        // Handle flattened structure: quotesData.sentences
        // Store all available quotes
        STATE.allQuotes = quotesData.sentences || [];

        // Select 3 for the day immediately after loading
        selectDailyQuotes();

        applyUITranslations();
    } catch (e) {
        console.error("Failed to load resources:", e);
        UI_ELEMENTS.feedback.textContent = "Error loading data. Please refresh.";
    }
}

// ... imports or setup if any

function selectDailyQuotes() {
    if (!STATE.allQuotes || STATE.allQuotes.length === 0) {
        STATE.dailyQuotes = ["No quotes available.", "No quotes available.", "No quotes available."];
        return;
    }

    // 1. Calculate how many days passed since a fixed epoch (e.g. 2025-01-01)
    const daysPassed = getDaysSinceFixedEpoch();

    // 2. We consume 3 quotes per day. Calculate the global start index.
    //    Stream: [ Day0_Q1, Day0_Q2, Day0_Q3, Day1_Q1, ... ]
    const globalStartIndex = daysPassed * 3;

    STATE.dailyQuotes = [];
    for (let i = 0; i < 3; i++) {
        STATE.dailyQuotes.push(getSentenceAtGlobalIndex(globalStartIndex + i));
    }
}

// Retrieve a sentence from the infinite stream of shuffled decks
function getSentenceAtGlobalIndex(globalIndex) {
    const total = STATE.allQuotes.length;
    // Which "Deck" (cycle) are we in?
    const deckIndex = Math.floor(globalIndex / total);
    // Which position within that deck?
    const localIndex = globalIndex % total;

    // Seed for this specific deck depends on Language + DeckIndex
    // This ensures that when we enter a new deck (cycle), it's reshuffled randomly
    const seed = `${STATE.language}_deck_${deckIndex}`;

    // Create a shuffled view of indices for this deck
    const shuffledIndices = getShuffledIndices(total, seed);

    return STATE.allQuotes[shuffledIndices[localIndex]];
}

function getShuffledIndices(length, seed) {
    // Create array [0, 1, ..., length-1]
    const indices = Array.from({ length }, (_, i) => i);
    const prng = createSeededRandom(seed);

    // Fisher-Yates Shuffle
    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
}

function getDaysSinceFixedEpoch() {
    const kstNow = new Date();
    // Use KST time
    const kstString = kstNow.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const today = new Date(kstString);
    const epoch = new Date("2025-01-01");

    // Difference in time
    const diffTime = today - epoch;
    // Difference in days (floor to be safe, though time should be 00:00:00 locally)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 0 ? diffDays : 0; // Fallback if system time is weirdly before epoch
}
// ... remainder of applyUITranslations

function applyUITranslations() {
    const ui = STATE.ui;
    document.title = ui.title || "DailyType";
    document.querySelector('.logo').textContent = ui.title || "DailyType";

    UI_ELEMENTS.restartBtn.textContent = ui.restart;
    UI_ELEMENTS.resetRecordsBtn.textContent = ui.resetRecords;
    UI_ELEMENTS.inputHint.textContent = ui.pressEnter;
    UI_ELEMENTS.typingInput.placeholder = ui.inputPlaceholder || "Type the quote exactly...";

    if (UI_ELEMENTS.badge) UI_ELEMENTS.badge.textContent = ui.badge || "Today's Challenge";

    // Guide Section
    // Guide Section
    if (ui.guide) {
        if (UI_ELEMENTS.guideTitle) UI_ELEMENTS.guideTitle.textContent = ui.guide.title;

        // Re-query to ensure we have the element (in case of DOM updates)
        const guideList = UI_ELEMENTS.guideList || document.getElementById('guide-list');

        if (guideList) {
            guideList.innerHTML = "";
            if (ui.guide.items && Array.isArray(ui.guide.items)) {
                ui.guide.items.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = item;
                    guideList.appendChild(li);
                });
            }
        }
    }

    // Stats Labels (Static parts are updated, dynamic parts handled in updateStatsUI)
    // Info Section
    if (ui.infoSection) {
        const infoTitle = document.getElementById('info-title');
        if (infoTitle) infoTitle.textContent = ui.infoSection.title;

        if (ui.infoSection.items && Array.isArray(ui.infoSection.items)) {
            ui.infoSection.items.forEach((item, index) => {
                const titleEl = document.getElementById(`info-item-${index}-title`);
                const descEl = document.getElementById(`info-item-${index}-desc`);
                if (titleEl) titleEl.textContent = item.title;
                if (descEl) descEl.textContent = item.desc;
            });
        }
    }

    // Footer
    if (ui.footer) {
        const footerCopyright = document.getElementById('footer-copyright');
        const footerPrivacy = document.getElementById('footer-privacy');
        const footerTerms = document.getElementById('footer-terms');

        if (footerCopyright) footerCopyright.textContent = ui.footer.copyright;
        if (footerPrivacy) footerPrivacy.textContent = ui.footer.privacy;
        if (footerTerms) footerTerms.textContent = ui.footer.terms;
    }

    updateStatsUI();
}

/**
 * Game Logic
 */
function resetGame() {
    STATE.stage = 0;
    STATE.startTime = null;
    STATE.isFinished = false;
    STATE.totalCharsTyped = 0;
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

    // Use pre-selected daily quotes
    STATE.currentQuote = STATE.dailyQuotes[STATE.stage];

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
        STATE.totalCharsTyped += inputVal.length;
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
 * Statistics & Relative Rank Logic
 */
function saveRecord() {
    const finalTime = parseFloat(UI_ELEMENTS.timer.textContent);

    // Calculate WPM: (Chars / 5) / (Minutes)
    const wpm = (STATE.totalCharsTyped / 5) / (finalTime / 60);

    // Calculate Percentile (Top X%)
    const percentile = getPercentile(wpm);
    const percentileNum = parseFloat(percentile);

    const key = `typingStats_${STATE.language}`;
    // Data structure: { playCount: 0, records: [] }
    let data = JSON.parse(localStorage.getItem(key)) || { playCount: 0, records: [] };

    // Increment play count
    data.playCount = (data.playCount || 0) + 1;

    // Create new record
    const newRecord = {
        playIndex: data.playCount,
        percentile: percentileNum,
        wpm: wpm, // Optional, for reference
        duration: finalTime, // Saved in seconds (float)
        timestamp: Date.now()
    };

    // Add and Sort
    if (!data.records) data.records = [];
    data.records.push(newRecord);

    // Sort by percentile (ascending: lower is better)
    data.records.sort((a, b) => a.percentile - b.percentile);

    // Keep top 5
    if (data.records.length > 5) {
        data.records = data.records.slice(0, 5);
    }

    localStorage.setItem(key, JSON.stringify(data));
}

function resetAllRecords() {
    const isKorean = STATE.language === 'ko';

    // Updated message to specify "current language"
    const msg = isKorean
        ? "현재 언어의 모든 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        : "Are you sure you want to delete records for the current language? This cannot be undone.";

    if (confirm(msg)) {
        // Reset only current language
        localStorage.removeItem(`typingStats_${STATE.language}`);
        updateStatsUI();
    }
}

function updateStatsUI() {
    const key = `typingStats_${STATE.language}`;
    // Fallback for migration or empty
    const data = JSON.parse(localStorage.getItem(key)) || { playCount: 0, records: [] };
    const ui = STATE.ui;

    UI_ELEMENTS.statsSection.langTitle.textContent = getLanguageName(STATE.language);

    const isKorean = STATE.language === 'ko';

    // 1. Main Best Rank Display
    // Determine best rank from records[0] (since it's sorted) or bestPercentile if using old data (simple migration check)
    let bestPercentile = null;
    if (data.records && data.records.length > 0) {
        bestPercentile = data.records[0].percentile;
    } else if (data.bestPercentile) {
        // Migration support for the data we just created in previous step
        bestPercentile = data.bestPercentile;
    }

    if (bestPercentile !== null) {
        let displayVal = bestPercentile < 0.1 ? "<0.1" : bestPercentile.toFixed(1);
        if (displayVal.endsWith('.0')) displayVal = displayVal.slice(0, -2);

        const prefix = isKorean ? "상위 " : "Top ";
        const suffix = "%";

        UI_ELEMENTS.statsSection.rankValue.textContent = `${prefix}${displayVal}${suffix}`;
        UI_ELEMENTS.statsSection.rankValue.classList.add('has-rank');
    } else {
        UI_ELEMENTS.statsSection.rankValue.textContent = "-";
        UI_ELEMENTS.statsSection.rankValue.classList.remove('has-rank');
    }

    UI_ELEMENTS.statsSection.rankLabel.textContent = isKorean ? "나의 최고 순위" : "Your Best Rank";
    UI_ELEMENTS.statsSection.rankSubtext.textContent = isKorean ? "(전체 사용자 WPM 분포 기반)" : "(Based on global WPM stats)";

    // 2. Ranking List
    renderRankingList(data.records || [], isKorean);
}

function renderRankingList(records, isKorean) {
    const listContainer = UI_ELEMENTS.statsSection.rankingList;
    listContainer.innerHTML = ""; // Clear

    if (records.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-rank-msg';
        emptyMsg.textContent = isKorean ? "기록이 없습니다." : "No records yet.";
        listContainer.appendChild(emptyMsg);
        return;
    }

    records.forEach((rec, index) => {
        const item = document.createElement('div');
        item.className = 'ranking-item';

        // Format: Rank | Time (MM:SS.ss) | Top %

        let timeStr = "";
        if (rec.duration) {
            const m = Math.floor(rec.duration / 60);
            const s = (rec.duration % 60).toFixed(2);
            // Pad seconds if needed? Actually toFixed(2) gives e.g. "4.50" or "14.50".
            // If m > 0, we want "1:04.50". If m=0, maybe just "4.50s"?
            // Let's standardise: "M분 SS.ss초" (KR) or "M:SS.ss" (EN)

            if (isKorean) {
                if (m > 0) timeStr = `${m}분 ${s}초`;
                else timeStr = `${s}초`;
            } else {
                // Format M:SS.ss
                const sStr = s < 10 && m > 0 ? "0" + s : s;
                if (m > 0) timeStr = `${m}:${sStr}`;
                else timeStr = `${s}s`;
            }
        } else {
            // Fallback for old records without duration
            // Just show Play Index as fallback so user doesn't see empty
            timeStr = isKorean ? `${rec.playIndex}번째 완료` : `Clear #${rec.playIndex}`;
        }

        // Percentile String
        let pVal = rec.percentile < 0.1 ? "<0.1" : rec.percentile.toFixed(1);
        if (pVal.endsWith('.0')) pVal = pVal.slice(0, -2);
        const percentStr = isKorean ? `상위 ${pVal}%` : `Top ${pVal}%`;

        item.innerHTML = `
            <div class="rank-index">${index + 1}</div>
            <div class="rank-details">
                <span class="rank-try">${timeStr}</span>
                <span class="rank-percent">${percentStr}</span>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// Gaussian (Normal) Distribution CDF
function calculateNormalCDF(x, mean, stdDev) {
    return 0.5 * (1 + Erf((x - mean) / (stdDev * Math.sqrt(2))));
}

function Erf(x) {
    // Approximation of the error function
    // constants
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    // Save the sign of x
    let sign = 1;
    if (x < 0) {
        sign = -1;
    }
    x = Math.abs(x);

    // A&S formula 7.1.26
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
}

function getPercentile(wpm) {
    // Mean 40, SD 15
    // Ranking is inverted: Higher WPM -> Lower Percentile (Top 1% is better than Top 99%)
    // CDF gives probability that a random variable is LESS than x.
    // So if WPM is high, CDF is close to 1 (e.g. 0.99).
    // We want "Top (1 - CDF) * 100".

    const mean = 40;
    const stdDev = 15;
    const cdf = calculateNormalCDF(wpm, mean, stdDev);

    // Top % = (1 - cdf) * 100
    let topPercent = (1 - cdf) * 100;

    // Clamp to reasonable range (e.g. 0.01% - 99.99%)
    if (topPercent < 0.01) topPercent = 0.01;
    if (topPercent > 99.9) topPercent = 99.9;

    return topPercent.toString(); // Return as string number
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
// PRNG based on Mulberry32
function createSeededRandom(seedStr) {
    let h = 0xdeadbeef;
    for (let i = 0; i < seedStr.length; i++) {
        h = Math.imul(h ^ seedStr.charCodeAt(i), 2654435761);
    }

    return function () {
        h += 0x6D2B79F5;
        let t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
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
