window.addEventListener('error', e => require('fs').appendFileSync('frontend-error.log', e.error.stack + '\n'));
