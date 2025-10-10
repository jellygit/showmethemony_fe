// script.js
document.addEventListener('DOMContentLoaded', function() {
    let myChart = null;
    let portfolio = [];
    let isUpdating = false;

    // --- [신규] 예시 데이터를 담고 있는 함수 ---
    function getExampleData() {
        return {
            "summary": {
                "final_portfolio_value": 150000.00, "total_investment": 50000.00, "final_roi": 2.00,
                "mdd": {"percentage": -0.25, "peak_date": "2022-01-01", "trough_date": "2022-06-30", "peak_value": 120000, "trough_value": 90000},
                "rolling_returns": null
            },
            "logs": [
                {"date": "2020-01-31", "type": "TRANSACTION", "action": "INITIAL_BUY", "ticker": "SPY", "shares": 20, "price": 300, "amount": 6000, "fee": 15},
                {"date": "2020-01-31", "type": "TRANSACTION", "action": "INITIAL_BUY", "ticker": "AGG", "shares": 36, "price": 110, "amount": 3960, "fee": 9.9}
            ],
            "results": [
                {
                    "date": "2020-01-31", "portfolio_value": 9984.90, "total_investment": 10000, "roi": -0.0015, "cash": 15.10,
                    "assets": {
                        "SPY": {"holdings": 20, "price": 300, "value": 6000, "weight": 0.601},
                        "AGG": {"holdings": 36, "price": 110, "value": 3960, "weight": 0.399}
                    }
                },
                // ... (실제 데이터는 더 많겠지만 예시를 위해 축약)
                {
                    "date": "2024-12-31", "portfolio_value": 150000, "total_investment": 50000, "roi": 2.00, "cash": 1000,
                     "assets": {
                        "SPY": {"holdings": 150, "price": 600, "value": 90000, "weight": 0.60},
                        "AGG": {"holdings": 500, "price": 120, "value": 60000, "weight": 0.40}
                    }
                }
            ],
            "chart_data": {
                "labels": ["2020-01-31", "2020-02-29", "...", "2024-12-31"],
                "datasets": {
                    "portfolio_value": [9984.90, 10500, 120000, 150000],
                    "total_investment": [10000, 11000, 49000, 50000],
                    "roi": [-0.0015, 0.05, 1.4, 2.0]
                }
            }
        };
    }

    // --- [신규] 초기 예시 차트를 렌더링하는 함수 ---
    function showInitialExample() {
        const exampleData = getExampleData();
        renderChart(exampleData);
        renderHoldingsTable(exampleData.results);
        renderLogs(exampleData.logs);
        // 예시에서는 롤링 리턴은 숨김 처리
        document.querySelector('.rolling-returns-container').style.display = 'none';
        document.getElementById('status').textContent = '예시 데이터입니다. 옵션을 설정하고 백테스트를 실행하세요.';
    }

    // --- 페이지 로드 시 실행 ---
    showInitialExample(); // 페이지가 로드되면 예시 차트를 바로 보여줍니다.
    
    // --- (이하 코드는 이전과 동일) ---

    const backtestForm = document.getElementById('backtestForm');
    const searchInput = document.getElementById('symbolSearch');
    
    // 초기 슬라이더 설정
    portfolio = [
        { ticker: '133690', weight: 0.6 },
        { ticker: '102110', weight: 0.2 },
        { ticker: '005930', weight: 0.2 }
    ];
    renderSliders();
    
    backtestForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const submitButton = document.getElementById('submitButton');
        const statusEl = document.getElementById('status');
        
        const stocks = portfolio.flatMap(p => [p.ticker, p.weight.toFixed(4)]);
        const rollingWindowInput = document.getElementById('rolling_window').value;

        const backtestParams = {
            capital: parseFloat(document.getElementById('capital').value),
            start_date: document.getElementById('start_date').value,
            end_date: document.getElementById('end_date').value || null,
            strategy: document.getElementById('strategy').value,
            interval: document.getElementById('interval').value,
            periodic_investment: parseFloat(document.getElementById('periodic_investment').value),
            no_rebalance: document.getElementById('no_rebalance').checked,
            stocks: stocks.length > 0 ? stocks : null,
            rolling_window: rollingWindowInput ? parseInt(rollingWindowInput, 10) : null,
            rolling_step: document.getElementById('rolling_step').value
        };
        
        submitButton.disabled = true;
        statusEl.textContent = '백엔드 서버에서 데이터를 계산 중입니다...';
        if (myChart) { myChart.destroy(); }
        document.getElementById('logTableBody').innerHTML = '';
        document.querySelector('.rolling-returns-container').style.display = 'none';
        document.querySelector('.holdings-container').style.display = 'none';
        try {
            const apiUrl = 'https://mini.jellypo.pe.kr/be/backtest';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backtestParams)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }
            const responseData = await response.json();
            renderChart(responseData);
            renderHoldingsTable(responseData.results);
            renderLogs(responseData.logs);
            renderRollingReturns(responseData.summary.rolling_returns);
            statusEl.textContent = '백테스트 완료!';
        } catch (error) {
            console.error('Error fetching backtest data:', error);
            statusEl.textContent = `오류 발생: ${error.message}`;
        } finally {
            submitButton.disabled = false;
        }
    });
    
    searchInput.addEventListener('input', async function(event) {
        const query = event.target.value;
        const searchResults = document.getElementById('search-results');
        if (query.length < 2) {
            searchResults.innerHTML = '';
            return;
        }
        try {
            const searchUrl = `https://mini.jellypo.pe.kr/be/search-symbols?q=${query}`;
            const response = await fetch(searchUrl);
            if (!response.ok) { throw new Error('Search API request failed'); }
            const data = await response.json();
            searchResults.innerHTML = '';
            data.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `${item.Name} (${item.Symbol})`;
                li.addEventListener('click', function() {
                    const symbolToAdd = item.Symbol;
                    if (portfolio.find(p => p.ticker === symbolToAdd)) {
                        alert("이미 추가된 종목입니다."); return;
                    }
                    portfolio.push({ ticker: symbolToAdd, weight: 0 });
                    const equalWeight = 1 / portfolio.length;
                    portfolio.forEach(p => p.weight = equalWeight);
                    renderSliders();
                    searchResults.innerHTML = ''; 
                    searchInput.value = '';
                });
                searchResults.appendChild(li);
            });
        } catch (error) {
            console.error('Error searching symbols:', error);
            searchResults.innerHTML = '<li>검색 중 오류 발생</li>';
        }
    });

    function renderSliders() {
        const container = document.getElementById('sliders-container');
        container.innerHTML = '';
        portfolio.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'slider-item';
            const weightPercent = (item.weight * 100).toFixed(1);
            itemDiv.innerHTML = `
                <span>${item.ticker}</span>
                <input type="range" min="0" max="100" value="${weightPercent}" step="0.1" data-index="${index}">
                <div style="position: relative; display: flex; align-items: center;">
                    <input type="number" min="0" max="100" value="${weightPercent}" step="0.1" data-index="${index}">
                    <span class="percent-sign">%</span>
                </div>
                <button data-index="${index}">X</button>
            `;
            container.appendChild(itemDiv);
        });
        attachSliderEventListeners();
    }

    function attachSliderEventListeners() {
        document.querySelectorAll('.slider-item input[type="range"]').forEach(s => s.addEventListener('input', handleSliderChange));
        document.querySelectorAll('.slider-item input[type="number"]').forEach(i => i.addEventListener('change', handleInputChange));
        document.querySelectorAll('.slider-item button').forEach(b => b.addEventListener('click', handleRemoveItem));
    }

    function handleSliderChange(event) {
        if (isUpdating) return;
        const index = parseInt(event.target.dataset.index, 10);
        let newWeight = parseFloat(event.target.value) / 100;
        updateWeights(index, newWeight);
    }

    function handleInputChange(event) {
        if (isUpdating) return;
        const index = parseInt(event.target.dataset.index, 10);
        let newWeight = parseFloat(event.target.value) / 100;
        updateWeights(index, newWeight);
    }

    function handleRemoveItem(event) {
        const index = parseInt(event.target.dataset.index, 10);
        portfolio.splice(index, 1);
        if (portfolio.length > 0) {
            const totalWeight = portfolio.reduce((sum, p) => sum + p.weight, 0);
            portfolio.forEach(p => p.weight = p.weight / totalWeight);
        }
        renderSliders();
    }

    function updateWeights(changedIndex, newWeight) {
        isUpdating = true;
        const changedItem = portfolio[changedIndex];
        const oldWeight = changedItem.weight;
        newWeight = Math.max(0, Math.min(1, newWeight));
        const delta = newWeight - oldWeight;
        changedItem.weight = newWeight;
        const otherItems = portfolio.filter((_, index) => index !== changedIndex);
        const otherTotalWeight = otherItems.reduce((sum, p) => sum + p.weight, 0);
        if (otherTotalWeight > 0) {
            otherItems.forEach(item => {
                let adjustment = delta * (item.weight / otherTotalWeight);
                item.weight -= adjustment;
            });
        }
        const finalTotalWeight = portfolio.reduce((sum, p) => sum + Math.max(0, p.weight), 0);
        if(finalTotalWeight > 0) {
            portfolio.forEach(p => p.weight = Math.max(0, p.weight) / finalTotalWeight);
        }
        renderSliders();
        isUpdating = false;
    }
    
    function renderHoldingsTable(results) {
        const container = document.querySelector('.holdings-container');
        const tableHead = document.getElementById('holdingsTableHeader');
        const tableBody = document.getElementById('holdingsTableBody');
        tableHead.innerHTML = ''; tableBody.innerHTML = '';
        if (!results || results.length === 0) { container.style.display = 'none'; return; }
        container.style.display = 'block';
        const tickers = Object.keys(results[0].assets);
        const headerRow = tableHead.insertRow();
        headerRow.insertCell().textContent = '날짜';
        headerRow.insertCell().textContent = '총 평가액';
        headerRow.insertCell().textContent = '현금';
        tickers.forEach(ticker => {
            headerRow.insertCell().textContent = `${ticker} 보유수`;
            headerRow.insertCell().textContent = `${ticker} 평가액`;
        });
        results.forEach(record => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = record.date;
            row.insertCell().textContent = record.portfolio_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            row.insertCell().textContent = record.cash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            tickers.forEach(ticker => {
                const asset = record.assets[ticker];
                row.insertCell().textContent = asset.holdings;
                row.insertCell().textContent = asset.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            });
        });
    }

    function renderRollingReturns(rollingData) {
        const container = document.querySelector('.rolling-returns-container');
        const tableBody = document.getElementById('rollingReturnsTableBody');
        const summaryDiv = document.getElementById('rollingReturnsSummary');
        tableBody.innerHTML = ''; summaryDiv.innerHTML = '';
        if (!rollingData || !rollingData.periods) { container.style.display = 'none'; return; }
        container.style.display = 'block';
        rollingData.periods.forEach(period => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = period.start;
            row.insertCell().textContent = period.end;
            row.insertCell().textContent = (period.cagr * 100).toFixed(2) + '%';
        });
        summaryDiv.innerHTML = `<p>평균 CAGR: ${(rollingData.average_cagr * 100).toFixed(2)}% | 최소 CAGR: ${(rollingData.min_cagr * 100).toFixed(2)}% | 최대 CAGR: ${(rollingData.max_cagr * 100).toFixed(2)}% | 표준편차: ${(rollingData.stdev_cagr * 100).toFixed(2)}%</p>`;
    }

    function renderLogs(logs) {
        const logTableBody = document.getElementById('logTableBody');
        if (!logs || !Array.isArray(logs)) return;
        logs.forEach(log => {
            const row = logTableBody.insertRow();
            const cellDate = row.insertCell();
            const cellType = row.insertCell();
            const cellDetails = row.insertCell();
            cellDate.textContent = log.date || '';
            let typeText = log.type;
            let detailsText = log.message || '';
            if (log.type === 'DEPOSIT') {
                typeText = '입금';
                detailsText = `추가 투자금 ${log.amount.toLocaleString()} 입금`;
            } else if (log.type === 'TRANSACTION') {
                typeText = '거래';
                const actionMap = {'BUY': '매수', 'SELL_ALL': '전량 매도', 'SELL_ADJUST': '비중조절 매도', 'PERIODIC_BUY': '추가 매수', 'SWEEP_BUY': '잔여 현금 매수', 'INITIAL_BUY': '초기 매수'};
                const action = actionMap[log.action] || log.action;
                detailsText = `${log.ticker}: ${log.shares}주 ${action} (비용: ${log.amount.toLocaleString()}, 수수료/비용: ${log.fee.toFixed(2)})`;
            } else if (log.type === 'INFO') {
                typeText = '정보';
            }
            cellType.textContent = typeText;
            cellDetails.textContent = detailsText;
        });
    }
    
    function renderChart(responseData) {
        if (responseData.error) { document.getElementById('status').textContent = `백엔드 오류: ${responseData.error}`; return; }
        const chartData = responseData.chart_data;
        const results = responseData.results;
        const assetTickers = results.length > 0 ? Object.keys(results[0].assets) : [];
        const colorPalette = ['rgba(255, 99, 132, 0.3)', 'rgba(54, 162, 235, 0.3)', 'rgba(255, 206, 86, 0.3)', 'rgba(75, 192, 192, 0.3)', 'rgba(153, 102, 255, 0.3)', 'rgba(255, 159, 64, 0.3)'];
        const weightDatasets = assetTickers.map((ticker, index) => ({
            label: `${ticker} Weight`, data: results.map(r => r.assets[ticker].weight),
            fill: true, backgroundColor: colorPalette[index % colorPalette.length],
            borderColor: 'rgba(0,0,0,0)', yAxisID: 'y2', pointRadius: 0,
        }));
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
                    y1: { type: 'logarithmic', position: 'right', display: true, title: { display: true, text: 'ROI (%)' },
                        ticks: { callback: value => (value * 100).toFixed(0) + '%' },
                        grid: { drawOnChartArea: false }
                    },
                    y2: { type: 'linear', position: 'right', stacked: true, display: false, min: 0, max: 1 }
                },
                plugins: { legend: { labels: { filter: item => !item.text.includes('Weight') } } }
            }
        };
        const ctx = document.getElementById('backtestChart');
        if (myChart) {
            myChart.destroy();
        }
        myChart = new Chart(ctx, config);
        document.getElementById('chartTitle').innerText = '백테스트 결과';
    }
});
