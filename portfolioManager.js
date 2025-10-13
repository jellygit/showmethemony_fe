// portfolioManager.js
let portfolio = [];
let isUpdating = false;

export function getPortfolio() { return portfolio; }

export function initializePortfolio() {
    // 저장/공유 기능이 없으므로, 기본값만 설정
    portfolio = [
        { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', weight: 0.6 },
        { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', weight: 0.2 },
        { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', weight: 0.2 }
    ];
}

export function addStock(item) {
    if (portfolio.find(p => p.symbol === item.Symbol)) {
        alert("이미 추가된 종목입니다."); return false;
    }
    portfolio.push({ symbol: item.Symbol, name: item.Name, weight: 0 });
    rebalanceWeights();
    return true;
}

export function removeStock(index) {
    portfolio.splice(index, 1);
    rebalanceWeights();
}

export function updateWeight(changedIndex, newWeight) {
    if (isUpdating) return;
    isUpdating = true;
    const changedItem = portfolio[changedIndex];
    const oldWeight = changedItem.weight;
    newWeight = Math.max(0, Math.min(1, newWeight));
    const delta = newWeight - oldWeight;
    changedItem.weight = newWeight;
    const otherItems = portfolio.filter((_, i) => i !== changedIndex);
    const otherTotalWeight = otherItems.reduce((sum, p) => sum + p.weight, 0);
    if (otherTotalWeight > 0) {
        otherItems.forEach(item => { item.weight -= delta * (item.weight / otherTotalWeight); });
    }
    normalizeWeights();
    isUpdating = false;
}

function rebalanceWeights() {
    if (portfolio.length > 0) {
        const equalWeight = 1 / portfolio.length;
        portfolio.forEach(p => p.weight = equalWeight);
    }
}

function normalizeWeights() {
    const total = portfolio.reduce((sum, p) => sum + Math.max(0, p.weight), 0);
    if (total > 0) {
        portfolio.forEach(p => p.weight = Math.max(0, p.weight) / total);
    }
}

