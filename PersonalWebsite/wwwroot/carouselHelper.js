window.carouselHelper = {
    getCardWidth: function () {
        var card = document.querySelector('.card-column'); // Assuming .card-container represents a single card
        return card ? card.offsetWidth : 0;
    },
    getVisibleCards: function () {
        var wrapper = document.querySelector('.cards-wrapper');
        var cardWidth = this.getCardWidth();
        return wrapper && cardWidth > 0 ? Math.floor(wrapper.offsetWidth / cardWidth) : 0;
    },
    addResizeListener: function (dotNetReference) {
        window.addEventListener('resize', function () {
            dotNetReference.invokeMethodAsync('RecalculateSizes');
        });
    }
}
