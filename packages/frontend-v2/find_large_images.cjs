const fs = require('fs');
const path = require('path');

function getFiles(dir, files_) {
    files_ = files_ || [];
    const files = fs.readdirSync(dir);
    for (const i in files) {
        const name = dir + '/' + files[i];
        if (fs.statSync(name).isDirectory()) {
            if (!name.includes('node_modules') && !name.includes('.git')) {
                getFiles(name, files_);
            }
        } else {
            files_.push(name);
        }
    }
    return files_;
}

const frontendDir = 'c:/Users/josia/Desktop/projetos/cred30/packages/frontend-v2';
const allFiles = getFiles(frontendDir);

const imageExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
const largeImages = allFiles
    .filter(file => imageExtensions.includes(path.extname(file).toLowerCase()))
    .map(file => ({
        path: file,
        size: fs.statSync(file).size
    }))
    .filter(img => img.size > 50000) // Maior que 50KB
    .sort((a, b) => b.size - a.size);

console.log('Imagens grandes encontradas (>50KB):');
largeImages.forEach(img => {
    console.log(`${(img.size / 1024).toFixed(2)} KB - ${img.path.replace(frontendDir, '')}`);
});
