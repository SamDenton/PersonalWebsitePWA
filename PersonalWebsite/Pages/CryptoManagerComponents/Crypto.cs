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
    }
}
