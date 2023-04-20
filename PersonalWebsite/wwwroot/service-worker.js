
// In development, always fetch from the network and do not enable offline support.
// This is because caching would make development more difficult (changes would not
// be reflected on the first load after each change).
self.addEventListener('fetch', () => { });
/*
const CACHE_NAME = 'v9';
const urlsToCache = [
    '/',
    '/service-worker.js?version=9',
    '/css/app.css',
    '/service-worker.js?version=5',
    '/_content/TinyMCE.Blazor/tinymce-blazor.js',
    '/_framework/blazor.webassembly.js',
    '/_vs/browserLink',
    '/_framework/aspnetcore-browser-refresh.js',
    '/css/bootstrap/bootstrap.min.css',
    '/PersonalWebsite.styles.css',
    '/css/open-iconic/font/css/open-iconic-bootstrap.min.css',
    '/css/open-iconic/font/fonts/open-iconic.woff',
    '/appsettings.json',
    '/favicon.ico',
    '/manifest.json',
    '/icon-192.png',
    '/_framework/dotnet.6.0.13.do5qgt3ax8.js',
    '/_framework/blazor-hotreload.js',
    '/_framework/blazor-hotreload',
    '/Kudos_logo.png',
    '/PersonalWebsite/',
    '/_content/Microsoft.Authentication.WebAssembly.Msal/AuthenticationService.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5/tinymce.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/tinymce.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/themes/silver/theme.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/icons/default/icons.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/plugins/link/plugin.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/plugins/image/plugin.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/plugins/imagetools/plugin.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/plugins/table/plugin.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/plugins/lists/plugin.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/plugins/advlist/plugin.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/plugins/code/plugin.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/plugins/emoticons/plugin.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/plugins/wordcount/plugin.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/plugins/importcss/plugin.min.js',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/skins/ui/oxide-dark/content.min.css',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/skins/content/dark/content.min.css',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/skins/content/dark/content.min.css',
    'https://cdn.tiny.cloud/1/7so5re0foy5ocvnv7m3m3rznoi0hiar7wrg9w0hk2bkgfshl/tinymce/5.10.7-133/plugins/emoticons/js/emojis.min.js',
];

// Install event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Fetch event
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});
*/
