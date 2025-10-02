// --- DEFINIÇÃO DAS CARTAS ---
const allCards = [
    { id: 1, name: "Salário", type: "renda", description: "Aumenta sua Renda por Rodada em $200.", cost: 0, value: 200, copies: 4 },
    { id: 2, name: "Trabalho Freelancer", type: "renda", description: "Ganho imediato de $300.", cost: 0, value: 300, copies: 4 },
    { id: 3, name: "Contas Fixas", type: "despesa", description: "Pague $400 para as contas básicas do mês.", cost: 400, copies: 4 },
    { id: 4, name: "Imprevisto: Reparo", type: "despesa", description: "Seu celular quebrou! Pague $250.", cost: 250, copies: 3 },
    { id: 5, name: "Poupança Segura", type: "investimento", description: "Aumenta sua Renda em $50/rodada.", cost: 500, income: 50, copies: 4 },
    { id: 6, name: "Ações de Tecnologia", type: "investimento", description: "Aumenta sua Renda em $150/rodada.", cost: 1000, income: 150, copies: 3 },
    { id: 7, name: "Crise Econômica", type: "acao", effect: "global_damage", description: "O mercado virou! Todos os outros jogadores perdem $300.", cost: 100, value: 300, copies: 2 },
    { id: 8, name: "Imposto sobre Riqueza", type: "acao", effect: "target_richest", description: "Cobre $400 do jogador com maior patrimônio (além de você).", cost: 50, value: 400, copies: 2 },
    { id: 9, name: "Auditoria Surpresa", type: "acao", effect: "target_discard", description: "Escolha um oponente. Ele é forçado a descartar uma carta aleatória da mão.", cost: 150, copies: 2 },
    { id: 10, name: "Oportunidade de Mercado", type: "evento", effect: "market_opportunity", description: "Uma startup busca investimento. Você pode investir com cautela para um ganho certo de $300, ou investir pesado com 50% de chance de ganhar $1500 ou perder $700.", copies: 2 },
];

// --- VARIÁVEIS DO JOGO ---
let players = [], deck = [], discardPile = [], currentPlayerIndex = 0, actionsLeft = 0, targetingInfo = null;
const WINNING_ASSETS = 5000, DEBT_TURNS_LIMIT = 2;

// --- ELEMENTOS DA UI ---
const ui = {
    board: document.getElementById('game-board'), setupModal: document.getElementById('setup-modal'), turnModal: document.getElementById('turn-modal'), winModal: document.getElementById('win-modal'), eventModal: document.getElementById('event-modal'),
    playerInputs: document.getElementById('player-inputs'), money: document.getElementById('money-display'), income: document.getElementById('income-display'), assets: document.getElementById('assets-display'),
    hand: document.getElementById('player-hand'), investments: document.getElementById('investments-area'), log: document.getElementById('game-log'), actions: document.getElementById('actions-left'),
    scoreboard: document.getElementById('scoreboard-area'), turnTitle: document.getElementById('turn-title'), winTitle: document.getElementById('win-title'), winMessage: document.getElementById('win-message'),
    eventTitle: document.getElementById('event-title'), eventDescription: document.getElementById('event-description'), eventSafeBtn: document.getElementById('event-safe-btn'), eventRiskyBtn: document.getElementById('event-risky-btn'),
};

// --- FUNÇÕES DE CONFIGURAÇÃO ---
window.onload = () => createPlayerInputs(2);
function createPlayerInputs(count) {
    ui.playerInputs.innerHTML = '';
    for (let i = 1; i <= count; i++) ui.playerInputs.innerHTML += `<input type="text" id="player-name-${i}" placeholder="Nome do Jogador ${i}">`;
}

