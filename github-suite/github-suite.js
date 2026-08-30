// ==UserScript==
// @name         GitHub Suite
// @namespace    https://github.com/arrupe
// @version      1.1.0
// @description  Combines a Gitub folder download menu, file-type colors/icons, image preview galleries, a HTML preview button, and a wiki sidebar toggle.
// @author       arrupe
// @license      WTFPL
// @match        https://github.com/*
// @noframes
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      raw.githubusercontent.com
// @icon         https://github.githubassets.com/pinned-octocat.svg
// ==/UserScript==

(() => {
    'use strict';

    // ===============================================================
    // Shared core — one throttled observer drives every module
    // ===============================================================

    const $ = (sel, el) => (el || document).querySelector(sel);
    const $$ = (sel, el) => [...(el || document).querySelectorAll(sel)];

    function addStyle(css) {
        const s = document.createElement('style');
        s.textContent = css;
        document.head.append(s);
        return s;
    }

    const syncFns = [];
    const registerSync = (fn) => syncFns.push(fn);
    function runSyncs() {
        for (const fn of syncFns) {
            try { fn(); } catch (e) { console.warn('[GitHub Suite]', e); }
        }
    }

    // ===============================================================
    // MODULE 1 — Repository Enhancer (file-type colors/icons)
    // wOxxOm, ChinaGodMan · MIT — clone-button feature removed
    // Embedded verbatim; only its private observer is disabled in
    // favor of the suite's shared one.
    // ===============================================================

    (function moduleRepoEnhancer() {


    // =========================================================================
    // Configuration
    // =========================================================================

    const COLORS_URL =
        'https://raw.githubusercontent.com/ChinaGodMan/UserScripts/main/' +
        'github-file-list-beautifier-plus/colors.json';

    const COLORS_STORAGE_KEY = 'fileTypesColors';
    const STYLE_ID = 'github-enhancer-styles';

    const PROCESSED_ATTR = 'data-github-enhancer-processed';
    const FILE_TYPE_ATTR = 'data-github-enhancer-file-type';

    const DEFAULT_CONFIG = {
        iconSize: 24,
        colorSeed1: 13,
        colorSeed2: 1299721,
        colorSeed3: 179426453
    };

    const IMAGE_EXTENSIONS =
        /^(png|jpe?g|bmp|gif|webp|avif|cur|ico|svg)$/i;

    const state = {
        customColors: {},
        generatedColors: new Map(),
        scheduled: false,
        observerStarted: false
    };

    let cachedConfig = null;

    // =========================================================================
    // Initialization
    // =========================================================================

    function initialize() {
        loadStoredColors();
        addStyles();
        // startObserver(); — the suite's shared observer drives this module
        scheduleEnhancement();
        loadRemoteColorsIfNeeded();
    }

    // =========================================================================
    // Styles
    // =========================================================================

    function addStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = STYLE_ID;

        style.textContent = `
            .github-enhancer-file-icon {
                width: 16px !important;
                height: 16px !important;
                object-fit: contain !important;
                margin: 0 -4px !important;
                flex-shrink: 0 !important;
            }

            .github-enhancer-image-preview {
                width: ${getConfig().iconSize}px !important;
                height: ${getConfig().iconSize}px !important;
                object-fit: scale-down !important;
                margin: 0 -4px !important;
                border-radius: 3px !important;
                flex-shrink: 0 !important;
            }

            a[${FILE_TYPE_ATTR}="folder"] {
                font-weight: 600 !important;
            }


        `;

        (document.head || document.documentElement).appendChild(style);
    }

    // =========================================================================
    // Saved Configuration
    // =========================================================================

    function getConfig() {
        if (cachedConfig) {
            return cachedConfig;
        }

        let saved = {};

        try {
            saved = JSON.parse(
                localStorage.getItem('FileListBeautifier') || '{}'
            );
        } catch {
            saved = {};
        }

        cachedConfig = {
            iconSize:
                getNumber(
                    saved.iconSize,
                    DEFAULT_CONFIG.iconSize
                ),

            colorSeed1:
                getNumber(
                    saved.colorSeed1,
                    DEFAULT_CONFIG.colorSeed1
                ),

            colorSeed2:
                getNumber(
                    saved.colorSeed2,
                    DEFAULT_CONFIG.colorSeed2
                ),

            colorSeed3:
                getNumber(
                    saved.colorSeed3,
                    DEFAULT_CONFIG.colorSeed3
                )
        };

        return cachedConfig;
    }

    function getNumber(value, fallback) {
        const number = Number(value);

        return Number.isFinite(number) && number > 0
            ? number
            : fallback;
    }

    // =========================================================================
    // File Color Configuration
    // =========================================================================

    function loadStoredColors() {
        try {
            const colors =
                GM_getValue(COLORS_STORAGE_KEY, {}) || {};

            if (
                colors &&
                typeof colors === 'object'
            ) {
                state.customColors = colors;
            }
        } catch {
            state.customColors = {};
        }
    }

    async function loadRemoteColorsIfNeeded() {
        if (Object.keys(state.customColors).length > 0) {
            return;
        }

        try {
            const colors =
                await requestJson(COLORS_URL);

            if (
                !colors ||
                typeof colors !== 'object'
            ) {
                return;
            }

            state.customColors = colors;

            try {
                GM_setValue(
                    COLORS_STORAGE_KEY,
                    colors
                );
            } catch {
                // Local caching is optional.
            }

            /*
             * Existing files may have been processed before the color
             * configuration finished loading. Reset them so they can be
             * processed again with the custom colors and icons.
             */
            resetProcessedFiles();
            scheduleEnhancement();

        } catch (error) {
            console.warn(
                '[GitHub Repository Enhancer] ' +
                'Unable to load file color configuration.',
                error
            );
        }
    }

    function requestJson(url) {
        return new Promise((resolve, reject) => {
            if (
                typeof GM_xmlhttpRequest ===
                'function'
            ) {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,

                    onload(response) {
                        if (
                            response.status < 200 ||
                            response.status >= 300
                        ) {
                            reject(
                                new Error(
                                    `Request failed: ${response.status}`
                                )
                            );

                            return;
                        }

                        try {
                            resolve(
                                JSON.parse(
                                    response.responseText
                                )
                            );
                        } catch (error) {
                            reject(error);
                        }
                    },

                    onerror() {
                        reject(
                            new Error(
                                'Network request failed.'
                            )
                        );
                    }
                });

                return;
            }

            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(
                            `Request failed: ${response.status}`
                        );
                    }

                    return response.json();
                })
                .then(resolve)
                .catch(reject);
        });
    }

    // =========================================================================
    // File List Beautifier
    // =========================================================================

    function beautifyFileList() {
        const selectors = [
            '.react-directory-truncate',
            'a.js-navigation-open',

            'table a[href*="/blob/"]',
            'table a[href*="/tree/"]'
        ];

        const elements =
            document.querySelectorAll(
                selectors.join(',')
            );

        for (const element of elements) {
            processFileElement(
                element
            );
        }
    }

    function processFileElement(element) {
        const link =
            element.matches('a')
                ? element
                : element.querySelector(
                    'a[href]'
                );

        if (!link) {
            return;
        }

        if (
            link.hasAttribute(
                PROCESSED_ATTR
            )
        ) {
            return;
        }

        const href = link.href;

        if (!href) {
            return;
        }

        let url;

        try {
            url = new URL(href);
        } catch {
            return;
        }

        if (
            url.hostname !== 'github.com'
        ) {
            return;
        }

        // ---------------------------------------------------------------------
        // Folder
        // ---------------------------------------------------------------------

        if (
            url.pathname.includes(
                '/tree/'
            )
        ) {
            link.setAttribute(
                FILE_TYPE_ATTR,
                'folder'
            );

            link.setAttribute(
                PROCESSED_ATTR,
                'true'
            );

            return;
        }

        // ---------------------------------------------------------------------
        // File
        // ---------------------------------------------------------------------

        if (
            !url.pathname.includes(
                '/blob/'
            )
        ) {
            return;
        }

        const filename =
            getFilename(url);

        if (!filename) {
            return;
        }

        let type =
            getFileType(filename);

        if (
            state.customColors[
                filename
            ]
        ) {
            type = filename;
        }

        link.setAttribute(
            FILE_TYPE_ATTR,
            type
        );

        applyFileColor(
            link,
            type
        );

        const icon =
            findFileIcon(link);

        if (icon) {
            replaceFileIcon(
                icon,
                url,
                filename,
                type
            );
        }

        link.setAttribute(
            PROCESSED_ATTR,
            'true'
        );
    }

    function resetProcessedFiles() {
        document
            .querySelectorAll(
                `[${PROCESSED_ATTR}]`
            )
            .forEach(element => {
                element.removeAttribute(
                    PROCESSED_ATTR
                );
            });
    }

    // =========================================================================
    // File Information
    // =========================================================================

    function getFilename(url) {
        try {
            return decodeURIComponent(
                url.pathname
                    .split('/')
                    .pop() || ''
            ).toLowerCase();
        } catch {
            return '';
        }
    }

    function getFileType(filename) {
        const match =
            filename.match(
                /\.([^.]+)$/
            );

        if (!match) {
            return filename.toLowerCase();
        }

        return match[1].toLowerCase();
    }

    // =========================================================================
    // File Colors
    // =========================================================================

    function applyFileColor(
        link,
        type
    ) {
        const color =
            getColorForType(type);

        if (!color) {
            return;
        }

        link.style.setProperty(
            'color',
            color,
            'important'
        );
    }

    function getColorForType(type) {
        const custom =
            state.customColors[type];

        /*
         * Support either:
         *
         * {
         *   "js": {
         *      "color": "#..."
         *   }
         * }
         *
         * or a simple string.
         */
        if (
            typeof custom === 'string'
        ) {
            return custom;
        }

        if (
            custom &&
            typeof custom === 'object' &&
            custom.color
        ) {
            return custom.color;
        }

        const theme =
            isDarkTheme()
                ? 'dark'
                : 'light';

        const cacheKey =
            `${theme}:${type}`;

        if (
            state.generatedColors.has(
                cacheKey
            )
        ) {
            return state.generatedColors.get(
                cacheKey
            );
        }

        const config =
            getConfig();

        const hash =
            calculateHash(
                type,
                config.colorSeed1
            );

        const hue =
            hash % 360;

        const hueSection =
            hue / 60;

        const saturation =
            (
                hash *
                config.colorSeed2 %
                50
            ) + 50;

        const redFix =
            hueSection < 1
                ? 1 - hueSection
                : hueSection > 4
                    ? (
                        hueSection - 4
                    ) / 2
                    : 0;

        const blueFix =
            (
                hueSection < 3 ||
                hueSection > 5
                    ? 0
                    : hueSection < 4
                        ? hueSection - 3
                        : 5 - hueSection
            ) * 3;

        const [
            lumaBias,
            lumaAmp,
            lumaFix
        ] =
            theme === 'dark'
                ? [30, 50, 12]
                : [25, 15, 0];

        const lightness =
            Math.floor(
                (
                    hash *
                    config.colorSeed3
                ) %
                lumaAmp +
                lumaBias +
                (
                    (
                        redFix +
                        blueFix
                    ) *
                    lumaFix *
                    saturation /
                    100
                )
            );

        const color =
            `hsl(${hue} ${Math.floor(
                saturation
            )}% ${lightness}%)`;

        state.generatedColors.set(
            cacheKey,
            color
        );

        return color;
    }

    function calculateHash(
        text,
        seed
    ) {
        let hash = 0;

        for (
            let i = 0;
            i < text.length;
            i++
        ) {
            hash =
                (
                    (hash << 5) -
                    hash
                ) +
                text.charCodeAt(i);

            hash |= 0;
        }

        return Math.abs(
            Math.imul(
                hash,
                seed
            )
        );
    }

    function isDarkTheme() {
        const root =
            document.documentElement;

        if (
            root.dataset.colorMode ===
            'dark'
        ) {
            return true;
        }

        if (
            root.dataset.colorMode ===
            'light'
        ) {
            return false;
        }

        if (
            root.dataset.darkTheme &&
            !root.dataset.lightTheme
        ) {
            return true;
        }

        if (!document.body) {
            return false;
        }

        const background =
            getComputedStyle(
                document.body
            ).backgroundColor;

        const values =
            background
                .match(/[\d.]+/g)
                ?.map(Number);

        if (
            !values ||
            values.length < 3
        ) {
            return false;
        }

        const [
            red,
            green,
            blue
        ] = values;

        const luminance =
            red * 0.2126 +
            green * 0.7152 +
            blue * 0.0722;

        return luminance < 128;
    }

    // =========================================================================
    // File Icons
    // =========================================================================

    function findFileIcon(link) {
        const row =
            link.closest(
                [
                    'tr',
                    '[role="row"]',
                    '.js-navigation-item',
                    '.Box-row'
                ].join(',')
            );

        if (!row) {
            return null;
        }

        return (
            row.querySelector(
                [
                    'svg.octicon-file',
                    'svg.octicon-file-directory-fill',
                    'svg.icon-file',
                    'svg.icon-directory',
                    'svg.octicon'
                ].join(',')
            ) ||
            null
        );
    }

    function replaceFileIcon(
        icon,
        url,
        filename,
        type
    ) {
        const customIcon =
            getCustomIcon(
                filename,
                type
            );

        if (customIcon) {
            const iconUrl =
                resolveCustomIconUrl(
                    customIcon
                );

            if (iconUrl) {
                icon.replaceWith(
                    createImage({
                        className:
                            'github-enhancer-file-icon',

                        src:
                            iconUrl,

                        title:
                            `${type.toUpperCase()} file`
                    })
                );

                return;
            }
        }

        /*
         * Display an actual image thumbnail when the repository item
         * itself is an image.
         */
        if (
            !IMAGE_EXTENSIONS.test(
                type
            )
        ) {
            return;
        }

        const rawUrl =
            getRawGitHubUrl(url);

        if (!rawUrl) {
            return;
        }

        icon.replaceWith(
            createImage({
                className:
                    'github-enhancer-image-preview',

                src:
                    rawUrl,

                title:
                    filename
            })
        );
    }

    function getCustomIcon(
        filename,
        type
    ) {
        const filenameConfig =
            state.customColors[
                filename
            ];

        if (
            filenameConfig &&
            typeof filenameConfig ===
                'object' &&
            filenameConfig.icon
        ) {
            return filenameConfig.icon;
        }

        const typeConfig =
            state.customColors[
                type
            ];

        if (
            typeConfig &&
            typeof typeConfig ===
                'object' &&
            typeConfig.icon
        ) {
            return typeConfig.icon;
        }

        return null;
    }

    function resolveCustomIconUrl(icon) {
        if (
            typeof icon !== 'string'
        ) {
            return null;
        }

        if (
            icon.startsWith(
                'https://'
            ) ||
            icon.startsWith(
                'data:image/'
            )
        ) {
            return icon;
        }

        return (
            'https://raw.githubusercontent.com/' +
            'PKief/vscode-material-icon-theme/' +
            'main/icons/' +
            `${icon}.svg`
        );
    }

    function getRawGitHubUrl(url) {
        if (
            url.hostname !==
            'github.com'
        ) {
            return null;
        }

        if (
            !url.pathname.includes(
                '/blob/'
            )
        ) {
            return null;
        }

        return (
            'https://raw.githubusercontent.com' +
            url.pathname.replace(
                '/blob/',
                '/'
            )
        );
    }

    function createImage({
        className,
        src,
        title = ''
    }) {
        const image =
            document.createElement(
                'img'
            );

        image.className =
            className;

        image.src =
            src;

        image.alt =
            '';

        image.title =
            title;

        image.loading =
            'lazy';

        image.decoding =
            'async';

        image.setAttribute(
            'aria-hidden',
            'true'
        );

        return image;
    }

    // =========================================================================
    // GitHub Dynamic Navigation
    // =========================================================================

    function enhancePage() {
        state.scheduled = false;
        beautifyFileList();
    }

    function scheduleEnhancement() {
        if (state.scheduled) {
            return;
        }

        state.scheduled = true;

        requestAnimationFrame(
            enhancePage
        );
    }

    function startObserver() {
        if (
            state.observerStarted
        ) {
            return;
        }

        state.observerStarted = true;

        const observer =
            new MutationObserver(
                scheduleEnhancement
            );

        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );

        /*
         * GitHub uses Turbo/client-side navigation, so URLs and repository
         * content can change without a traditional page reload.
         */
        document.addEventListener(
            'turbo:load',
            scheduleEnhancement
        );

        document.addEventListener(
            'pjax:end',
            scheduleEnhancement
        );

        window.addEventListener(
            'popstate',
            scheduleEnhancement
        );
    }

    // =========================================================================
    // Start
    // =========================================================================


        initialize();
        registerSync(enhancePage);
    })();

    // ===============================================================
    // MODULE 2 — Image preview galleries (modernized from Rob
    // Garrison's GitHub Image Preview · MIT): tiled / full-width
    // gallery toggles above the file table
    // ===============================================================

    (function moduleImagePreview() {
        const IMG_EXT = /\.(png|jpe?g|gif|tiff?|bmp|webp|avif|ico)$/i;
        const SVG_EXT = /\.svg$/i;
        const SPINNER = 'https://github.githubassets.com/images/spinners/octocat-spinner-32.gif';
        const STATE_KEY = 'gh-image-preview'; // same key as the original — old setting carries over

        const store = {
            get: () => (typeof GM_getValue == 'function' ? GM_getValue(STATE_KEY, '') : ''),
            set: (v) => { if (typeof GM_setValue == 'function') GM_setValue(STATE_KEY, v); },
        };
        let state = ['tiled', 'fullw'].includes(store.get()) ? store.get() : '';

        addStyle(`
            .ghp-hidden { display: none !important }
            .ghp-toggles { display: flex ; gap: 4px ; justify-content: flex-end ; margin: 8px 0 }
            .ghp-btn {
                display: inline-flex ; align-items: center ; padding: 5px 10px ;
                border: 1px solid var(--borderColor-default, #d0d7de) ; border-radius: 6px ;
                background: var(--bgColor-default, #fff) ;
                color: var(--fgColor-muted, #656d76) ; cursor: pointer }
            .ghp-btn:hover { background: var(--bgColor-neutral-muted, rgba(175,184,193,0.2)) }
            .ghp-btn.ghp-selected {
                color: #fff ; background: var(--bgColor-accent-emphasis, #0969da) ;
                border-color: transparent }
            .ghp-btn svg { fill: currentColor }
            .ghp-gallery { width: 100% }
            .ghp-gallery.ghp-tiled {
                display: grid ; gap: 12px ;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)) }
            .ghp-gallery.ghp-fullw { display: flex ; flex-direction: column ; gap: 16px }
            .ghp-item {
                display: block ; padding: 8px ; overflow: hidden ;
                border: 1px solid var(--borderColor-default, #d0d7de) ; border-radius: 6px ;
                background: var(--bgColor-default, #fff) ;
                color: inherit ; text-decoration: none !important }
            .ghp-item:hover { border-color: var(--fgColor-accent, #0969da) }
            .ghp-name {
                margin: 0 0 6px ; font-size: 12px ; font-weight: 600 ;
                white-space: nowrap ; overflow: hidden ; text-overflow: ellipsis ;
                color: var(--fgColor-default, #1f2328) }
            .ghp-thumb { display: flex ; align-items: center ; justify-content: center }
            .ghp-tiled .ghp-thumb { height: 150px }
            .ghp-tiled .ghp-thumb img { max-height: 150px ; max-width: 100% ; object-fit: contain }
            .ghp-fullw .ghp-thumb img { max-width: 100% ; height: auto }
            .ghp-thumb svg.ghp-icon { width: 64px ; height: 64px ; fill: var(--fgColor-muted, #656d76) }
            img.ghp-error { border: 3px solid #cf222e ; border-radius: 6px ; min-width: 32px ; min-height: 32px }`);


        const TILED_SVG = `
        <svg class="octicon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16">
            <path d="M0 0h7v7H0zM9 9h7v7H9zM9 0h7v7H9zM0 9h7v7H0z"/>
        </svg>`;
        const FULLW_SVG = `
        <svg class="octicon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16">
            <path d="M0 0h16v7H0zM0 9h16v7H0z"/>
        </svg>`;
        const FOLDER_ICON = `
        <svg class="ghp-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
            <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/>
        </svg>`;
        const FILE_ICON = `
        <svg class="ghp-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
            <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/>
        </svg>`;

        // ----- image gallery -----

        const getTable = () => $('table[aria-labelledby="folders-and-files"]');

        function rowEntries(table) {
            const entries = [];
            $$('tbody tr', table).forEach((row) => {
                const link = $('.react-directory-truncate a[href], td a[href]', row);
                if (!link) return;
                const name = (link.textContent || '').trim();
                if (!name || name === '..') return;
                const href = link.href;
                if (!href.includes('/blob/') && !href.includes('/tree/')) return;
                entries.push({ name, href, isFolder: href.includes('/tree/') });
            });
            return entries;
        }

        function ensureToggleBar(table) {
            let bar = $('.ghp-toggles');
            if (!bar) {
                bar = document.createElement('div');
                bar.className = 'ghp-toggles';
                bar.innerHTML = `
                    <button type="button" class="ghp-btn ghp-toggle-tiled" title="Show tiled files with image preview">${TILED_SVG}</button>
                    <button type="button" class="ghp-btn ghp-toggle-fullw" title="Show full width files with image preview">${FULLW_SVG}</button>`;
                $('.ghp-toggle-tiled', bar).addEventListener('click', () => toggleView('tiled'));
                $('.ghp-toggle-fullw', bar).addEventListener('click', () => toggleView('fullw'));
            }
            if (table.previousElementSibling !== bar) {
                table.parentElement.insertBefore(bar, table);
            }
        }

        function toggleView(name) {
            state = state === name ? '' : name;
            store.set(state);
            sync();
        }

        function makeThumb(entry) {
            const div = document.createElement('div');
            div.className = 'ghp-thumb';

            if (entry.isFolder) {
                div.innerHTML = FOLDER_ICON;
                return div;
            }
            const raw = entry.href.replace('/blob/', '/raw/');
            if (IMG_EXT.test(entry.name)) {
                const img = document.createElement('img');
                img.loading = 'lazy';
                img.alt = entry.name;
                img.addEventListener('error', () => img.classList.add('ghp-error'), { once: true });
                img.src = raw;
                div.append(img);
            } else if (SVG_EXT.test(entry.name)) {
                // raw SVGs come back text/plain — fetched lazily, inlined as base64
                const img = document.createElement('img');
                img.alt = entry.name;
                img.src = SPINNER;
                img.dataset.ghpSvg = raw;
                div.append(img);
            } else {
                div.innerHTML = FILE_ICON;
            }
            return div;
        }

        function buildGallery(table, entries) {
            const gallery = document.createElement('div');
            gallery.className = 'ghp-gallery';
            gallery.dataset.path = window.location.pathname;
            gallery.dataset.count = String(entries.length);

            entries.forEach((entry) => {
                const item = document.createElement('a');
                item.className = 'ghp-item';
                item.href = entry.href;

                const h4 = document.createElement('h4');
                h4.className = 'ghp-name';
                h4.title = entry.name;
                h4.textContent = entry.name;

                item.append(h4, makeThumb(entry));
                gallery.append(item);
            });

            table.insertAdjacentElement('afterend', gallery);
            lazyLoadSvgs(gallery);
        }

        function lazyLoadSvgs(scope) {
            const imgs = $$('img[data-ghp-svg]', scope);
            if (!imgs.length) return;
            if (!('IntersectionObserver' in window)) {
                imgs.forEach(loadSvg);
                return;
            }
            const io = new IntersectionObserver((observed) => {
                observed.forEach((e) => {
                    if (!e.isIntersecting) return;
                    io.unobserve(e.target);
                    loadSvg(e.target);
                });
            });
            imgs.forEach((img) => io.observe(img));
        }

        async function loadSvg(img) {
            const url = img.dataset.ghpSvg;
            if (!url) return;
            delete img.dataset.ghpSvg;
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text)));
            } catch (e) {
                img.classList.add('ghp-error');
                img.title = 'Failed to load SVG preview';
            }
        }

        function sync() {
            const table = getTable();
            const gallery = $('.ghp-gallery');
            if (!table) {
                if (gallery) gallery.remove();
                const bar = $('.ghp-toggles');
                if (bar) bar.remove();
                return;
            }

            ensureToggleBar(table);

            $('.ghp-toggle-tiled').classList.toggle('ghp-selected', state === 'tiled');
            $('.ghp-toggle-fullw').classList.toggle('ghp-selected', state === 'fullw');

            if (!state) {
                table.classList.remove('ghp-hidden');
                if (gallery) gallery.remove();
                return;
            }

            const entries = rowEntries(table);
            const stale = !gallery ||
                gallery.dataset.path !== window.location.pathname ||
                gallery.dataset.count !== String(entries.length);
            if (stale) {
                if (gallery) gallery.remove();
                buildGallery(table, entries);
            }

            const g = $('.ghp-gallery');
            g.classList.toggle('ghp-tiled', state === 'tiled');
            g.classList.toggle('ghp-fullw', state === 'fullw');
            table.classList.add('ghp-hidden');
        }

        registerSync(sync);
    })();

    // ===============================================================
    // MODULE 3 — Preview HTML button (arrupe's GitHub HTML Preview ·
    // WTFPL) — restored to the ORIGINAL behavior: a Preview button
    // cloned from GitHub's "Add to space" control on .html blob
    // pages, opening htmlpreview.github.io in a new tab. Embedded
    // verbatim; its private observer/debounce replaced by the
    // suite's shared observer.
    // ===============================================================

    (function moduleHtmlPreview() {


    const BUTTON_ID = 'mb-github-html-preview';
    const TOOLTIP_ID = 'mb-github-html-preview-tooltip';
    const PREVIEW_BASE = 'https://htmlpreview.github.io/?';

    // -------------------------------------------------------------------------
    // Determine whether the current page is an HTML file in GitHub's code view
    // -------------------------------------------------------------------------

    function isHtmlFilePage() {
        return (
            location.hostname === 'github.com' &&
            location.pathname.includes('/blob/') &&
            /\.html$/i.test(location.pathname)
        );
    }

    // Strip query strings such as ?plain=1 and hashes from the source URL.
    function getFileUrl() {
        return location.origin + location.pathname;
    }

    function getPreviewUrl() {
        return PREVIEW_BASE + getFileUrl();
    }

    // -------------------------------------------------------------------------
    // Locate GitHub's "Add to space" button
    // -------------------------------------------------------------------------

    function getAccessibleText(element) {
        const parts = [
            element.getAttribute('aria-label'),
            element.getAttribute('title'),
            element.textContent
        ];

        const labelledBy = element.getAttribute('aria-labelledby');

        if (labelledBy) {
            for (const id of labelledBy.split(/\s+/)) {
                const label = document.getElementById(id);
                if (label) {
                    parts.push(label.textContent);
                }
            }
        }

        return parts
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function findAddToSpaceButton() {
        // Fast path for the normal accessible labels GitHub uses.
        const selectors = [
            'button[aria-label*="Add to space" i]',
            'a[aria-label*="Add to space" i]',
            '[role="button"][aria-label*="Add to space" i]',
            'button[title*="Add to space" i]',
            'a[title*="Add to space" i]'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);

            if (element) {
                return element;
            }
        }

        // Fallback in case GitHub changes the exact markup but keeps
        // the accessible name.
        const candidates = document.querySelectorAll(
            'button, a, [role="button"]'
        );

        for (const element of candidates) {
            const text = getAccessibleText(element).toLowerCase();

            if (
                text.includes('add to space') ||
                text.includes('add file to space') ||
                text.includes('add to copilot space')
            ) {
                return element;
            }
        }

        return null;
    }

    // -------------------------------------------------------------------------
    // Icon
    //
    // Recreates the uploaded </> rectangle icon using currentColor so it
    // automatically matches GitHub's current foreground color.
    // -------------------------------------------------------------------------

    function getIcon() {
        return `
            <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style="display:block"
            >
                <rect
                    x="1.25"
                    y="2.5"
                    width="13.5"
                    height="11"
                    rx="2"
                    stroke="currentColor"
                    stroke-width="1.5"
                />

                <path
                    d="M6 5.25L3.25 8L6 10.75"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />

                <path
                    d="M10 5.25L12.75 8L10 10.75"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />

                <path
                    d="M8.75 4.75L7.25 11.25"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                />
            </svg>
        `;
    }

    // -------------------------------------------------------------------------
    // GitHub-style tooltip
    // -------------------------------------------------------------------------

    function getTooltip() {
        let tooltip = document.getElementById(TOOLTIP_ID);

        if (tooltip) {
            return tooltip;
        }

        tooltip = document.createElement('div');
        tooltip.id = TOOLTIP_ID;
        tooltip.textContent = 'Preview HTML';

        Object.assign(tooltip.style, {
            position: 'fixed',
            zIndex: '2147483647',
            display: 'none',

            padding: '6px 8px',

            fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '12px',
            fontWeight: '600',
            lineHeight: '16px',

            color:
                'var(--fgColor-onEmphasis, var(--color-fg-on-emphasis, #ffffff))',

            background:
                'var(--bgColor-emphasis, var(--color-neutral-emphasis-plus, #24292f))',

            borderRadius: '6px',
            boxShadow: 'var(--shadow-resting-small, 0 1px 4px rgba(0,0,0,.20))',

            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            opacity: '0',

            transition: 'opacity 80ms ease'
        });

        document.body.appendChild(tooltip);

        return tooltip;
    }

    function showTooltip(button) {
        const tooltip = getTooltip();
        const rect = button.getBoundingClientRect();

        tooltip.style.display = 'block';
        tooltip.style.opacity = '0';

        // Calculate after display:block so width is available.
        const tooltipRect = tooltip.getBoundingClientRect();

        let left =
            rect.left +
            rect.width / 2 -
            tooltipRect.width / 2;

        let top = rect.bottom + 8;

        // Keep tooltip inside viewport.
        left = Math.max(
            8,
            Math.min(
                left,
                window.innerWidth - tooltipRect.width - 8
            )
        );

        // If there isn't enough room below the button, display above it.
        if (top + tooltipRect.height > window.innerHeight - 8) {
            top = rect.top - tooltipRect.height - 8;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;

        requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
        });
    }

    function hideTooltip() {
        const tooltip = document.getElementById(TOOLTIP_ID);

        if (!tooltip) {
            return;
        }

        tooltip.style.opacity = '0';

        setTimeout(() => {
            if (tooltip.style.opacity === '0') {
                tooltip.style.display = 'none';
            }
        }, 100);
    }

    // -------------------------------------------------------------------------
    // Create button
    // -------------------------------------------------------------------------

    function createPreviewButton(spaceButton) {
        /*
         * Copy GitHub's actual Add to space button.
         *
         * This is more reliable than trying to reproduce Primer's CSS classes
         * ourselves and means the preview button automatically inherits changes
         * GitHub makes to:
         *
         *   - size
         *   - border
         *   - border radius
         *   - hover state
         *   - light mode
         *   - dark mode
         *   - high contrast themes
         */

        const button = spaceButton.cloneNode(true);

        button.id = BUTTON_ID;

        // Remove duplicated IDs from anything GitHub placed inside the button.
        button.querySelectorAll('[id]').forEach(element => {
            element.removeAttribute('id');
        });

        // Remove attributes that may still point at GitHub's Add-to-Space
        // menu/controllers.
        const attributesToRemove = [
            'aria-expanded',
            'aria-haspopup',
            'aria-controls',
            'aria-labelledby',
            'data-action',
            'data-target',
            'data-menu-button',
            'popovertarget',
            'popoverTarget'
        ];

        for (const attribute of attributesToRemove) {
            button.removeAttribute(attribute);
        }

        // Make sure it isn't disabled because of anything copied from GitHub.
        button.removeAttribute('disabled');

        // Accessibility.
        button.setAttribute('aria-label', 'Preview HTML');

        // Native fallback tooltip.
        button.setAttribute('title', 'Preview HTML');

        // Replace GitHub's icon with the custom </> icon.
        button.innerHTML = getIcon();

        // If GitHub's control is a normal button.
        if (button.tagName === 'BUTTON') {
            button.type = 'button';
        }

        // If GitHub happens to implement the source control as an anchor.
        if (button.tagName === 'A') {
            button.href = getPreviewUrl();
            button.target = '_blank';
            button.rel = 'noopener noreferrer';
        }

        button.addEventListener(
            'click',
            event => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                hideTooltip();

                window.open(
                    getPreviewUrl(),
                    '_blank',
                    'noopener,noreferrer'
                );
            },
            true
        );

        button.addEventListener('mouseenter', () => {
            showTooltip(button);
        });

        button.addEventListener('mouseleave', hideTooltip);

        button.addEventListener('focus', () => {
            showTooltip(button);
        });

        button.addEventListener('blur', hideTooltip);

        return button;
    }

    // -------------------------------------------------------------------------
    // Main update
    // -------------------------------------------------------------------------

    function updateButton() {
        const existingButton = document.getElementById(BUTTON_ID);

        // Remove the button if we navigated away from an HTML file.
        if (!isHtmlFilePage()) {
            existingButton?.remove();
            hideTooltip();
            return;
        }

        const spaceButton = findAddToSpaceButton();

        if (!spaceButton) {
            return;
        }

        // GitHub may rebuild its toolbar during Turbo navigation.
        if (
            existingButton &&
            existingButton.isConnected &&
            existingButton.parentElement === spaceButton.parentElement
        ) {
            return;
        }

        existingButton?.remove();

        const previewButton = createPreviewButton(spaceButton);

        /*
         * Insert immediately before Add to space:
         *
         * [ Preview HTML ] [ Add to space ]
         */
        spaceButton.parentNode.insertBefore(
            previewButton,
            spaceButton
        );
    }


        registerSync(updateButton);
    })();

    // ===============================================================
    // MODULE 4 — Download-folder menu (from arrupe's GitHub Folder
    // Downloader · WTFPL) — a "Download folder" dropdown on folder
    // pages offering Download Directory and DownGit
    // ===============================================================

    (function moduleFolderDownload() {
        const CLASS = 'ghs-folder-dl';

        function sync() {
            const isFolder = window.location.pathname.includes('/tree/');
            const existing = $('.' + CLASS);

            if (!isFolder) {
                if (existing) existing.remove();
                return;
            }
            if (existing) {
                if (existing.dataset.path === window.location.pathname) return;
                existing.remove(); // navigated to a different folder — rebuild with fresh links
            }

            const anchor = $('[data-testid="tree-overflow-menu-anchor"]');
            if (!anchor) return; // toolbar not rendered yet — retry on next pass

            const url = encodeURIComponent(window.location.origin + window.location.pathname);
            const details = document.createElement('details');
            details.className = `details-overlay details-reset position-relative mr-2 ${CLASS}`;
            details.dataset.path = window.location.pathname;
            details.innerHTML = `
                <summary role="button" data-view-component="true">
                    <span class="btn d-flex flex-items-center">Download folder<span class="dropdown-caret ml-1"></span></span>
                </summary>
                <div class="dropdown-menu dropdown-menu-sw" style="top: 38px; width: 220px;">
                    <ul class="list-style-none">
                        <li class="Box-row Box-row--hover-gray p-3 mt-0">
                            <a class="d-flex flex-items-center text-bold no-underline" target="_blank" rel="noopener noreferrer"
                               href="https://download-directory.github.io/?url=${url}">Download Directory</a>
                        </li>
                        <li class="Box-row Box-row--hover-gray p-3 mt-0">
                            <a class="d-flex flex-items-center text-bold no-underline" target="_blank" rel="noopener noreferrer"
                               href="https://downgit.github.io/#/home?url=${url}">DownGit</a>
                        </li>
                    </ul>
                </div>`;

            anchor.insertAdjacentElement('beforebegin', details);
        }

        registerSync(sync);
    })();

    // ===============================================================
    // MODULE 5 — Wiki sidebar toggle (from Rob Garrison's GitHub
    // Toggle Wiki Sidebar · MIT) — remote @require deps replaced
    // with local helpers; persisted state key unchanged
    // ===============================================================

    (function moduleWikiSidebar() {
        const BTN_CLASS = 'ghtws-button';
        const STATE_KEY = 'sidebar-state';

        let isHidden = typeof GM_getValue == 'function' ? GM_getValue(STATE_KEY, false) : false;

        addStyle(`
            .${BTN_CLASS} > * { pointer-events: none }
            .${BTN_CLASS} { margin-right: 6px }`);

        const TOGGLE_ICON = `
        <svg class="octicon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
            <path fill="none" stroke="currentColor" stroke-miterlimit="10" d="M.5 3.5h10v9H.5z"/>
            <path fill="currentColor" stroke="currentColor" stroke-miterlimit="10" d="M7 7.8l1.5-1.2V9zM10.5 3.5h5v9h-5v-9zm4.3 4.3l-4.3-3V11l4.3-3.2z"/>
        </svg>`;

        function applySidebar(button) {
            const sidebar = $('.wiki-rightbar');
            const wrapper = sidebar && sidebar.parentNode;
            if (!sidebar || !wrapper) return;
            const action = isHidden ? 'remove' : 'add';
            if (button) button.classList.toggle('selected', isHidden);
            wrapper.style.display = isHidden ? 'none' : '';
            wrapper.classList[action]('has-rightbar');
            if (wrapper.previousElementSibling) {
                wrapper.previousElementSibling.classList[action]('col-md-9');
            }
            if (typeof GM_setValue == 'function') GM_setValue(STATE_KEY, isHidden);
        }

        document.body.addEventListener('click', (event) => {
            const target = event.target;
            if (target && target.classList && target.classList.contains(BTN_CLASS)) {
                isHidden = !isHidden;
                applySidebar(target);
            }
        });

        function sync() {
            if (!$('#wiki-wrapper') || $('.' + BTN_CLASS)) return;

            let el = $('.gh-header-actions') || $('.gh-header-title');
            if (!el) return;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = `btn btn-sm tooltipped tooltipped-s ${BTN_CLASS}${isHidden ? ' selected' : ''}`;
            button.setAttribute('aria-label', 'Toggle Sidebar');
            button.innerHTML = TOGGLE_ICON;

            if (el.nodeName === 'H1') {
                // non-editable wiki pages
                button.style.float = 'right';
                el = el.parentNode;
            }
            el.prepend(button);

            if (isHidden) applySidebar(button);
        }

        registerSync(sync);
    })();

    // ===============================================================
    // Shared observer — GitHub is a soft-navigating SPA; one
    // frame-throttled observer runs every module's idempotent sync
    // ===============================================================

    let scheduled = false;
    const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            runSyncs();
        });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('turbo:load', runSyncs);

    runSyncs();
})();