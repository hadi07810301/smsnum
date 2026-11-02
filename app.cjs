// cPanel "Setup Node.js App" startup file. It simply starts the real server (an ES module).
import('./server/index.js').catch((e) => { console.error(e); process.exit(1) })
