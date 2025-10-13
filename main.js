// main.js
import * as api from './api.js';
import * as ui from './ui.js';
import * as portfolioManager from './portfolioManager.js';

document.addEventListener('DOMContentLoaded', async function() {
    
    const sliderEventHandlers = {
        onSliderChange: (event) => {
            portfolioManager.updateWeight(parseInt(event.target.dataset.index), parseFloat(event.target.value) / 100);
            ui.renderSliders(portfolioManager.getPortfolio(), sliderEventHandlers);
        },
        onInputChange: (event) => {
            portfolioManager.updateWeight(parseInt(event.target.dataset.index), parseFloat(event.target.value) / 100);
            ui.renderSliders(portfolioManager.getPortfolio(), sliderEventHandlers);
        },
        onRemoveItem: (event) => {
            portfolioManager.removeStock(parseInt(event.target.dataset.index));
            ui.renderSliders(portfolioManager.getPortfolio(), sliderEventHandlers);
        }
    };

    // --- [신규] 화폐 입력 포맷팅 관련 ---
    const capitalInput = document.getElementById('capital');
    const periodicInvestmentInput = document.getElementById('periodic_investment');

    function formatCurrency(inputElement) {
        let value = inputElement.value;
        // 숫자 이외의 문자(쉼표 포함) 모두 제거
        const numberValue = parseInt(value.replace(/[^0-9]/g, ''), 10);
        if (isNaN(numberValue)) {
            inputElement.value = '';
        } else {
            // 세 자리마다 쉼표 추가
            inputElement.value = numberValue.toLocaleString();
        }
    }
    capitalInput.addEventListener('input', () => formatCurrency(capitalInput));
    periodicInvestmentInput.addEventListener('input', () => formatCurrency(periodicInvestmentInput));
    // ------------------------------------

    await portfolioManager.initializePortfolio();
    ui.renderSliders(portfolioManager.getPortfolio(), sliderEventHandlers);
    ui.showInitialExample();

    document.getElementById('backtestForm').addEventListener('submit', handleBacktestSubmit);
    document.getElementById('symbolSearch').addEventListener('input', handleSymbolSearch);
    document.getElementById('savePortfolioBtn').addEventListener('click', portfolioManager.savePortfolio);
    document.getElementById('loadPortfolioBtn').addEventListener('click', () => {
        portfolioManager.loadPortfolio(); 
        ui.renderSliders(portfolioManager.getPortfolio(), sliderEventHandlers);
    });
    document.getElementById('sharePortfolioBtn').addEventListener('click', handleShare);
    document.querySelector('.modal-close-btn').addEventListener('click', () => ui.toggleModal(false));
    document.getElementById('copyUrlBtn').addEventListener('click', ui.copyShareUrl);


    async function handleBacktestSubmit(event) {
        event.preventDefault();
        const submitButton = document.getElementById('submitButton');
        const statusEl = document.getElementById('status');
        
        // --- [수정] 쉼표를 제거하고 숫자로 변환 ---
        const capitalValue = parseFloat(capitalInput.value.replace(/,/g, '')) || 0;
        const periodicInvestmentValue = parseFloat(periodicInvestmentInput.value.replace(/,/g, '')) || 0;

        if (capitalValue <= 0 && periodicInvestmentValue <= 0) {
            alert("초기 투자금 또는 주기별 추가 투자금 중 하나는 0보다 커야 합니다.");
            return;
        }
        
        let intervalValue = document.getElementById('interval').value;
        if (intervalValue.endsWith('M')) {
            intervalValue = intervalValue.replace('M', 'ME');
        }
        
        const stocks = portfolioManager.getPortfolio().flatMap(p => [p.symbol, p.weight.toFixed(4)]);
        const rollingWindowInput = document.getElementById('rolling_window').value;

        const backtestParams = {
            capital: capitalValue,
            start_date: document.getElementById('start_date').value,
            end_date: document.getElementById('end_date').value || null,
            strategy: document.getElementById('strategy').value,
            interval: intervalValue,
            periodic_investment: periodicInvestmentValue,
            no_rebalance: document.getElementById('no_rebalance').checked,
            no_drip: document.getElementById('no_drip').checked,
            stocks: stocks.length > 0 ? stocks : null,
            rolling_window: rollingWindowInput ? parseInt(rollingWindowInput, 10) : null,
            rolling_step: document.getElementById('rolling_step').value
        };

        submitButton.disabled = true;
        statusEl.textContent = '백엔드 서버에서 데이터를 계산 중입니다...';
        ui.resetResultViews();

        try {
            const responseData = await api.fetchBacktestData(backtestParams);
            ui.renderChart(responseData, portfolioManager.getPortfolio());
            ui.renderHoldingsTable(responseData.results);
            ui.renderLogs(responseData.logs, portfolioManager.getPortfolio());
            ui.renderRollingReturns(responseData.summary.rolling_returns);
            statusEl.textContent = '백테스트 완료!';
        } catch (error) {
            console.error(error);
            statusEl.textContent = `오류 발생: ${error.message}`;
        } finally {
            submitButton.disabled = false;
        }
    }

    let debounceTimer;
    function handleSymbolSearch(event) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const query = event.target.value;
            if (query.length < 2) {
                ui.renderSearchResults([]);
                return;
            }
            try {
                const responseData = await api.searchSymbols(query);
                const searchData = Array.isArray(responseData) ? responseData : responseData.results;

                ui.renderSearchResults(searchData, (item) => {
                    if (portfolioManager.addStock(item)) {
                        ui.renderSliders(portfolioManager.getPortfolio(), sliderEventHandlers);
                    }
                    document.getElementById('search-results').innerHTML = '';
                    event.target.value = '';
                });
            } catch (error) {
                console.error(error);
            }
        }, 300);
    }

    function handleShare() {
        const url = portfolioManager.generateShareUrl();
        if (url) {
            ui.showShareModal(url);
        } else {
            alert("공유할 포트폴리오가 없습니다.");
        }
    }
});

