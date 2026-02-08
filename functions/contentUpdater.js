async function updateAll(client) {
    console.log('📡 Updating...');
    
    try {
        // Ici tu mettras tes fonctions de fetch de jeux
        console.log('✅ Update simulation');
        return [];
    } catch (err) {
        console.error('[UpdateAll] Error:', err.message);
        return [];
    }
}

async function softRestart(client) {
    console.log('🔄 Soft restart...');
    await updateAll(client);
    console.log('✅ Soft restart completed');
}

module.exports = { updateAll, softRestart };
