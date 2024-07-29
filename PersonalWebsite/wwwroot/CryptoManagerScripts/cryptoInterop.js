window.fetchCryptoDetails = async function (cryptoId) {
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${cryptoId}`);
        if (!response.ok) {
            throw new Error(`Error fetching details for ${cryptoId}: ${response.statusText}`);
        }
        const data = await response.json();
        return JSON.stringify({
            Id: data.id,
            Name: data.name,
            Price: data.market_data.current_price.usd,
            Symbol: data.symbol
        });
    } catch (error) {
        console.error(error);
        return null;
    }
}
