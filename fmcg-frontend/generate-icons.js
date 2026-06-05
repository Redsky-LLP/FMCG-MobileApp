// generate-icons.js - ES Module version (since package.json has "type": "module")
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Make sure the icons directory exists
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

const svgPath = path.join(iconsDir, 'icon.svg');

// Check if SVG exists
if (!fs.existsSync(svgPath)) {
    console.error('❌ icon.svg not found at:', svgPath);
    console.error('Please create public/icons/icon.svg first');
    process.exit(1);
}

const svgBuffer = fs.readFileSync(svgPath);

const sizes = [16, 32, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512];

async function generateIcons() {
    console.log('📱 Generating PWA icons from icon.svg...\n');
    
    for (const size of sizes) {
        const outputPath = path.join(iconsDir, `icon-${size}.png`);
        console.log(`  Creating icon-${size}.png...`);
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(outputPath);
    }
    
    // Generate maskable icon (512x512 with padding)
    console.log(`\n  Creating maskable icon (icon-512-maskable.png)...`);
    await sharp(svgBuffer)
        .resize(370, 370)
        .png()
        .toBuffer()
        .then(data => {
            return sharp({
                create: {
                    width: 512,
                    height: 512,
                    channels: 4,
                    background: { r: 37, g: 99, b: 235, alpha: 1 }
                }
            })
            .composite([{ input: data, gravity: 'center' }])
            .png()
            .toFile(path.join(iconsDir, 'icon-512-maskable.png'));
        });
    
    console.log('\n✅ All icons generated successfully!');
    console.log(`📍 Location: ${iconsDir}`);
    
    // List generated files
    const files = fs.readdirSync(iconsDir).filter(f => f.startsWith('icon-') && f.endsWith('.png'));
    console.log('\nGenerated files:');
    files.forEach(f => console.log(`  📁 ${f}`));
}

generateIcons().catch(err => {
    console.error('❌ Error generating icons:', err.message);
    process.exit(1);
});