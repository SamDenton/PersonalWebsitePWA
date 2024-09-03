// Version updated at 2024-09-03T18:58:40
self.importScripts('./service-worker-assets.js');
self.addEventListener('install', event => event.waitUntil(onInstall(event)));
self.addEventListener('activate', event => event.waitUntil(onActivate(event)));
self.addEventListener('fetch', event => event.respondWith(onFetch(event)));

const cacheNamePrefix = 'offline-cache-';
const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`;
//const offlineAssetsInclude = [/\.dll$/, /\.pdb$/, /\.wasm/, /\.woff$/, /\.png$/, /\.jpe?g$/, /\.gif$/, /\.ico$/, /\.blat$/, /\.dat$/, ];
//const offlineAssetsExclude = [
//    /^service-worker\.js$/,
//    /^_framework\/PersonalWebsite\.dll$/,
//    /^_framework\/PersonalWebsite\.dll.br$/,
//    /^_framework\/PersonalWebsite\.dll.bz$/,
//    /^_framework\/blazor\.boot\.json$/,
//    /\.js$/,
//];

// Include all file types for offline use
const offlineAssetsInclude = [/.*$/];


const cacheFirstAssets = [
    // _content folder
    '_content/Microsoft.AspNetCore.Components.WebAssembly.Authentication/*',
    '_content/Microsoft.Authentication.WebAssembly.Msal/*',
    '_content/TinyMCE.Blazor/*',

    // lib folder
    'lib/tinymce/*',

    // css folders
    'css/bootstrap/*',
    'css/open-iconic/*',

    // _framework files
    '_framework/*',
];

async function onInstall(event) {
    console.info('Service worker: Install');

    // Cache all matching items from the assets manifest
    const assetsRequests = self.assetsManifest.assets
        .filter(asset => offlineAssetsInclude.some(pattern => pattern.test(asset.url)))
        .map(asset => new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' }));
/*        .filter(asset => !offlineAssetsExclude.some(pattern => pattern.test(asset.url)))*/
    await caches.open(cacheName).then(cache => cache.addAll(assetsRequests));
}

async function onActivate(event) {
    console.info('Service worker: Activate');

    // Delete unused caches
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys
        .filter(key => key.startsWith(cacheNamePrefix) && key !== cacheName)
        .map(key => caches.delete(key)));
}

async function onFetch(event) {
    console.log('Service worker: Fetch', event.request.url);
    // Bypass the service worker for authentication requests
    if (event.request.url.includes('/authentication/')) {

        return fetch(event.request);
    }

    if (cacheFirstAssets.includes(event.request.url)) {
        // For assets in the cacheFirstAssets list, try to serve from the cache first
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(event.request);

        return cachedResponse || fetch(event.request);
    } else {
        // For all other assets, try to fetch from the network first
        try {
            return await fetch(event.request);
        } catch (err) {
            // If the fetch fails (e.g. due to being offline), serve from the cache
            const cache = await caches.open(cacheName);

            return await cache.match(event.request);
        }
    }
}


































































































































