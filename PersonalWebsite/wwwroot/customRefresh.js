window.customRefresh = {
    getNavigationType: function () {
        let navEntries = performance.getEntriesByType('navigation');
        return navEntries.length > 0 ? navEntries[0].type : null;
    },

    preventRefresh: function () {
        window.addEventListener('keydown', (event) => {
            if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
                event.preventDefault();
                window.location.href = '/';
            }
        });
    }
}
