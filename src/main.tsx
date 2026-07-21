import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'highlight.js/styles/github-dark.css';

import App from './app/App';
import { resolveLocaleRedirectPath } from './lib/i18n';
import './index.css';

const redirectPath = resolveLocaleRedirectPath(window.location.pathname);
if (redirectPath && redirectPath !== window.location.pathname) {
  window.location.replace(`${redirectPath}${window.location.search}${window.location.hash}`);
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
