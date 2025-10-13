// ui.js
let myChart = null;

// --- DOM Element Selectors ---
const statusEl = document.getElementById('status');
const chartTitleEl = document.getElementById('chartTitle');
const holdingsContainer = document.querySelector('.holdings-container');
const holdingsTableHead = document.getElementById('holdingsTableHeader');
const holdingsTableBody = document.getElementById('holdingsTableBody');
const rollingContainer = document.querySelector('.rolling-returns-container');
const rollingTableBody = document.getElementById('rollingReturnsTableBody');
const rollingSummaryDiv = document.getElementById('rollingReturnsSummary');
const logTableBody = document.getElementById('logTableBody');
const searchResults = document.getElementById('search-results');
const slidersContainer = document.getElementById('sliders-container');
const shareModal = document.getElementById('shareModal');
const shareUrlInput = document.getElementById('shareUrlInput');
const qrcodeContainer = document.getElementById('qrcode');


export function resetResultViews() {
    if (myChart) myChart.destroy();
    holdingsContainer.style.display = 'none';
    rollingContainer.style.display = 'none';
    logTableBody.innerHTML = '';
}

export function renderChart(responseData, portfolio) {
    if (responseData.error) {
        statusEl.textContent = `백엔드 오류: ${responseData.error}`;
        return;
    }
    const chartData = responseData.chart_data;
    const results = responseData.results;
    const assetTickers = results.length > 0 ? Object.keys(results[0].assets) : [];
    const colorPalette = ['rgba(255, 99, 132, 0.3)', 'rgba(54, 162, 235, 0.3)', 'rgba(255, 206, 86, 0.3)', 'rgba(75, 192, 192, 0.3)', 'rgba(153, 102, 255, 0.3)', 'rgba(255, 159, 64, 0.3)'];
    
    const nameMap = Object.fromEntries(portfolio.map(p => [p.symbol, p.name]));
    
    const weightDatasets = assetTickers.map((ticker, index) => {
        const displayName = nameMap[ticker] || ticker;
        return {
            label: `${displayName} (${ticker})`,
            data: results.map(r => r.assets[ticker].weight),
            fill: true, backgroundColor: colorPalette[index % colorPalette.length],
            borderColor: 'rgba(0,0,0,0)', yAxisID: 'y2', pointRadius: 0,
        };
    });

    const datasets = [
        { label: 'Portfolio Value', data: chartData.datasets.portfolio_value, borderColor: 'royalblue', yAxisID: 'y' },
        { label: 'Total Investment', data: chartData.datasets.total_investment, borderColor: 'red', borderDash: [5, 5], yAxisID: 'y' },
        ...weightDatasets,
        { label: 'ROI', data: chartData.datasets.roi, borderColor: 'green', yAxisID: 'y1', type: 'line', fill: false }
    ];

    const config = {
        type: 'line', data: { labels: chartData.labels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: {
                y: { type: 'logarithmic', position: 'left', display: true, title: { display: true, text: 'Amount (Log Scale)' }},
                y1: { type: 'linear', position: 'right', display: true, title: { display: true, text: 'ROI (%)' }, ticks: { callback: value => (value * 100).toFixed(0) + '%' }, grid: { drawOnChartArea: false }},
                y2: { type: 'linear', position: 'right', stacked: true, display: false, min: 0, max: 1 }
            },
            plugins: { legend: { labels: { /* 모든 범례 표시 */ } } }
        }
    };
    const ctx = document.getElementById('backtestChart');
    if (myChart) { myChart.destroy(); }
    myChart = new Chart(ctx, config);
    chartTitleEl.innerText = '백테스트 결과';
}

