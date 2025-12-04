(function () {
    const SCRIPT_ID = 'bethel-bible-bot-script';
    const IFRAME_ID = 'bethel-bible-bot-iframe';
    // const APP_URL = 'http://localhost:3000'; // Dev
    const APP_URL = 'https://bethel-metro-social.web.app'; // Prod (Update this after deploy)

    if (document.getElementById(SCRIPT_ID)) return;

    const style = document.createElement('style');
    style.innerHTML = `
    #${IFRAME_ID} {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 80px;
      height: 80px;
      border: none;
      z-index: 999999;
      transition: width 0.3s ease, height 0.3s ease;
      color-scheme: none;
    }
    #${IFRAME_ID}.open {
      width: 400px;
      height: 600px;
    }
  `;
    document.head.appendChild(style);

    const iframe = document.createElement('iframe');
    iframe.id = IFRAME_ID;
    iframe.src = `${APP_URL}/chat-embed`;
    iframe.allow = "microphone";
    document.body.appendChild(iframe);

    // Listen for messages from the iframe to resize
    window.addEventListener('message', (event) => {
        // if (event.origin !== APP_URL) return; // Security check (enable in prod)

        if (event.data.type === 'TOGGLE_CHAT') {
            const el = document.getElementById(IFRAME_ID);
            if (el) {
                if (event.data.isOpen) {
                    el.classList.add('open');
                } else {
                    el.classList.remove('open');
                }
            }
        }
    });
})();
