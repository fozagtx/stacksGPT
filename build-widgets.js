// Build script for widgets using esbuild
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const widgetsDir = join(__dirname, 'src', 'widgets');
const outDir = join(__dirname, 'dist', 'widgets');

// Ensure output directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Copy HTML files
const htmlFiles = ['deposit.html', 'withdrawal.html', 'status.html'];
htmlFiles.forEach(file => {
  const src = join(widgetsDir, file);
  const dest = join(outDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`📄 Copied ${file}`);
  }
});

console.log('🔨 Building widgets...');

// Build configuration
const buildConfig = {
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  external: [],
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};

async function buildWidgets() {
  try {
    // Build deposit widget
    await esbuild.build({
      ...buildConfig,
      entryPoints: [join(widgetsDir, 'DepositWidget.tsx')],
      outfile: join(outDir, 'deposit.js')
    });
    console.log('✅ Built deposit widget');

    // Build withdrawal widget
    await esbuild.build({
      ...buildConfig,
      entryPoints: [join(widgetsDir, 'WithdrawalWidget.tsx')],
      outfile: join(outDir, 'withdrawal.js')
    });
    console.log('✅ Built withdrawal widget');

    // Build status widget
    await esbuild.build({
      ...buildConfig,
      entryPoints: [join(widgetsDir, 'StatusWidget.tsx')],
      outfile: join(outDir, 'status.js')
    });
    console.log('✅ Built status widget');

    console.log('🎉 All widgets built successfully!');
  } catch (error) {
    console.error('❌ Widget build failed:', error);
    process.exit(1);
  }
}

buildWidgets();