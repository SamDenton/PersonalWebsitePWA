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

let componentInstance = null;

function registerComponentInstance(instance) {
    componentInstance = instance;
}

function triggerRecalculateSizes() {
    if (componentInstance) {
        componentInstance.invokeMethodAsync('RecalculateSizes')
            .then(result => {
                //console.log('Recalculation triggered');
            }).catch(err => {
                //console.error('Error triggering recalculation:', err);
            });
    }
}

function unregisterComponentInstance() {
    componentInstance = null;
}

