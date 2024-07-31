using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace PersonalWebsite.Pages.CryptoManagerComponents
{
    public class Crypto
    {
        public string Id { get; set; }
        public string Name { get; set; }

        [JsonConverter(typeof(DecimalConverter))]
        public decimal CurrentPrice { get; set; }

        public string Symbol { get; set; }
        public List<decimal> PriceHistory { get; set; }

        [JsonConverter(typeof(DecimalConverter))]
        public decimal VolumeInBaseCurrency { get; set; } // Volume in USDT, BTC, etc.

        [JsonConverter(typeof(DecimalConverter))]
        public decimal VolumeInBTC { get; set; } // Volume in BTC

        [JsonConverter(typeof(DecimalConverter))]
        public decimal High24h { get; set; } // 24h High

        [JsonConverter(typeof(DecimalConverter))]
        public decimal Low24h { get; set; } // 24h Low

        [JsonConverter(typeof(DecimalConverter))]
        public decimal Change24h { get; set; } // 24h Change %

        public DateTime LastUpdate { get; set; } // Last update time
    }
}
