import bcrypt from 'bcryptjs';

const password = 'test123';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('Password:', password);
console.log('Hash:', hash);

// ハッシュの検証
const isValid = bcrypt.compareSync(password, hash);
console.log('Verification:', isValid);
