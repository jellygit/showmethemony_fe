// script.js
document.addEventListener('DOMContentLoaded', function() {
    let myChart = null;
    let portfolio = []; // 포트폴리오 상태 관리 배열: {symbol, name, weight}
    let isUpdating = false;

    const backtestForm = document.getElementById('backtestForm');
    const searchInput = document.getElementById('symbolSearch');
    
    // 페이지 로드 시 초기 슬라이더 설정
    portfolio = [
        { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', weight: 0.6 },
        { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', weight: 0.2 },
        { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', weight: 0.2 }
    ];
    renderSliders();
    
    backtestForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const submitButton = document.getElementById('submitButton');
        const statusEl = document.getElementById('status');
        
        const stocks = portfolio.flatMap(p => [p.symbol, p.weight.toFixed(4)]);
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
            const responseData = await response.json();
            const data = Array.isArray(responseData) ? responseData : responseData.results;
            
            searchResults.innerHTML = '';
            if (!data) {
                searchResults.innerHTML = '<li>검색 결과가 없습니다.</li>';
                return;
            }

            data.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `${item.Name} (${item.Symbol})`;
                li.addEventListener('click', function() {
                    const symbolToAdd = item.Symbol;
                    if (portfolio.find(p => p.symbol === symbolToAdd)) {
                        alert("이미 추가된 종목입니다."); return;
                    }
                    
                    portfolio.push({ 
                        symbol: symbolToAdd,
                        name: item.Name,
                        weight: 0 
                    });

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
                <span title="${item.name} (${item.symbol})">${item.name}</span>
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
        updateWeights(parseInt(event.target.dataset.index, 10), parseFloat(event.target.value) / 100);
    }

    function handleInputChange(event) {
        if (isUpdating) return;
        updateWeights(parseInt(event.target.dataset.index, 10), parseFloat(event.target.value) / 100);
    }

    function handleRemoveItem(event) {
        portfolio.splice(parseInt(event.target.dataset.index, 10), 1);
        if (portfolio.length > 0) {
            const totalWeight = portfolio.reduce((sum, p) => sum + p.weight, 0);
            if (totalWeight > 0) {
                portfolio.forEach(p => p.weight = p.weight / totalWeight);
            } else {
                const equalWeight = 1 / portfolio.length;
                portfolio.forEach(p => p.weight = equalWeight);
            }
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
                item.weight -= delta * (item.weight / otherTotalWeight);
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
        headerRow.insertCell().textContent = '수익률';
        headerRow.insertCell().textContent = '현금';
        tickers.forEach(ticker => {
            headerRow.insertCell().textContent = `${ticker} 보유수`;
            headerRow.insertCell().textContent = `${ticker} 평가액`;
        });
        results.forEach(record => {
            const row = tableBody.insertRow();
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
            const cellDate = row.insertCell(), cellType = row.insertCell(), cellDetails = row.insertCell();
            cellDate.textContent = log.date || '';
            let typeText = log.type, detailsText = log.message || '';
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

        // [수정] 자산 비중 데이터셋의 label을 '종목명 (티커)' 형식으로 변경
        const nameMap = Object.fromEntries(portfolio.map(p => [p.symbol, p.name]));
        
        const weightDatasets = assetTickers.map((ticker, index) => {
            const displayName = nameMap[ticker] || ticker; // portfolio에 이름이 없으면 티커를 사용
            return {
                label: `${displayName} (${ticker})`,
                data: results.map(r => r.assets[ticker].weight),
                fill: true, 
                backgroundColor: colorPalette[index % colorPalette.length],
                borderColor: 'rgba(0,0,0,0)', 
                yAxisID: 'y2', 
                pointRadius: 0,
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
                    y1: { type: 'linear', position: 'right', display: true, title: { display: true, text: 'ROI (%)' },
                        ticks: { callback: value => (value * 100).toFixed(0) + '%' },
                        grid: { drawOnChartArea: false }
                    },
                    y2: { type: 'linear', position: 'right', stacked: true, display: false, min: 0, max: 1 }
                },
                plugins: { 
                    // [수정] 범례 필터를 제거하여 모든 항목이 표시되도록 함
                    legend: { 
                        labels: { 
                            // 모든 범례 항목을 표시
                        } 
                    } 
                }
            }
        };
        const ctx = document.getElementById('backtestChart');
        if (myChart) { myChart.destroy(); }
        myChart = new Chart(ctx, config);
        document.getElementById('chartTitle').innerText = '백테스트 결과';
    }
});

