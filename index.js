// app.js or server.js
const express = require('express');
const bodyParser = require('body-parser');
const walletRoutes = require('./routes/walletRoutes');
const markettingRoutes = require('./routes/markettingRoutes');


const app = express();

// Middleware
app.use(bodyParser.json());

// Use the wallet routes
app.use('/api/afiliat', markettingRoutes); // Use the marketting routes under the /api path
app.use('/api/wallet', walletRoutes);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