function initializeGame() {
    const playerCount = document.getElementById('player-count').value;
    players = [];
    for (let i = 1; i <= playerCount; i++) {
        const name = document.getElementById(`player-name-${i}`).value || `Jogador ${i}`;
        players.push({ name, money: 1000, income: 0, hand: [], investments: [] });
    }
    deck = [];
    allCards.forEach(cardDef => {
        for(let i=0; i < cardDef.copies; i++) deck.push({...cardDef, uniqueId: `${cardDef.id}_${i}_${Math.random()}`});
    });
    shuffleDeck();
    players.forEach(p => { for(let i=0; i<4; i++) drawCardForPlayer(p, false); });
    ui.setupModal.style.display = 'none'; ui.board.style.display = 'grid'; showTurnModal();
}

// --- FLUXO DE TURNO ---
function showTurnModal() { ui.turnTitle.textContent = `Turno de ${players[currentPlayerIndex].name}`; ui.turnModal.style.display = 'flex'; }

function startTurn() {
    ui.turnModal.style.display = 'none'; actionsLeft = 2;
    const currentPlayer = players[currentPlayerIndex];
    
    const debtsToPay = [];
    currentPlayer.hand.forEach(card => { if(card.type === 'despesa' && card.debtTurns > DEBT_TURNS_LIMIT) debtsToPay.push(card); });
    debtsToPay.forEach(card => {
        const penalty = Math.ceil(card.cost * 1.30);
        currentPlayer.money -= penalty;
        logMessage(`${currentPlayer.name} não pagou "${card.name}" a tempo! Juros de 30% aplicados. Perdeu $${penalty}.`, 'red');
        discardPile.push(currentPlayer.hand.splice(currentPlayer.hand.findIndex(c => c.uniqueId === card.uniqueId), 1)[0]);
    });

    const incomeGained = currentPlayer.income;
    currentPlayer.money += incomeGained;
    logMessage(`<strong>Rodada de ${currentPlayer.name}!</strong>` + (incomeGained > 0 ? ` Renda de $${incomeGained} recebida.` : ''));
    
    drawCardForPlayer(currentPlayer, true);
}

function endTurn() {
    if (calculateAssets(players[currentPlayerIndex]) >= WINNING_ASSETS) { endGame(true); return; }
    players[currentPlayerIndex].hand.forEach(card => {
        if(card.type === 'despesa') {
            card.debtTurns = (card.debtTurns || 0) + 1;
            if (card.debtTurns > DEBT_TURNS_LIMIT) logMessage(`Atenção: A despesa "${card.name}" irá cobrar juros no seu próximo turno!`, 'orange');
        }
    });
    targetingInfo = null; currentPlayerIndex = (currentPlayerIndex + 1) % players.length; showTurnModal();
}

function endGame(didWin) {
    if (didWin) { ui.winTitle.textContent = `Parabéns, ${players[currentPlayerIndex].name}!`; ui.winMessage.textContent = `Você alcançou $${calculateAssets(players[currentPlayerIndex])} de patrimônio e venceu!`; }
    ui.winModal.style.display = 'flex';
}

// --- LÓGICA DE CARTAS ---
function shuffleDeck() { for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } }

function drawCardForPlayer(player, log = true) {
    if (deck.length === 0) {
        if (discardPile.length === 0) { if (log) logMessage("Não há mais cartas para comprar.", "red"); updateUI(); return; }
        if (log) logMessage("Deck vazio! Embaralhando descarte...", "orange"); deck = [...discardPile]; discardPile = []; shuffleDeck();
    }
    if (deck.length === 0) { if (log) logMessage("Não há mais cartas para comprar.", "red"); updateUI(); return; }

    const drawnCard = deck.pop();
    if (drawnCard.type === 'evento') {
        if (log) logMessage(`${player.name} encontrou uma "${drawnCard.name}"!`, 'purple');
        triggerMarketOpportunity(drawnCard);
    } else {
        player.hand.push(drawnCard);
        if (log) logMessage(`${player.name} comprou uma carta.`);
        updateUI(true);
    }
}

