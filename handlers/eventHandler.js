const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    const eventsPath = path.join(__dirname, '../events');
    
    if (!fs.existsSync(eventsPath)) {
        fs.mkdirSync(eventsPath, { recursive: true });
        console.log('📁 Events folder created');
    }
    
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    console.log(`📂 Found ${eventFiles.length} event files`);
    
    for (const file of eventFiles) {
        try {
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);
            
            if (!event.name) {
                console.error(`❌ Event ${file} has no name property`);
                continue;
            }
            
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
                console.log(`✅ Event loaded (once): ${event.name} from ${file}`);
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
                console.log(`✅ Event loaded: ${event.name} from ${file}`);
            }
            
        } catch (err) {
            console.error(`❌ Error loading event ${file}:`, err.message);
        }
    }
};
