// services/expressService.js
const express = require('express');

module.exports = function setupExpress(client) {
    const app = express();
    const PORT = process.env.PORT || 3000;
    
    app.use(express.json());
    
    app.get(process.env.RAILWAY_HEALTHCHECK_PATH || '/', (req, res) => {
        res.status(200).json({ 
            status: 'ok', 
            bot: client?.user?.tag || 'SIIIN Bot (Starting)',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    });
    
    app.listen(PORT, () => {
        console.log(`🚀 Health check on port ${PORT}`);
    });
    
    return app;
};