function playCard(cardElement, cardUniqueId) {
    if (actionsLeft <= 0 || cardElement.classList.contains('disabled')) return;
    const currentPlayer = players[currentPlayerIndex]; const cardIndex = currentPlayer.hand.findIndex(c => c.uniqueId === cardUniqueId);
    if (cardIndex === -1) return; const card = currentPlayer.hand[cardIndex];
    
    actionsLeft--; const moneyBefore = currentPlayer.money; currentPlayer.money -= card.cost;
    logMessage(`${currentPlayer.name} jogou "${card.name}".`);

    let requiresTargeting = false;
    switch (card.type) {
        case "renda": if (card.name === "Salário") currentPlayer.income += card.value; else if (card.name === "Trabalho Freelancer") currentPlayer.money += card.value; break;
        case "investimento": currentPlayer.investments.push(card); currentPlayer.income += card.income; break;
        case "acao": handleActionCard(card, currentPlayerIndex); if (targetingInfo) requiresTargeting = true; break;
    }

    if (requiresTargeting) { updateUI(); return; }
    
    cardElement.classList.add('card-exit');
    setTimeout(() => {
        const finalCardIndex = currentPlayer.hand.findIndex(c => c.uniqueId === cardUniqueId);
        if (finalCardIndex > -1) discardPile.push(currentPlayer.hand.splice(finalCardIndex, 1)[0]);
        updateUI(false, currentPlayer.money > moneyBefore - card.cost, currentPlayer.money < moneyBefore - card.cost);
    }, 400);
}

function handleActionCard(card, casterIndex) {
    const caster = players[casterIndex];
    switch (card.effect) {
        case 'global_damage': players.forEach((p, index) => { if (index !== casterIndex) { p.money = Math.max(0, p.money - card.value); logMessage(`${p.name} perdeu $${card.value}!`, 'orange'); } }); break;
        case 'target_richest':
             let richest = { index: -1, assets: -1 }; players.forEach((p, i) => { if (i !== casterIndex) { const a = calculateAssets(p); if (a > richest.assets) richest = { index: i, assets: a }; } });
             if (richest.index !== -1) { players[richest.index].money = Math.max(0, players[richest.index].money - card.value); caster.money += card.value; logMessage(`${caster.name} cobrou imposto de ${players[richest.index].name}!`, 'green'); }
             else { logMessage("Nenhum oponente elegível.", "blue"); } break;
        case 'target_discard': targetingInfo = { card, casterIndex: casterIndex }; logMessage(`${caster.name}, selecione um oponente.`, "blue"); break;
    }
}

function selectTarget(targetIndex) {
    if (!targetingInfo || targetIndex === targetingInfo.casterIndex) return;
    const { card, casterIndex } = targetingInfo; const target = players[targetIndex]; const caster = players[casterIndex];
    logMessage(`${caster.name} usou "${card.name}" em ${target.name}.`);
    if (card.effect === 'target_discard') {
        if (target.hand.length > 0) { const discarded = target.hand.splice(Math.floor(Math.random() * target.hand.length), 1)[0]; discardPile.push(discarded); logMessage(`${target.name} descartou "${discarded.name}".`, 'orange'); }
        else { logMessage(`${target.name} não tem cartas.`, 'blue'); }
    }
    const cardIndex = caster.hand.findIndex(c => c.uniqueId === card.uniqueId);
    if (cardIndex > -1) discardPile.push(caster.hand.splice(cardIndex, 1)[0]);
    targetingInfo = null; updateUI();
}

// --- LÓGICA DE EVENTOS ---
function triggerMarketOpportunity(card) {
    ui.eventTitle.textContent = card.name;
    ui.eventDescription.textContent = "Uma startup de tecnologia busca investimento. A aposta é arriscada, mas o potencial é enorme!";
    ui.eventSafeBtn.textContent = "Investir com Cautela (Ganha $300)";
    ui.eventRiskyBtn.textContent = "Investir Pesado! (50% de chance)";
    ui.eventSafeBtn.onclick = () => resolveMarketOpportunity(card, 'safe');
    ui.eventRiskyBtn.onclick = () => resolveMarketOpportunity(card, 'risky');
    ui.eventModal.style.display = 'flex';
}

