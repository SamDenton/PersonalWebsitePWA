let requestQueue = [];
let isProcessing = false;
const rateLimit = 1200; // Per minute
const refreshInterval = 1000; // 1 second

window.renderSmallChart = function (cryptoId, priceHistory) {
    var ctx = document.getElementById('chart_' + cryptoId).getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(priceHistory.length).fill(''),
            datasets: [{
                label: cryptoId,
                data: priceHistory,
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        }
    });
}

window.renderDetailChart = function (cryptoId, priceHistory) {
    var ctx = document.getElementById('detailChart_' + cryptoId).getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(priceHistory.length).fill(''),
            datasets: [{
                label: cryptoId,
                data: priceHistory,
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        }
    });
}

window.fetchCryptoList = async function () {
    const topTickers = await fetchTopVolumeTickers();
    setupRequestQueue(topTickers);
    processQueueContinuously();
}

async function fetchTopVolumeTickers() {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr`);
    const data = await response.json();
    const sortedData = data.sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume));
    return sortedData.slice(0, 100).map(ticker => ticker.symbol);
}

function setupRequestQueue(symbols) {
    requestQueue = [];
    const requestsPerSecond = Math.floor(rateLimit / 60);

    symbols.forEach(symbol => {
        requestQueue.push({
            url: `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
            symbol,
            weight: 1 // Each request has a weight of 1
        });
    });

    while (requestQueue.length < requestsPerSecond * 60) {
        requestQueue.push(...requestQueue.slice(0, requestsPerSecond));
    }
}

async function processQueueContinuously() {
    while (true) {
        const startTime = Date.now();
        await processQueue();
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;

        if (elapsedTime < refreshInterval) {
            await new Promise(resolve => setTimeout(resolve, refreshInterval - elapsedTime));
        }
    }
}

async function processQueue() {
    let weightUsed = 0;

    while (requestQueue.length > 0 && weightUsed < rateLimit) {
        const request = requestQueue.shift();
        const response = await fetch(request.url);
        const marketData = await response.json();
        const priceHistory = await fetchCryptoPriceHistory(request.symbol);

        const cryptoData = {
            Id: request.symbol,
            Name: request.symbol.slice(0, -4), // Extract name from symbol
            CurrentPrice: marketData.lastPrice,
            Symbol: request.symbol,
            PriceHistory: priceHistory
        };

        updateCryptoData(cryptoData);

        weightUsed += request.weight;
    }
}

async function fetchCryptoPriceHistory(symbol) {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`);
    const data = await response.json();
    return data.map(candle => parseFloat(candle[4])); // Closing prices
}

function updateCryptoData(cryptoData) {
    DotNet.invokeMethodAsync('PersonalWebsite', 'UpdateCryptoData', cryptoData);
}
