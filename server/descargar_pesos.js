const fs = require('fs');
const https = require('https');
const path = require('path');

const modelsDir = path.join(__dirname, 'models');
if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir);

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const files = [
    'ssd_mobilenetv1_model-weights_manifest.json',
    'ssd_mobilenetv1_model-shard1',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1'
];

console.log("⏳ Descargando modelos de IA para nc-s1125...");

files.forEach(file => {
    const fileStream = fs.createWriteStream(path.join(modelsDir, file));
    https.get(baseUrl + file, (res) => {
        res.pipe(fileStream);
        res.on('finish', () => {
            fileStream.close();
            console.log(`✅ Descargado: ${file}`);
        });
    }).on('error', (err) => {
        console.error(`❌ Error en ${file}:`, err.message);
    });
});