function resolveMarketOpportunity(card, choice) {
    const player = players[currentPlayerIndex];
    let gain = 0, loss = 0;
    if (choice === 'safe') {
        gain = 300; player.money += gain; logMessage(`${player.name} investiu com cautela e ganhou $${gain}.`, 'green');
    } else {
        if (Math.random() < 0.5) { gain = 1500; player.money += gain; logMessage(`SUCESSO! ${player.name} investiu pesado e ganhou $${gain}!`, 'gold'); }
        else { loss = 700; player.money = Math.max(0, player.money - loss); logMessage(`FRACASSO! ${player.name} investiu pesado e perdeu $${loss}!`, 'red'); }
    }
    discardPile.push(card); ui.eventModal.style.display = 'none'; updateUI(false, gain > 0, loss > 0);
}

// --- FUNÇÕES AUXILIARES E DE UI ---
function calculateAssets(player) { return player.money + player.investments.reduce((sum, inv) => sum + inv.cost, 0); }
function logMessage(message, color = 'black') { const p = document.createElement('p'); p.style.color = color; p.innerHTML = message; ui.log.prepend(p); }

function updateUI(isNewTurn = false, highlightGain = false, highlightLoss = false) {
    const currentPlayer = players[currentPlayerIndex];
    if(highlightGain) { ui.money.classList.add('highlight-up'); ui.assets.classList.add('highlight-up'); }
    if(highlightLoss) { ui.money.classList.add('highlight-down'); ui.assets.classList.add('highlight-down'); }
    setTimeout(() => { ui.money.classList.remove('highlight-up', 'highlight-down'); ui.assets.classList.remove('highlight-up', 'highlight-down'); }, 500);

    ui.money.textContent = `$${currentPlayer.money}`; ui.income.textContent = `$${currentPlayer.income}`; ui.assets.textContent = `$${calculateAssets(currentPlayer)}`; ui.actions.textContent = `Ações: ${actionsLeft}`;
    
    ui.hand.innerHTML = '';
    currentPlayer.hand.forEach((card, index) => {
        const cardElement = createCardElement(card);
        if (card.cost > currentPlayer.money || actionsLeft <= 0) cardElement.classList.add('disabled'); else cardElement.classList.add('playable');
        if(isNewTurn) cardElement.style.animationDelay = `${index * 100}ms`;
        ui.hand.appendChild(cardElement);
    });

    ui.investments.innerHTML = '<h3>Investimentos</h3>';
    if (currentPlayer.investments.length === 0) ui.investments.innerHTML += '<p style="font-size:0.9em; color:#666;">Nenhum.</p>';
    else currentPlayer.investments.forEach(card => ui.investments.appendChild(createCardElement(card, false)));
    
    ui.scoreboard.innerHTML = '<h2>Jogadores</h2>';
    players.forEach((p, i) => {
        const pDiv = document.createElement('div'); pDiv.className = 'player-info';
        if (i === currentPlayerIndex) pDiv.classList.add('active');
        if (targetingInfo && i !== targetingInfo.casterIndex) { pDiv.classList.add('targetable'); pDiv.onclick = () => selectTarget(i); }
        pDiv.innerHTML = `<h3>${p.name}</h3><p>Patrimônio: $${calculateAssets(p)}</p><p>Dinheiro: $${p.money}</p><p>Renda: $${p.income}</p><p>Cartas: ${p.hand.length}</p>`;
        ui.scoreboard.appendChild(pDiv);
    });
}

function createCardElement(card, isPlayable = true) {
    const el = document.createElement('div'); el.className = `card ${card.type} card-enter`;
    if (isPlayable) el.onclick = () => playCard(el, card.uniqueId);
    el.innerHTML = `<div class="card-title">${card.name}</div><div class="card-description">${card.description}</div><div class="card-cost">${card.cost > 0 ? `Custo: $${card.cost}` : ''}</div>`;
    return el;
}