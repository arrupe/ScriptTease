// ==UserScript==
// @name              Scroll to Top and Bottom Buttons
// @namespace         https://github.com/arrupe
// @version           1.0.0
// @description       Generate two scroll buttons in the bottom right corner of all pages, one for smoothly scrolling back to the top and one for smoothly scrolling to the bottom.
// @author            arrupe
// @license           MIT
// @match             *://*/*
// @run-at            document-end
// @grant             GM_registerMenuCommand
// @grant             GM_setValue
// @grant             GM_getValue
// @icon              data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAACXBIWXMAAAsTAAALEwEAmpwYAAADO0lEQVR4nO3ZXUsUURwG8P0ACYoXoWheRYi9kG3zQAR9RjW6cAV3LyKKIMKKunHTnNFdtTNW0CewFCIyqjsxTmovYO7O7nnd//PAAdmLceb57f/M7G6pxDAMwzAR5eLj1bOXXyxtlZfW98vL6/v6b/2a7/MSkfGHT8Ym62vfkOUHf6/JeuPH+MLCed/nJ7J8EMF/+SCC//JBBP/lgwj+ywcRus+lZ/WRq4ur3zst/3jpY0zcez5q4JTk5OarNwPXXjZ3uy3/eE08Xdw9d+fugO/riiJX6qofWd40Vb5e5eX1g6FKTQ3XaoO+r09c+dArVQfDlRoRWm07SNWG8fKPlgY4WhvcjhyXj38BiOBk28lOBeB25LJ8nAAgHsFl+fgPgFgE1+XjFABxCD7KRwsAMQi+ykcbAD2P4LN8tAnQswi+y0cBgJ5DCKF8FAToGYRQykcHANEjhFQ+OgSIFiG08tEFQHQIIZaPLgGiQQi1fBgACB4h5PJhCCBYhNDLh0GA4BBiKB+GAYJBiKV8WADwjmCz/CRTry0ANHsG4cbK+74kVZtW3q2p2vj1G7Hh4+of4vUP8jYQhivVzcG5uT5nAMjy2zbLLx3+D6PH1se0ijBbm3EGkKRqx8a2c73R+D3KNgB0xubn+61sR7PVHWcASNVHm+XbBLCFMDRb2y65CtJ8xsa24wrgz3ZU3TR4H5guRXcTTk8u3wWAWQTHN2ETj6EnbTuuAUxsR1F+FmhVvkuAbhCC+TScpHnDZPmuATpBCKL8ogjtlu8DoAhCUOW3i1CkfF8A7SAEWX4rhKLl+wQ4DSHo8o9zq/7uTJKq6STLtw+XmtKvFT0OPALo6MdK/fXCUKX6QS/9nO/8UdNn4BlAfEAAvwEBCCA64AQQQHTACSCA6IATQADRASeAAKIDTgABRAecAAKIDjgBBBAdcAIIIDrgBBBAdMAJIIDogBNAANEBJ4AAogNOAAFEB5wAAogOOAEEEB1wAgggOuAEEEB0wAnwmyRTX40hpPkXz5cTX5Dlj0wBJGl+3/f1RJfyytaFJFOfu3/3q0/J2taI7+uJMuXm21Fk+QOk+V4H286efuezfIZhGKYUaH4C72t5mm5DSxAAAAAASUVORK5CYII=
// ==/UserScript==
(function () {
    'use strict'
    let buttonTopKey = GM_getValue('buttonTopKey', '')
    let buttonBottomKey = GM_getValue('buttonBottomKey', '')
    var style = document.createElement('style')
    GM_registerMenuCommand('SetHotkey', showHotkeyModal)
    function showHotkeyModal() {
        let modalHtml = `
        <div id="hotkeyModal" style="position: fixed; z-index: 10000; background: white; padding: 20px; border-radius: 8px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.5); top: 20%; left: 50%; transform: translate(-50%, -20%); max-width: 300px;">
            <h2 style="margin-top: 0;">ButtonKey</h2>
            <div style="margin-bottom: 10px;">
                <label for="hotkeyInput1" style="display: block; margin-bottom: 5px;">buttonTopKey:</label>
                <input id="hotkeyInput1" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="${buttonTopKey}" />
            </div>
            <div style="margin-bottom: 20px;">
                <label for="hotkeyInput2" style="display: block; margin-bottom: 5px;">buttonBottomKey:</label>
                <input id="hotkeyInput2" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="${buttonBottomKey}" />
            </div>
            <div style="text-align: right;">
                <button id="saveHotkeys" style="background-color: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Save</button>
                <button id="closeModal" style="background-color: #f44336; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
        </div>`
        let modalDiv = document.createElement('div')
        modalDiv.innerHTML = modalHtml
        document.body.appendChild(modalDiv)
        document.getElementById('hotkeyInput1').addEventListener('keydown', function (event) {
            event.preventDefault()
            buttonTopKey = event.key
            this.value = buttonTopKey
        })
        document.getElementById('hotkeyInput2').addEventListener('keydown', function (event) {
            event.preventDefault()
            buttonBottomKey = event.key
            this.value = buttonBottomKey
        })
        document.getElementById('saveHotkeys').addEventListener('click', function () {
            GM_setValue('buttonTopKey', buttonTopKey)
            GM_setValue('buttonBottomKey', buttonBottomKey)
            closeModal()
        })
        document.getElementById('closeModal').addEventListener('click', closeModal)
    }
    function closeModal() {
        let modal = document.getElementById('hotkeyModal')
        if (modal) {
            modal.remove()
        }
    }
    document.addEventListener('keydown', function (event) {
        if (event.target.matches('input, textarea, [contenteditable="true"]')) {
            return
        }
        if (event.key === GM_getValue('buttonTopKey')) {
            goToTop()
        } else if (event.key === GM_getValue('buttonBottomKey')) {
            goToBottom()
        }
    })
    style.innerHTML = `
:root {
    --button-size: 29.4px;
    --button-margin: 1px;
}
.GO_TO_TOP_button, .GO_TO_BOTTOM_button {
    width: var(--button-size);  
    height: var(--button-size);  
    border-radius: 5.6px;  
    box-shadow: 0 3px 6px rgb(0 0 0 / 16%), 0 1px 2px rgb(0 0 0 / 23%);
    position: fixed;
    right: 14px;  
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999999;
    background-color: white;
    opacity: 0.8;
    transition: opacity 0.2s ease-in-out;
    cursor: pointer;
}
    .GO_TO_TOP_button svg, .GO_TO_BOTTOM_button svg {
        left: 16.8px;  
        height: 16.8px;  
        margin: 0;
    }
    .GO_TO_TOP_button {
        bottom: 49px;  
    }
    .GO_TO_BOTTOM_button {
        bottom: 14px;  
    }
    `
    document.head.appendChild(style)
    const goToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        })
    }
    const goToBottom = () => {
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
        })
    }
    const buttonTop = document.createElement('div')
    buttonTop.className = 'GO_TO_TOP_button'
    buttonTop.innerHTML = `
    <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <path d="M825.568 555.328l-287.392-289.28C531.808 259.648 523.488 256.576 515.2 256.64 514.08 256.544 513.12 256 512 256c-4.672 0-9.024 1.088-13.024 2.88-4.032 1.536-7.872 3.872-11.136 7.136l-259.328 258.88c-12.512 12.48-12.544 32.736-0.032 45.248 6.24 6.272 14.432 9.408 22.656 9.408 8.192 0 16.352-3.136 22.624-9.344L480 364.288V928c0 17.696 14.336 32 32 32s32-14.304 32-32V362.72l236.192 237.728c6.24 6.272 14.496 9.44 22.688 9.44s16.32-3.104 22.56-9.312C838.016 588.128 838.048 567.84 825.568 555.328z"/>
        <path d="M864 192H160C142.336 192 128 177.664 128 160s14.336-32 32-32h704c17.696 0 32 14.336 32 32S881.696 192 864 192z"/>
    </svg>`
    const buttonBottom = document.createElement('div')
    buttonBottom.className = 'GO_TO_BOTTOM_button'
    buttonBottom.innerHTML = `
    <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <path d="M198.4 468.352l287.392 289.28c6.368 6.4 14.688 9.472 22.976 9.408 1.12 0.096 2.08 0.64 3.2 0.64 4.672 0 9.024-1.088 13.024-2.88 4.032-1.536 7.872-3.872 11.136-7.136l259.328-258.88c12.512-12.48 12.544-32.736 0.032-45.248-6.24-6.272-14.432-9.408-22.656-9.408-8.192 0-16.352 3.136-22.624 9.344L544 659.712V96c0-17.696-14.336-32-32-32s-32 14.304-32 32v565.28L243.808 423.552c-6.24-6.272-14.496-9.44-22.688-9.44s-16.32 3.104-22.56 9.312c-12.48 12.512-12.512 32.8-0.032 45.312z"/>
        <path d="M160 832h704c17.664 0 32 14.336 32 32s-14.336 32-32 32H160c-17.664 0-32-14.336-32-32s14.336-32 32-32z"/>
    </svg>`
    buttonTop.addEventListener('click', goToTop)
    buttonBottom.addEventListener('click', goToBottom)
    buttonTop.style.display = 'none'
    buttonBottom.style.display = 'none'
    document.body.appendChild(buttonTop)
    document.body.appendChild(buttonBottom)
    let timer
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 50) {
            buttonTop.style.opacity = '0.8'
            buttonTop.style.display = 'flex'
            buttonBottom.style.opacity = '0.8'
            buttonBottom.style.display = 'flex'
        } else if (window.pageYOffset === 0) {
            buttonTop.style.opacity = '0'
            buttonBottom.style.opacity = '0'
            setTimeout(() => {
                buttonTop.style.display = 'none'
                buttonBottom.style.display = 'none'
            }, 200)
        }
        clearTimeout(timer)
        timer = setTimeout(() => {
            buttonTop.style.opacity = '0'
            buttonBottom.style.opacity = '0'
            setTimeout(() => {
                buttonTop.style.display = 'none'
                buttonBottom.style.display = 'none'
            }, 200)
        }, 1800)
    })
})()