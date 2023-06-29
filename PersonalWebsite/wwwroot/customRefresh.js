//This should prevent default behaviour for F5 and ctrl + r.  this prevents differences in behavior between different types of refresh and navigation. 
//If I ever get state management working properly, I can get rid of this, and just manage my data properly
window.customRefresh = {
    getNavigationType: function () {
        let navEntries = performance.getEntriesByType('navigation');
        return navEntries.length > 0 ? navEntries[0].type : null;
    },

    preventRefresh: function () {
        window.addEventListener('keydown', (event) => {
            if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
                event.preventDefault();
            }
        });
    },

    preventRefreshMobile: function () {
        window.addEventListener('popstate', (event) => {
            window.location.href = '/';
        });
    }
}
