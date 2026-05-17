const fs = require('fs');
let c = fs.readFileSync('logRegController.js','utf8');
c = c.replace(
  'const { login, password } = req.body;',
  'const { login, username, password } = req.body;\n  const loginField = login || username;'
);
c = c.replace('if (!login || !password)', 'if (!loginField || !password)');
c = c.split('[login]').join('[loginField]');
fs.writeFileSync('logRegController.js', c);
console.log('Готово!');
