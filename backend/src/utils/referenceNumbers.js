const generateReferenceNumber = (prefix) => {
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${Date.now()}-${randomPart}`;
};

module.exports = {
  generateReferenceNumber
};
