// api.js
const API_BASE_URL = 'https://mini.jellypo.pe.kr/be';

export async function fetchBacktestData(params) {
    const response = await fetch(`${API_BASE_URL}/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
}

export async function searchSymbols(query) {
    const response = await fetch(`${API_BASE_URL}/search-symbols?q=${query}`);
    if (!response.ok) { throw new Error('Search API request failed'); }
    return response.json();
}

export async function fetchSymbolDetails(symbols) {
    const response = await fetch(`${API_BASE_URL}/symbol-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: symbols })
    });
    if (!response.ok) { throw new Error('Symbol details request failed'); }
    return response.json();
}

