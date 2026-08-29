// ==UserScript==
// @name         Freedium — Open Mirror Button
// @namespace    httpsL//github.com/arrupe/
// @version      2.1.0
// @description  Replaces Medium's Follow button with a custom-styled "Open Mirror" button.
// @author       arrupe
// @license      WTFPL
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @grant        none
// @icon https://avatars.githubusercontent.com/u/142643505?s=200&v=4
// ==/UserScript==

(function () {
    'use strict';

    const MIRROR_BASE = 'https://freedium-mirror.cfd/';
    const BTN_CLASS = 'eds-open-mirror-btn';
    const DONE_ATTR = 'edsMirrorDone';

    function isMediumSite() {
        if (/(^|\.)medium\.com$/i.test(window.location.hostname)) {
            return true;
        }

        const androidPkg = document.querySelector(
            'meta[property="al:android:package"]'
        );

        if (androidPkg?.content === 'com.medium.reader') {
            return true;
        }

        const appName = document.querySelector(
            'meta[property="al:android:app_name"], ' +
            'meta[property="al:ios:app_name"], ' +
            'meta[name="twitter:app:name:iphone"]'
        );

        if (/^medium$/i.test(appName?.content?.trim() || '')) {
            return true;
        }

        const appUrl = document.querySelector(
            'meta[property="al:android:url"], ' +
            'meta[property="al:ios:url"]'
        );

        return /^medium:\/\//i.test(appUrl?.content || '');
    }

    function getPageArticleUrl() {
        const canonical = document.querySelector('link[rel="canonical"]');

        if (canonical?.href) {
            return canonical.href;
        }

        const ogUrl = document.querySelector('meta[property="og:url"]');

        if (ogUrl?.content) {
            return ogUrl.content;
        }

        const alUrl = document.querySelector(
            'meta[property="al:web:url"]'
        );

        if (alUrl?.content) {
            return alUrl.content;
        }

        return window.location.origin + window.location.pathname;
    }

    function getArticleUrlForButton(button) {
        const article = button.closest('article');

        if (article) {
            const links = article.querySelectorAll('a[href]');

            for (const link of links) {
                try {
                    const url = new URL(
                        link.getAttribute('href'),
                        window.location.origin
                    );

                    if (
                        /-[0-9a-f]{8,16}$/i.test(url.pathname) ||
                        /^\/p\/[0-9a-f]+/i.test(url.pathname)
                    ) {
                        return url.origin + url.pathname;
                    }
                } catch {
                    // Ignore malformed URLs.
                }
            }
        }

        return getPageArticleUrl();
    }

    function buildMirrorUrl(articleUrl) {
        return MIRROR_BASE + articleUrl.replace(/^https?:\/\//i, '');
    }

    function isFollowButton(button) {
        const text = (button.textContent || '').trim();

        return text === 'Follow' || text === 'Following';
    }

    function styleButton(button, originalButton) {
        const cs = getComputedStyle(originalButton);

        Object.assign(button.style, {
            backgroundColor: '#ADD8E6',
            color: '#1a1a1a',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',

            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',

            boxSizing: 'border-box',
            verticalAlign: 'middle',
            alignSelf: 'center',
            flexShrink: '0',

            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            lineHeight: cs.lineHeight,
            letterSpacing: cs.letterSpacing,

            padding: cs.padding,
            borderRadius: cs.borderRadius,
            height: cs.height
        });
    }

    function replaceFollowButton(followButton) {
        if (followButton.dataset[DONE_ATTR]) {
            return;
        }

        followButton.dataset[DONE_ATTR] = '1';

        const button = document.createElement('button');

        button.type = 'button';
        button.className = BTN_CLASS;
        button.dataset[DONE_ATTR] = '1';

        button.textContent = 'Open Mirror';
        button.title = 'Open this article on freedium-mirror.cfd';

        // Use the custom Open Mirror formatting while inheriting
        // Medium's current button dimensions and typography.
        styleButton(button, followButton);

        // Custom hover color from the original script.
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#9BCFE3';
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#ADD8E6';
        });

        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const articleUrl = getArticleUrlForButton(button);

            window.location.href = buildMirrorUrl(articleUrl);
        });

        followButton.replaceWith(button);
    }

    function processButtons() {
        document
            .querySelectorAll('button')
            .forEach((button) => {
                if (isFollowButton(button)) {
                    replaceFollowButton(button);
                }
            });
    }

    if (!isMediumSite()) {
        return;
    }

    processButtons();

    // Medium dynamically renders content and uses SPA navigation.
    let scheduled = false;

    const observer = new MutationObserver(() => {
        if (scheduled) {
            return;
        }

        scheduled = true;

        requestAnimationFrame(() => {
            scheduled = false;
            processButtons();
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();