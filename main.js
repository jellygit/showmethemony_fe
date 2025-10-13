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

    // 초기화
    await portfolioManager.initializePortfolio();
    ui.renderSliders(portfolioManager.getPortfolio(), sliderEventHandlers);
    ui.showInitialExample();

    // 이벤트 리스너 연결
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
        
        const stocks = portfolioManager.getPortfolio().flatMap(p => [p.symbol, p.weight.toFixed(4)]);
        const rollingWindowInput = document.getElementById('rolling_window').value;

        const backtestParams = {
            capital: parseFloat(document.getElementById('capital').value),
            start_date: document.getElementById('start_date').value,
            end_date: document.getElementById('end_date').value || null,
            strategy: document.getElementById('strategy').value,
            interval: document.getElementById('interval').value,
            periodic_investment: parseFloat(document.getElementById('periodic_investment').value),
            no_rebalance: document.getElementById('no_rebalance').checked,
            reinvest_dividends: document.getElementById('reinvest_dividends').checked,
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
            // [수정] renderLogs 함수에 현재 포트폴리오 정보를 함께 전달합니다.
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

    async function handleSymbolSearch(event) {
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

