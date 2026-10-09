const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(dir + '/' + file).isDirectory()) {
      filelist = walkSync(dir + '/' + file, filelist);
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css') || file.endsWith('.md')) {
        filelist.push(dir + '/' + file);
      }
    }
  });
  return filelist;
};

const directories = ['./components', './app', './hooks', './lib'];
let files = [];
directories.forEach(dir => {
  if (fs.existsSync(dir)) files = walkSync(dir, files);
});

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace project name
  content = content.replace(/tl;dr/gi, 'Obliivon');

  // Replace colors for minimalistic black/white theme
  content = content.replace(/indigo-(\d+)/g, 'neutral-$1');
  content = content.replace(/purple-(\d+)/g, 'zinc-$1');
  content = content.replace(/emerald-400/g, 'neutral-300');
  content = content.replace(/emerald-500/g, 'neutral-200');
  content = content.replace(/emerald-300/g, 'neutral-400');
  content = content.replace(/emerald-950/g, 'neutral-900');
  content = content.replace(/rose-(\d+)/g, 'neutral-$1');
  content = content.replace(/slate-(\d+)/g, 'neutral-$1');
  content = content.replace(/from-neutral-\d+\/20 to-neutral-\d+\/20/g, 'from-neutral-800/20 to-neutral-900/20');
  
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});
