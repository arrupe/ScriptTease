// ==UserScript==
// @name         GitHub HTML Preview
// @namespace    https://github.com/arrupe/
// @version      1.0.0
// @description  Adds a Preview HTML button beside GitHub's file controls for .html files.
// @author       arrupe
// @license      WTFPL
// @match        https://github.com/*
// @run-at       document-idle
// @grant        none
// @icon         https://cdn-icons-png.flaticon.com/512/41/41814.png
// ==/UserScript==

(function () {
    'use strict';

    const BUTTON_ID = 'mb-github-html-preview';
    const TOOLTIP_ID = 'mb-github-html-preview-tooltip';
    const PREVIEW_BASE = 'https://htmlpreview.github.io/?';

    let updateTimer = null;

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

    function scheduleUpdate() {
        clearTimeout(updateTimer);

        updateTimer = setTimeout(updateButton, 100);
    }

    // -------------------------------------------------------------------------
    // GitHub uses client-side/Turbo navigation, so watch for page changes.
    // -------------------------------------------------------------------------

    document.addEventListener('turbo:load', scheduleUpdate);
    document.addEventListener('pjax:end', scheduleUpdate);
    window.addEventListener('popstate', scheduleUpdate);

    const observer = new MutationObserver(scheduleUpdate);

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Initial page load.
    updateButton();
})();