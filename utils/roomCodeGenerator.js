// Generate unique room codes like Google Meet (abc-defg-hij)

function generateRoomCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  
  const randomString = (length) => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const part1 = randomString(3);
  const part2 = randomString(4);
  const part3 = randomString(3);
  
  return `${part1}-${part2}-${part3}`;
}

function isValidRoomCode(code) {
  // Format: abc-defg-hij (3-4-3 lowercase letters) or flexible format
  const pattern = /^[a-z]{3}-[a-z]{4,5}-[a-z]{3,5}$/;
  return pattern.test(code);
}

module.exports = {
  generateRoomCode,
  isValidRoomCode
};