export function renderHoldingsTable(results) {
    holdingsTableHead.innerHTML = ''; holdingsTableBody.innerHTML = '';
    if (!results || results.length === 0) { holdingsContainer.style.display = 'none'; return; }
    holdingsContainer.style.display = 'block';
    const tickers = Object.keys(results[0].assets);
    const headerRow = holdingsTableHead.insertRow();
    headerRow.insertCell().textContent = '날짜';
    headerRow.insertCell().textContent = '총 평가액';
    headerRow.insertCell().textContent = '수익률';
    headerRow.insertCell().textContent = '현금';
    tickers.forEach(ticker => {
        headerRow.insertCell().textContent = `${ticker} 보유수`;
        headerRow.insertCell().textContent = `${ticker} 평가액`;
    });
    results.forEach(record => {
        const row = holdingsTableBody.insertRow();
        const returnRate = (record.portfolio_value / record.total_investment) - 1;
        row.insertCell().textContent = record.date;
        row.insertCell().textContent = Math.round(record.portfolio_value).toLocaleString();
        row.insertCell().textContent = (returnRate * 100).toFixed(2) + '%';
        row.insertCell().textContent = Math.round(record.cash).toLocaleString();
        tickers.forEach(ticker => {
            const asset = record.assets[ticker];
            row.insertCell().textContent = asset.holdings;
            row.insertCell().textContent = Math.round(asset.value).toLocaleString();
        });
    });
}

export function renderRollingReturns(rollingData) {
    rollingTableBody.innerHTML = ''; rollingSummaryDiv.innerHTML = '';
    if (!rollingData || !rollingData.periods) { rollingContainer.style.display = 'none'; return; }
    rollingContainer.style.display = 'block';
    rollingData.periods.forEach(period => {
        const row = rollingTableBody.insertRow();
        row.insertCell().textContent = period.start;
        row.insertCell().textContent = period.end;
        row.insertCell().textContent = (period.cagr * 100).toFixed(2) + '%';
    });
    rollingSummaryDiv.innerHTML = `<p>평균 CAGR: ${(rollingData.average_cagr * 100).toFixed(2)}% | 최소 CAGR: ${(rollingData.min_cagr * 100).toFixed(2)}% | 최대 CAGR: ${(rollingData.max_cagr * 100).toFixed(2)}% | 표준편차: ${(rollingData.stdev_cagr * 100).toFixed(2)}%</p>`;
}

export function renderLogs(logs, portfolio = []) {
    logTableBody.innerHTML = '';
    if (!logs || !Array.isArray(logs)) return;

    const nameMap = Object.fromEntries(portfolio.map(p => [p.symbol, p.name]));

    logs.forEach(log => {
        const row = logTableBody.insertRow();
        const cellDate = row.insertCell(), cellType = row.insertCell(), cellDetails = row.insertCell();
        cellDate.textContent = log.date || '';
        let typeText = log.type, detailsText = log.message || '';
        
        if (log.type === 'DEPOSIT') {
            typeText = '입금'; detailsText = `추가 투자금 ${log.amount.toLocaleString()} 입금`;
        } else if (log.type === 'TRANSACTION') {
            typeText = '거래';
            const actionMap = {'BUY': '매수', 'SELL_ALL': '전량 매도', 'SELL_ADJUST': '비중조절 매도', 'PERIODIC_BUY': '추가 매수', 'SWEEP_BUY': '잔여 현금 매수', 'INITIAL_BUY': '초기 매수'};
            const action = actionMap[log.action] || log.action;
            detailsText = `${log.ticker}: ${log.shares}주 ${action} (비용: ${log.amount.toLocaleString()}, 수수료/비용: ${log.fee.toFixed(2)})`;
        } else if (log.type === 'DIVIDEND') {
            typeText = '배당';
            const name = nameMap[log.ticker] || log.ticker;
            detailsText = `${name}: ${log.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        } else if (log.type === 'INFO') {
            typeText = '정보';
        }
        cellType.textContent = typeText; cellDetails.textContent = detailsText;
    });
}

export function renderSearchResults(data, onResultClick) {
    searchResults.innerHTML = '';
    if (!data) { searchResults.innerHTML = '<li>검색 결과가 없습니다.</li>'; return; }
    data.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.Name} (${item.Symbol})`;
        li.addEventListener('click', () => onResultClick(item));
        searchResults.appendChild(li);
    });
}

export function renderSliders(portfolio, eventHandlers) {
    slidersContainer.innerHTML = '';
    portfolio.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'slider-item';
        const weightPercent = (item.weight * 100).toFixed(1);
        itemDiv.innerHTML = `
            <span title="${item.name} (${item.symbol})">${item.name}</span>
            <input type="range" min="0" max="100" value="${weightPercent}" step="0.1" data-index="${index}">
            <div style="position: relative; display: flex; align-items: center;">
                <input type="number" min="0" max="100" value="${weightPercent}" step="0.1" data-index="${index}">
                <span class="percent-sign">%</span>
            </div>
            <button data-index="${index}">X</button>
        `;
        slidersContainer.appendChild(itemDiv);
    });
    document.querySelectorAll('.slider-item input[type="range"]').forEach(s => s.addEventListener('input', eventHandlers.onSliderChange));
    document.querySelectorAll('.slider-item input[type="number"]').forEach(i => i.addEventListener('change', eventHandlers.onInputChange));
    document.querySelectorAll('.slider-item button').forEach(b => b.addEventListener('click', eventHandlers.onRemoveItem));
}

