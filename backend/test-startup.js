console.log("1️⃣ Starting test...");

try {
  console.log("2️⃣ Loading express...");
  const express = require('express');
  console.log("✅ Express loaded");

  console.log("3️⃣ Loading cors...");
  const cors = require('cors');
  console.log("✅ CORS loaded");

  console.log("4️⃣ Loading controllers...");
  const controller = require('./logRegController');
  console.log("✅ LogRegController loaded");

  const adminService = require('./adminService');
  console.log("✅ AdminService loaded");

  const scanController = require('./scanController');
  console.log("✅ ScanController loaded");

  const graficController = require('./graficController');
  console.log("✅ GraficController loaded");

  console.log("✅ ALL MODULES LOADED SUCCESSFULLY!");
  process.exit(0);

} catch (err) {
  console.error("❌ ERROR:", err.message);
  console.error("Stack:", err.stack);
  process.exit(1);
}
