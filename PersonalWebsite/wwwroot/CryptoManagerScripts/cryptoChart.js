/* Dev tools flags a line starting with 'export' as an error, but it's not an error. */

export async function renderChart(cryptoId) {
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/${cryptoId}/market_chart?vs_currency=usd&days=7`);
    const data = await response.json();
    const ctx = document.getElementById('cryptoChart').getContext('2d');

    const labels = data.prices.map(price => new Date(price[0]).toLocaleDateString());
    const prices = data.prices.map(price => price[1]);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: cryptoId,
                data: prices,
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        }
    });
}
