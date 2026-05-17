// --- Konfigurace a Stav ---
const STORAGE_KEY = 'matikaBetState';
const ADMIN_PASSWORD = 'admin'; // Jednoduché heslo pro ukázku (lze změnit)

// Výchozí stav aplikace. Ukládá se do localStorage.
let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  users: {},
  // "Seed" pooly (každý den má základních 100 coinů od kasina, aby kurzy nebyly na začátku extrémní)
  pools: { tue: 100, wed: 100, thu: 100, fri: 100 },
  bets: [] // [{ user: 'Pepa', day: 'tue', amount: 50 }]
};

let currentUser = null;

// Konfigurace sázecích dnů
const daysConfig = {
  tue: { name: 'Úterý', color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-700/50' },
  wed: { name: 'Středa', color: 'text-purple-400', bg: 'bg-purple-900/20', border: 'border-purple-700/50' },
  thu: { name: 'Čtvrtek', color: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-700/50' },
  fri: { name: 'Pátek', color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-700/50' }
};

// Uložení do lokálního úložiště
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- Herní Logika ---

// Výpočet aktuálního kurzu na základě Totalizátoru (Pari-mutuel)
function calculateOdds(day) {
  const totalPool = Object.values(state.pools).reduce((a, b) => a + b, 0);
  const dayPool = state.pools[day];

  // Kasino si bere 5% margin pro realističnost (a pomalé odčerpávání peněz)
  const odds = (totalPool * 0.95) / dayPool;
  return Math.max(1.01, odds).toFixed(2);
}

// Získání tiketů aktuálně přihlášeného uživatele
function getMyBets() {
  if (!currentUser) return [];
  return state.bets.filter(b => b.user === currentUser);
}

// Funkce pro vsazení
function placeBet(day, amountStr) {
  const amount = parseInt(amountStr);

  if (isNaN(amount) || amount <= 0) {
    return alert('❌ Zadej platnou částku k vsazení.');
  }

  if (state.users[currentUser].balance < amount) {
    return alert('💸 Nemáš dostatek Učitelských coinů (UC)! Zkus denní bonus.');
  }

  // Strhnout z účtu a přidat do poolu
  state.users[currentUser].balance -= amount;
  state.pools[day] += amount;
  state.bets.push({ user: currentUser, day, amount });

  saveState();
  renderDashboard();

  // Malý vizuální feedback
  const input = document.getElementById(`bet-input-${day}`);
  if (input) input.value = '';
}

// Funkce pro denní bonus
function claimBonus() {
  const user = state.users[currentUser];
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (now - user.lastBonus < ONE_DAY_MS) {
    const hoursLeft = Math.ceil((ONE_DAY_MS - (now - user.lastBonus)) / (1000 * 60 * 60));
    return alert(`⏳ Další bonus bude dostupný až za cca ${hoursLeft} hodin(y).`);
  }

  // Náhodný bonus 10 až 50 UC
  const bonusAmount = Math.floor(Math.random() * 41) + 10;
  user.balance += bonusAmount;
  user.lastBonus = now;
  saveState();

  alert(`🎉 Získáváš denní dotaci: ${bonusAmount} UC!`);
  renderDashboard();
}

// --- Vykreslování UI ---

function renderApp() {
  if (currentUser) {
    document.getElementById('loginView').classList.add('hidden-view');
    document.getElementById('dashboardView').classList.remove('hidden-view');
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('navUsername').textContent = currentUser;

    renderDashboard();
  } else {
    document.getElementById('loginView').classList.remove('hidden-view');
    document.getElementById('dashboardView').classList.add('hidden-view');
    document.getElementById('userInfo').classList.add('hidden');
  }
}

function renderDashboard() {
  // 1. Aktualizace zůstatku v navigaci
  document.getElementById('navBalance').textContent = Math.floor(state.users[currentUser].balance);

  // 2. Vykreslení karet pro sázky
  const container = document.getElementById('bettingCards');
  container.innerHTML = '';

  for (const [dayKey, dayInfo] of Object.entries(daysConfig)) {
    const odds = calculateOdds(dayKey);
    const myBetOnDay = getMyBets().filter(b => b.day === dayKey).reduce((sum, b) => sum + b.amount, 0);
    // Skutečně vsazeno lidmi (odečteme kasino seed 100)
    const realPool = state.pools[dayKey] - 100;

    const card = document.createElement('div');
    card.className = `card-hover p-5 rounded-xl border ${dayInfo.border} ${dayInfo.bg} flex flex-col gap-3 relative overflow-hidden transition-all shadow-md`;
    card.innerHTML = `
      <div class="flex justify-between items-center">
        <h3 class="font-bold text-lg ${dayInfo.color} drop-shadow-md">${dayInfo.name}</h3>
        <span class="bg-gray-900 px-2.5 py-1 rounded-md text-sm font-mono text-brand border border-brand/30 shadow-inner">
          Kurz: ${odds}
        </span>
      </div>
      <div class="text-xs text-gray-400 mt-1">
        🏦 V banku od třídy: <span class="text-gray-300 font-semibold">${realPool} UC</span>
      </div>
      ${myBetOnDay > 0 ? `<div class="text-xs font-bold text-accent bg-yellow-900/30 p-1.5 rounded inline-block mt-1">Tvoje sázka: ${myBetOnDay} UC</div>` : '<div class="h-6 mt-1"></div>'}
      
      <div class="mt-auto pt-4 border-t border-gray-700/50 flex gap-2">
        <input type="number" id="bet-input-${dayKey}" min="1" placeholder="Částka (UC)" class="w-full bg-gray-900/80 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-brand">
        <button onclick="placeBet('${dayKey}', document.getElementById('bet-input-${dayKey}').value)" class="bg-brand hover:bg-brandHover text-white px-4 py-2 rounded-md font-bold text-sm transition-colors shadow-md">
          Vsadit
        </button>
      </div>
    `;
    container.appendChild(card);
  }

  // 3. Vykreslení historie mých sázek
  const list = document.getElementById('myBetsList');
  const myBets = getMyBets();
  list.innerHTML = '';

  if (myBets.length === 0) {
    list.innerHTML = '<li class="text-gray-500 italic p-4 text-center bg-gray-900/50 rounded border border-gray-700 border-dashed">Zatím nemáš vsazeno. Poslední lavice čeká!</li>';
  } else {
    // Sloučení sázek pro zobrazení
    const aggregatedBets = {};
    myBets.forEach(b => {
      if (!aggregatedBets[b.day]) aggregatedBets[b.day] = 0;
      aggregatedBets[b.day] += b.amount;
    });

    Object.keys(aggregatedBets).forEach(day => {
      const li = document.createElement('li');
      li.className = 'flex justify-between items-center bg-gray-900 p-3 rounded-md border border-gray-700 shadow-sm';
      li.innerHTML = `
        <span class="text-gray-300">Sázka na <span class="${daysConfig[day].color} font-bold">${daysConfig[day].name}</span></span> 
        <span class="font-bold text-accent">${aggregatedBets[day]} UC</span>
      `;
      list.appendChild(li);
    });
  }

  // 4. Správa zobrazení pro Admina
  if (state.users[currentUser].role === 'admin') {
    document.getElementById('adminPanelToggle').classList.remove('hidden-view');

    // Obnovení seznamu uživatelů v admin panelu, pokud je panel zrovna otevřený (nebo na pozadí)
    const select = document.getElementById('adminUserSelect');
    // Uchováme si aktuálně vybranou hodnotu, aby nemizela při překreslení
    const currentVal = select.value;
    select.innerHTML = '';

    Object.keys(state.users).forEach(u => {
      const option = document.createElement('option');
      option.value = u;
      option.textContent = `${u} (Zůstatek: ${Math.floor(state.users[u].balance)} UC)`;
      select.appendChild(option);
    });
    if (currentVal && state.users[currentVal]) select.value = currentVal;

  } else {
    document.getElementById('adminPanelToggle').classList.add('hidden-view');
    document.getElementById('adminView').classList.add('hidden-view');
  }
}

// --- Event Listenery ---

// Přihlášení / Registrace
document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('usernameInput');
  const name = nameInput.value.trim();
  if (!name) return;

  // Speciální pravidlo pro admina
  if (name.toLowerCase() === 'admin' || name.toLowerCase() === 'banker') {
    const pwd = prompt('🔒 Zadej heslo bankéře:');
    if (pwd !== ADMIN_PASSWORD) {
      alert('❌ Špatné heslo!');
      return;
    }
  }

  // Pokud uživatel neexistuje, založíme mu účet se startovním kreditem
  if (!state.users[name]) {
    state.users[name] = {
      balance: 100,
      lastBonus: 0,
      role: (name.toLowerCase() === 'admin' || name.toLowerCase() === 'banker') ? 'admin' : 'user'
    };
    saveState();
  }

  currentUser = name;
  nameInput.value = '';
  renderApp();
});

// Odhlášení
document.getElementById('logoutBtn').addEventListener('click', () => {
  currentUser = null;
  renderApp();
});

// Denní bonus
document.getElementById('dailyBonusBtn').addEventListener('click', () => {
  claimBonus();
});

// Zobrazení / Skrytí admin panelu
document.getElementById('showAdminBtn').addEventListener('click', () => {
  const adminView = document.getElementById('adminView');
  adminView.classList.toggle('hidden-view');
});

// Admin: Připsání coinů
document.getElementById('adminAddCoinsBtn').addEventListener('click', () => {
  const user = document.getElementById('adminUserSelect').value;
  const amountInput = document.getElementById('adminCoinAmount');
  const amount = parseInt(amountInput.value);

  if (!user || isNaN(amount)) return alert('❌ Vyplň správně údaje (uživatel a částka).');

  state.users[user].balance += amount;
  saveState();
  amountInput.value = '';

  alert(`✅ Úspěšně připsáno ${amount} UC hráči ${user}.`);
  renderDashboard();
});

// Admin: Vyhodnocení týdne
document.getElementById('adminResolveBtn').addEventListener('click', () => {
  const day = document.getElementById('adminDaySelect').value;

  if (!confirm('⚠️ Opravdu chceš vyhodnotit týden? Tato akce rozdělí výhry, vymaže tikety a resetuje bank.')) return;

  if (day === 'none') {
    // Vracení vkladů (Test nebyl)
    state.bets.forEach(b => {
      state.users[b.user].balance += b.amount;
    });
    alert('😅 Test nebyl! Všechny vsazené coiny byly hráčům vráceny.');
  } else {
    // Vyplácení výher
    const finalOdds = calculateOdds(day);
    let totalPaid = 0;

    state.bets.forEach(b => {
      if (b.day === day) {
        const winnings = b.amount * parseFloat(finalOdds);
        state.users[b.user].balance += winnings;
        totalPaid += winnings;
      }
    });
    alert(`🎯 Vyhodnoceno! Test byl skutečně v den: ${daysConfig[day].name}.\n\nVýherní kurz byl ${finalOdds}.\nCelkem bylo vyplaceno ${Math.floor(totalPaid)} UC.`);
  }

  // Reset týdenních dat (pooly a sázky)
  state.pools = { tue: 100, wed: 100, thu: 100, fri: 100 };
  state.bets = [];
  saveState();
  renderDashboard();
});

// Spuštění po načtení
renderApp();