export function showShareModal(url) {
    shareUrlInput.value = url;
    shareModal.style.display = 'flex';
    qrcodeContainer.innerHTML = '';
    new window.QRCode(qrcodeContainer, { text: url, width: 128, height: 128, correctLevel: window.QRCode.CorrectLevel.L });
}

export function toggleModal(show) {
    shareModal.style.display = show ? 'flex' : 'none';
}

export function copyShareUrl() {
    shareUrlInput.select();
    document.execCommand('copy');
    alert('공유 URL이 복사되었습니다!');
}

export function showInitialExample() {
    const examplePortfolio = [{symbol:'SPY', name:'SPY'}, {symbol:'AGG', name:'AGG'}];
    const exampleData = {
        "summary": { "final_portfolio_value": 150000, "total_investment": 50000, "final_roi": 2.00, "mdd": {"percentage": -0.25, "peak_date": "2022-01-01", "trough_date": "2022-06-30", "peak_value": 120000, "trough_value": 90000}, "rolling_returns": null },
        "logs": [ 
            {"date": "2020-01-31", "type": "INFO", "message": "예시 데이터입니다. 옵션을 설정하고 백테스트를 실행하세요."},
            {"date": "2022-03-15", "type": "DIVIDEND", "ticker": "SPY", "amount": 150.75}
        ],
        "results": [
            { "date": "2020-01-31", "portfolio_value": 9984.90, "total_investment": 10000, "roi": -0.0015, "cash": 15.10, "assets": { "SPY": {"holdings": 20, "price": 300, "value": 6000, "weight": 0.601}, "AGG": {"holdings": 36, "price": 110, "value": 3960, "weight": 0.399} } },
            { "date": "2024-12-31", "portfolio_value": 150000, "total_investment": 50000, "roi": 2.00, "cash": 1000, "assets": { "SPY": {"holdings": 150, "price": 600, "value": 90000, "weight": 0.60}, "AGG": {"holdings": 500, "price": 120, "value": 60000, "weight": 0.40} } }
        ],
        "chart_data": {
            "labels": ["2020-01-31", "2024-12-31"],
            "datasets": { "portfolio_value": [9984.90, 150000], "total_investment": [10000, 50000], "roi": [-0.0015, 2.0] }
        }
    };
    renderChart(exampleData, examplePortfolio);
    renderHoldingsTable(exampleData.results);
    renderLogs(exampleData.logs, examplePortfolio);
    rollingContainer.style.display = 'none';
    statusEl.textContent = '예시 데이터입니다. 옵션을 설정하고 백테스트를 실행하세요.';
}

