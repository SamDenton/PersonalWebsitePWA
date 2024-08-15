let requestQueue = [];
let isProcessing = false;
const rateLimit = 1200;
const rateLimitInterval = 60000; // 60 seconds
const refreshInterval = 100; // 0.1 seconds
let settings = { numberOfTickers: 11, quoteUnit: 'USDT' };
let intervalId;
let objRef;

window.renderSmallChart = function (cryptoId, priceHistory) {
    var ctx = document.getElementById('chart_' + cryptoId).getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(priceHistory.length).fill(''),
            datasets: [{
                data: priceHistory,
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                pointRadius: 0, 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: false, 
                },
                y: {
                    display: false,
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            }
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
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

window.fetchCryptoList = async function (dotNetHelper, currentSettings) {
    settings = currentSettings;

    const topTickers = await fetchTopVolumeTickers();
    setupRequestQueue(topTickers);
    startProcessingQueue(dotNetHelper);
}

window.initializeInterop = function (dotNetHelper) {
    objRef = dotNetHelper;

    window.addEventListener('focus', () => {
        DotNet.invokeMethodAsync('PersonalWebsite', 'ResetObjectReference');
        fetchCryptoList(objRef, settings);
    });
}

async function fetchTopVolumeTickers() {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr`);
    const data = await response.json();
    const filteredData = data.filter(ticker => ticker.symbol.endsWith(settings.quoteUnit));
    const sortedData = filteredData.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
    console.log(sortedData[0]);
    return sortedData.slice(0, settings.numberOfTickers).map(ticker => ticker.symbol);
}

function setupRequestQueue(symbols) {
    requestQueue = [];
    const requestsPerSecond = Math.floor(rateLimit / 60);

    symbols.forEach(symbol => {
        requestQueue.push({
            url: `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
            symbol,
            weight: 1
        });
    });

    while (requestQueue.length < requestsPerSecond * 60) {
        requestQueue.push(...requestQueue.slice(0, requestsPerSecond));
    }
}

function startProcessingQueue(dotNetHelper) {
    clearInterval(intervalId);
    intervalId = setInterval(() => {
        if (!isProcessing) {
            processQueue(dotNetHelper);
        }
    }, refreshInterval);
}

async function processQueue(dotNetHelper) {
    isProcessing = true;
    let weightUsed = 0;
    const startTime = Date.now();

    while (requestQueue.length > 0 && weightUsed < rateLimit) {
        if (settings.quoteUnit && settings.quoteUnit.length > 0) {
            const request = requestQueue.shift();
            const response = await fetch(request.url);
            const marketData = await response.json();
            const priceHistory = await fetchCryptoPriceHistory(request.symbol);

            const cryptoData = {
                Id: request.symbol,
                Name: request.symbol.slice(0, -settings.quoteUnit.length), // Extract name from symbol
                CurrentPrice: roundToSignificantFigures(marketData.lastPrice, 4),
                Symbol: request.symbol,
                PriceHistory: priceHistory,
                VolumeInBaseCurrency: roundToSignificantFigures(marketData.volume, 4),
                VolumeInQuoteCurrency: roundToSignificantFigures(marketData.quoteVolume, 4),
                High24h: roundToSignificantFigures(marketData.highPrice, 4),
                Low24h: roundToSignificantFigures(marketData.lowPrice, 4),
                Change24h: marketData.priceChangePercent,
                LastUpdate: new Date().toISOString() // Current time as ISO string
            };

            updateCryptoData(dotNetHelper, cryptoData);

            weightUsed += request.weight;

            if (Date.now() - startTime >= rateLimitInterval) {
                break;
            }
        } else {
            console.error("quoteUnit is undefined or empty.");
            break;
        }
    }

    isProcessing = false;
}

// Function to round a number to include significant figures only
function roundToSignificantFigures(num, n = 4) {
    if (num === 0) {
        return 0;
    }

    const d = Math.ceil(Math.log10(num < 0 ? -num : num));
    const power = n - d;

    const magnitude = Math.pow(10, power);
    const shifted = Math.round(num * magnitude);

    let numToXFigures = shifted / magnitude;
    return numToXFigures;
}

async function fetchCryptoPriceHistory(symbol) {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`);
    const data = await response.json();
    return data.map(candle => parseFloat(candle[4])); // Closing prices
}

function updateCryptoData(dotNetHelper, cryptoData) {
    if (dotNetHelper) {
        dotNetHelper.invokeMethodAsync('UpdateCryptoData', cryptoData);
    }
}