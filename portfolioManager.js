// portfolioManager.js
import { fetchSymbolDetails } from './api.js';

let portfolio = []; // {symbol, name, weight}
let isUpdating = false;

export function getPortfolio() { return portfolio; }

export async function initializePortfolio() {
    const urlParams = new URLSearchParams(window.location.search);
    const portfolioParam = urlParams.get('p');

    if (portfolioParam) {
        try {
            const decoded = decodeURIComponent(window.atob(portfolioParam));
            const sharedPortfolio = JSON.parse(decoded);
            const symbols = sharedPortfolio.map(item => item.s);
            if (symbols.length > 0) {
                const details = await fetchSymbolDetails(symbols);
                const detailMap = Object.fromEntries(details.map(d => [d.Symbol, d.Name]));
                portfolio = sharedPortfolio.map(item => ({
                    symbol: item.s,
                    name: detailMap[item.s] || item.s,
                    weight: item.w
                }));
                console.log("포트폴리오를 URL에서 복원했습니다.");
                return;
            }
        } catch (e) {
            console.error("URL 파라미터 파싱/복원 오류:", e);
        }
    }
    // URL 파라미터가 없거나 실패 시 localStorage에서 로드
    loadPortfolio();
}

export function loadPortfolio() {
    const saved = localStorage.getItem('myPortfolio');
    if (saved) {
        portfolio = JSON.parse(saved);
        console.log("저장된 포트폴리오를 불러왔습니다.");
    } else {
        // 저장된 포트폴리오가 없으면 기본값 사용
        portfolio = [
            { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', weight: 0.6 },
            { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', weight: 0.2 },
            { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', weight: 0.2 }
        ];
        console.log("기본 포트폴리오를 로드합니다.");
    }
}

export function addStock(item) {
    if (portfolio.find(p => p.symbol === item.Symbol)) {
        alert("이미 추가된 종목입니다."); return false;
    }
    portfolio.push({ symbol: item.Symbol, name: item.Name, weight: 0 });
    rebalanceWeights();
    savePortfolio(false); // 자동 저장 (알림 없음)
    return true;
}

export function removeStock(index) {
    portfolio.splice(index, 1);
    rebalanceWeights();
    savePortfolio(false);
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
    savePortfolio(false);
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

export function savePortfolio(showAlert = true) {
    if(portfolio.length > 0) {
        localStorage.setItem('myPortfolio', JSON.stringify(portfolio));
        if(showAlert) alert('현재 포트폴리오가 브라우저에 저장되었습니다.');
    } else {
        if(showAlert) alert('저장할 포트폴리오가 없습니다.');
    }
}

export function generateShareUrl() {
    if (portfolio.length === 0) return null;
    const shortPortfolio = portfolio.map(p => ({ s: p.symbol, w: p.weight }));
    const encoded = window.btoa(encodeURIComponent(JSON.stringify(shortPortfolio)));
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('p', encoded);
    return url.href;
}

