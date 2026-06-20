const { EmbedBuilder } = require('discord.js');
const { 
    CHANNEL_WELCOME, 
    MEMBER_ROLE_ID 
} = require('../config/constants');
const { handleAntiRaid } = require('../functions/antiRaid');
const { updateStatsEmbed, postedGames, postedPromos, postedFreeToPlay, postedMobile } = require('../functions/contentUpdater');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            // === ANTI-RAID ===
            await handleAntiRaid(member, client);

            // === Ajout du rôle membre ===
            const roleId = MEMBER_ROLE_ID;
            try {
                const role = await member.guild.roles.fetch(roleId);
                if (role && !member.roles.cache.has(roleId)) {
                    await member.roles.add(role);
                }
            } catch (err) {
                console.error(`❌ Could not add role to ${member.user.tag}:`, err.message);
            }

            // === Message de bienvenue complet ===
            const welcomeChannel = await client.channels.fetch(CHANNEL_WELCOME).catch(() => null);
            if (welcomeChannel) {
                const welcomeText = `
# ─── ✦ W E L C O M E ✦ ───
**<:CVW:1371269829847289876> SIIIN PATCHES & EXTRA**

${member}, Welcome to our server! <:CVW:1371269829847289876>
Enjoy your stay and check out the links below!

▫▫▫▫ **C H E C K** ▫▫▫▫
# ─── ✦ INFORMATION ✦ ───
<:cryengine:1033530974107091035> [Information](https://discord.com/channels/1033462383798140978/1033506664810287134/1440058017545584871)
<:cryengine:1033530974107091035> [Rules](https://discord.com/channels/1033462383798140978/1177257234787471422/1468570201095274552)
<:cryengine:1033530974107091035> <#1237650687249092670>
<:cryengine:1033530974107091035> [Search](https://discord.com/channels/1033462383798140978/1376910830490095798/1376912016517763094)
<:cryengine:1033530974107091035> [Games List](https://discord.com/channels/1033462383798140978/1376904260842819685/1409551551818760204)
<:cryengine:1033530974107091035> [Crysis and Crysis Warhead](https://discord.com/channels/1033462383798140978/1371242516556415098/1371242762417995776)
<:cryengine:1033530974107091035> [Crysis Remastered](https://discord.com/channels/1033462383798140978/1372560937000763484/1372565847591092385)

# ─── ✦ PLATFORMS ✦ ───
**STEAM | GOG | EA | UBISOFT | CD-ROM**

# ─── ✦ SUPPORT ✦ ───
**Check 1st the [Support rules](https://discord.com/channels/1033462383798140978/1379581746466783385/1379582509062426754) ► Then use ► The <#1468090646442279206> system.**

# ─── ✦ DONATIONS ✦ ───
To support us, please feel free to donate a bit. Just Here : <#1178517213444046948>
[Donations Direct link](https://www.paypal.com/paypalme/LunaSiiin?)
`;
                await welcomeChannel.send({ content: welcomeText });
            }

            // === Mise à jour des stats ===
            setTimeout(async () => {
                try {
                    await updateStatsEmbed(member.guild, client, postedGames, postedPromos, postedFreeToPlay, postedMobile);
                } catch (err) {
                    console.error('[Stats Update] Error:', err.message);
                }
            }, 5000);

        } catch (err) {
            console.error('[guildMemberAdd] Error:', err.message);
        }
    }
};
