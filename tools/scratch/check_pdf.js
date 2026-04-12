const fs = require('fs');
const path = require('path');

// Since I don't have pdf-parse, I'll try to find any existing tool or just warn.
// But wait, there is no easy way to read PDF text without a library in Node.
// I'll try to use powershell to see if there's any pdf related commands.
console.log("Checking for PDF tools...");
