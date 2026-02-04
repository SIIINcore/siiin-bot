// ================================
// SIIIN CORE - UPDATE
// ================================

// ================================
// IMPORTS & CONFIG
// ================================
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require('discord.js');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

// ================================
// CHANNELS ID
// ================================
const CHANNEL_FREEGAMES = '1237671753833254946';
const CHANNEL_PROMOS = '1370860980594151534';
const CHANNEL_WELCOME = '1033462383798140981';
const STATS_CHANNEL_ID = '1465938751208558643';
const SUPPORT_CHANNEL_ID = "1468090646442279206";
const TICKET_CATEGORY_ID = "1237716160842305566";
const LOG_CHANNEL_ID = "1354801906161025236";

// ================================
// APP ID | SIIIN CORE
// ================================
const BOT_ID = "1465878128219128005";

// ================================
// STAFF ID
// ================================
const STAFF_IDS = ["847798063821225985", "400331452245344268"];

// ================================
// TICKETS RULES
// ================================
const ALLOWED_FILE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mov'];

// ================================
// DISCORD CLIENT | GATEWAY
// ================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ================================
// ANTI SPAM | APP MESSAGES
// ================================
let postedGames = new Set();
let postedPromos = new Set();

// ================================
// API | FREE GAMES
// ================================
async function fetchFreeGames() {
    try {
        const res = await fetch('https://www.gamerpower.com/api/giveaways?platform=epic-games-store');
        const data = await res.json();
        return data.map(game => ({
            id: game.id,
            title: game.title,
            url: game.open_giveaway_url,
            image: game.image,
            description: game.description,
            platform: game.platforms
        }));
    } catch (err) {
        console.error('[FreeGames] API Error:', err);
        return [];
    }
}

// ================================
// API | PROMOS
// ================================
async function fetchPromos() {
    try {
        const res = await fetch('https://www.cheapshark.com/api/1.0/deals?storeID=1&upperPrice=15');
        const data = await res.json();
        return data.filter(game => {
            const normalPrice = parseFloat(game.normalPrice);
            const salePrice = parseFloat(game.salePrice);
            return ((normalPrice - salePrice) / normalPrice) * 100 >= 40;
        }).map(game => ({
            id: game.dealID,
            title: game.title,
            url: `https://www.cheapshark.com/redirect?dealID=${game.dealID}`,
            image: game.thumb,
            price: game.salePrice,
            normalPrice: game.normalPrice
        }));
    } catch (err) {
        console.error('[Promos] API Error:', err);
        return [];
    }
}

// ================================
// POST API | FREE GAMES
// ================================
async function postFreeGames(channel) {
    const games = await fetchFreeGames();
    for (const game of games) {
        if (postedGames.has(game.id)) continue;
        postedGames.add(game.id);

        const embed = new EmbedBuilder()
            .setTitle(`**${game.title}**`)
            .setURL(game.url)
            .setDescription(game.description)
            .setImage(game.image)
            .setColor('#FF0000');

        await channel.send({ embeds: [embed] });
    }
}

// ================================
// POST API | PROMOS
// ================================
async function postPromos(channel) {
    const promos = await fetchPromos();
    for (const promo of promos) {
        if (postedPromos.has(promo.id)) continue;
        postedPromos.add(promo.id);

        const normalPrice = parseFloat(promo.normalPrice);
        const salePrice = parseFloat(promo.price);
        const discountPercent = Math.round(((normalPrice - salePrice) / normalPrice) * 100);

        const embed = new EmbedBuilder()
            .setTitle(`**${promo.title}**`)
            .setURL(promo.url)
            .setDescription(`💰 Normal Price: $${promo.normalPrice} → Sale Price: $${promo.price} (${discountPercent}% OFF)`)
            .setImage(promo.image)
            .setColor('#FF0000');

        await channel.send({ embeds: [embed] });
    }
}

// ================================
// UPDATE FREE & PROMO [TRY]
// ================================
async function updateAll() {
    console.log('📡 Updating free games and promos...');
    const freeChannel = await client.channels.fetch(CHANNEL_FREEGAMES);
    const promoChannel = await client.channels.fetch(CHANNEL_PROMOS);

    await postFreeGames(freeChannel);
    await postPromos(promoChannel);
    await updateStatsEmbed(freeChannel.guild);
    console.log('✅ Update completed.');
}

// ================================
// STATS | DISCORD SERVER
// ================================
async function updateStatsEmbed(guild) {
    try {
        const channel = await guild.channels.fetch(STATS_CHANNEL_ID);
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 10 });
        for (const [, msg] of messages) await msg.delete().catch(() => {});

        await guild.members.fetch();
        const totalMembers = guild.memberCount;
        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        const maxBlocks = 20;
        const filledBlocks = Math.round((totalMembers / 100) * maxBlocks);
        const emptyBlocks = maxBlocks - filledBlocks;
        const bar = '🟥'.repeat(filledBlocks > maxBlocks ? maxBlocks : filledBlocks) + '⬛'.repeat(emptyBlocks < 0 ? 0 : emptyBlocks);

        const embed = new EmbedBuilder()
            .setTitle('📊 **S E R V E R   S T A T S**')
            .setColor('#FF0000')
            .setDescription(`${bar}\n\n👥 **Total Members:** ${totalMembers}\n🧑 **Peoples:** ${humanCount}\n🤖 **Apps:** ${botCount}`)
            .setFooter({ text: 'SIIIN Stats' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[Stats] Error updating stats:', err);
    }
}

// ================================
// WELCOME | MESSAGE | ADD ROLE
// ================================
client.on('guildMemberAdd', async member => {
    try {
        // ================================
        // SAFEMODE | ADD ROLE
        // ================================
        const roleId = '1033463588934918164'; // ID du rôle à ajouter
        try {
            // DISCORD API
            const role = await member.guild.roles.fetch(roleId);
            if (role) {
                // CHECK USER ROLE TO NOT REMOVE THE GOOD ONE
                if (!member.roles.cache.has(roleId)) {
                    await member.roles.add(role);
                    console.log(`✅ Role "${role.name}" given to ${member.user.tag}`);
                } else {
                    console.log(`ℹ️ ${member.user.tag} had already "${role.name}" role`);
                }
            } else {
                console.warn(`❌ Unfound Fetch Role : ${roleId}`);
            }
        } catch (err) {
            console.error(`❌ Unable to add the role to ${member.user.tag} :`, err);
        }

        // ================================
        // WELCOME | MESSAGE
        // ================================
        const welcomeChannel = await client.channels.fetch(CHANNEL_WELCOME);

        const welcomeText = `
# ─── ✦ W E L C O M E ✦ ───
**<:CVW:1371269829847289876> SIIIN PATCHES & EXTRA**

${member}, Welcome to our server! <:CVW:1371269829847289876>
Enjoy your stay and check out the links below!
▫▫▫▫ **C H E C K** ▫▫▫▫

# ─── ✦ INFORMATION ✦ ───
<:cryengine:1033530974107091035> [Information](https://discord.com/channels/1033462383798140981/1033506664810287134/1440058017545584871)
<:cryengine:1033530974107091035> [Rules](https://discord.com/channels/1033462383798140978/1177257234787471422/1468570201095274552)
<:cryengine:1033530974107091035> [Announcements](https://discord.com/channels/1033462383798140981/1237650687249092670)
<:cryengine:1033530974107091035> [Search](https://discord.com/channels/1033462383798140981/1376910830490095798/1376912016517763094)
<:cryengine:1033530974107091035> [Games List](https://discord.com/channels/1033462383798140981/1376904260842819685/1409551551818760204)
<:cryengine:1033530974107091035> [Crysis and Crysis Warhead](https://discord.com/channels/1033462383798140981/1371242516556415098/1371242762417995776)
<:cryengine:1033530974107091035> [Crysis Remastered](https://discord.com/channels/1033462383798140981/1372560937000763484/1372565847591092385)

# ─── ✦ PLATFORMS ✦ ───
**STEAM | GOG | EA | UBISOFT | CD-ROM**

# ─── ✦ SUPPORT ✦ ───
**Check 1st the [Support rules](https://discord.com/channels/1033462383798140978/1379581746466783385/1379582509062426754) ► Then use ► The <#1468090646442279206> system.

# ─── ✦ DONATIONS ✦ ───
To support us, please feel free to donate a bit. [Just Here](https://discord.com/channels/1033462383798140981/1178517213444046948/1351344918546874461)
[Paypal Direct link](https://www.paypal.com/paypalme/LunaSiiin?)
`;

        await welcomeChannel.send({ content: welcomeText });

        // STATS UPDATE
        await updateStatsEmbed(member.guild);

    } catch (err) {
        console.error('[Welcome] Error sending message or adding role:', err);
    }
});

// ================================
// TICKETS | SUPPORT COMPLET
// ================================
async function sendTicketEmbed() {
    const channel = await client.channels.fetch(SUPPORT_CHANNEL_ID);
    if (!channel) return console.warn("Unfound channel !");

    // DELETE PREVIOUS BOT MESSAGES
    const messages = await channel.messages.fetch({ limit: 10 });
    for (const [, msg] of messages.filter(m => m.author.id === client.user.id)) {
        await msg.delete().catch(() => {});
    }

    const embed = new EmbedBuilder()
        .setTitle("🎫 Support / Tickets")
        .setDescription(
`**Push the button to create a ticket**
Our staff will answer as soon as possible.
**Do not Tag us** or the ticket will be deleted!
**Youtube links and images/videos allowed, other links/files blocked**`
        )
        .setColor(0x00FF99);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('Open a ticket')
                .setStyle(ButtonStyle.Primary)
        );

    await channel.send({ embeds: [embed], components: [row] });
    console.log("✅ Ticket creation message sent!");
}

// ================================
// TICKETS | INTERACTIONS
// ================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const guild = interaction.guild;
    const user = interaction.user;
    const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

    // ----------------------------
    // OPEN TICKET
    // ----------------------------
    if (interaction.customId === 'open_ticket') {
        const existing = guild.channels.cache.find(c => c.name === `ticket-${user.id}`);
        if (existing) return interaction.reply({ content: "❌ You already have an open Ticket !", ephemeral: true });

        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.id}`,
            type: 0,
            parent: TICKET_CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.AttachFiles
                    ]
                },
                ...STAFF_IDS.map(id => ({
                    id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ManageMessages
                    ]
                })),
                { id: BOT_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
            ]
        });

        // EMBED TICKET CHOICE
        const embed = new EmbedBuilder()
            .setTitle(`🎫 Ticket open for:`)
            .setDescription(
`Choose a category:
**SUPPORT** > Need Help about a game
**REQUEST** > Seek to add another game
**OTHER** > None of the previous choices`
            )
            .setColor(0x00FF99);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_support')
                    .setLabel('SUPPORT')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('ticket_request')
                    .setLabel('REQUEST')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('ticket_other')
                    .setLabel('OTHER')
                    .setStyle(ButtonStyle.Secondary)
            );

        await ticketChannel.send({ content: `<@${user.id}>`, embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Your ticket has been created: ${ticketChannel}`, ephemeral: true });

        // Log
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle("📂 Ticket opened")
                .setColor(0x00FF99)
                .setDescription(`**User :** ${user.tag} (${user.id})\n**Channel :** ${ticketChannel.name}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }
    }

    // ----------------------------
    // TICKET | CATEGORY BUTTONS
    // ----------------------------
    if (['ticket_support','ticket_request','ticket_other'].includes(interaction.customId)) {
    await interaction.deferReply({ ephemeral: true });

    let templateEmbed = new EmbedBuilder();
    if (interaction.customId === 'ticket_support') {
        templateEmbed
            .setTitle("🎮 Support Template")
            .setColor(0x00FF99)
            .setDescription(
`- Game = 
- OS = 
- GPU = 
- CPU = 
- RAM = 
- Drive =
- Describe what you need =`
            );
    } else if (interaction.customId === 'ticket_request') {
        templateEmbed
            .setTitle("📦 Request Template")
            .setColor(0x0099FF)
            .setDescription(
`- GAME NAME = 
- RELEASE YEAR = 
- O / R = # Original or Remastered, if the game hasn't Remaster, just type : "/"
- REASON = # Explain why you need it / If it can be helpful for other people`
            );
    } else if (interaction.customId === 'ticket_other') {
        templateEmbed
            .setTitle("❓ Other Template")
            .setColor(0xFFAA00)
            .setDescription("Describe why you open the ticket, please.");
    }

    // Delete all Buttons except "Close"
    if (interaction.message.editable) {
    const newComponents = interaction.message.components.map(row => {
        // Filtre les boutons SUPPORT/REQUEST/OTHER
        const filteredButtons = row.components.filter(btn => !['ticket_support','ticket_request','ticket_other'].includes(btn.customId));
        return new ActionRowBuilder().addComponents(filteredButtons);
    });
    await interaction.message.edit({ components: newComponents }).catch(() => {});
}

    // Envoie le template dans le ticket
    await interaction.followUp({ embeds: [templateEmbed], ephemeral: false });

    // Optionnel : envoie un DM à l'utilisateur
    await interaction.user.send(`Your template has been posted in the ticket: <#${interaction.channel.id}>`).catch(() => {});
}
    // ----------------------------
    // CLOSE TICKET
    // ----------------------------
    if (interaction.customId === 'close_ticket') {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.channel;

        await interaction.editReply({ content: "🕐 Ticket will be deleted in 5 minutes." });

        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle("🗑️ Close ticket")
                .setColor(0xFF0000)
                .setDescription(`**User :** ${user.tag} (${user.id})\n**Channel :** ${channel.name}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }

        setTimeout(async () => await channel.delete().catch(() => {}), 5 * 60 * 1000);
    }
});

// ================================
// TICKETS | MESSAGE FILTER
// ================================
client.on('messageCreate', async message => {
    if (!message.channel.name.startsWith('ticket-') || message.author.bot) return;

    // STAFF BYPASS
    if (STAFF_IDS.includes(message.author.id)) return;

    const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;
    const linkRegex = /(https?:\/\/[^\s]+)/i;

    // FORBIDDEN LINKS FILTER
    if (linkRegex.test(message.content) && !youtubeRegex.test(message.content)) {
        await message.delete().catch(() => {});
        const warnMsg = await message.channel.send(`<@${message.author.id}> ❌ Only YouTube links are allowed.`);
        setTimeout(() => warnMsg.delete().catch(() => {}), 7000);
        return;
    }

    // FORBIDDEN FILES FILTER
    message.attachments.forEach(att => {
        const ext = att.name?.substring(att.name.lastIndexOf('.')).toLowerCase();
        if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
            message.delete().catch(() => {});
            message.channel.send({ content: `<@${message.author.id}> ❌ File type not allowed.`, allowedMentions: { users: [message.author.id] } })
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 7000));
        }
    });
});

// ================================
// DISCORD | CLIENT READY
// ================================
client.on('ready', async () => {
    console.log(`🤖 Bot connected: ${client.user.tag}`);

    await sendTicketEmbed();

    try {
        const BOT_VERSION = "3.0.0.A02042026.1"; //SIIIN CORE VERSION
        const BOT_CHANGELOG = `
# FIXES:
• Autorestart
• Stats
• Tickets system

# ADD:
• Railway Variables :
    ▪ AUTO_REBOOT_HOURS
    ▪ NIXPACKS_NODE_VERSION
    ▪ NODE_ENV
    ▪ RAILWAY_HEALTHCHECK_PATH
• Force Update App Reboot
• Force Update App Content
• Ticket choices within the ticket
• BYPASS settings for Staff

# CHANGES:
• Welcome | Fixes + Texts | Add lines
• APP Logs | English
• API | Fixed links + Add settings | Optimizations
• APP | Split Settings under new menus | Optimizations

# REMOVED:
• Draft Dependencies
`;
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle("🚀 App Online / Restarted")
                .setColor("#FF0000")
                .setDescription(`**Release :** ${BOT_VERSION}\n\n**Changelog :**\n${BOT_CHANGELOG}`)
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error("❌ Log failed to appear :", err);
    }

    updateAll();
    setInterval(() => console.log('🟢 Bot alive:', new Date().toLocaleTimeString()), 60_000);
    setInterval(updateAll, 10 * 60 * 1000);
});

// ================================
// APP | AUTO RESTART
// ================================
const hours = Number(process.env.AUTO_REBOOT_HOURS || 24);
const REBOOT_DELAY = hours * 60 * 60 * 1000;
let shuttingDown = false;
console.log(`⏱️ Autorestart every ${hours}h`);

async function shutdown(reason) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`🛑 Shutdown for (${reason})...`);
    try { if (client) await client.destroy(); } catch (err) { console.error(err); }
    finally { process.exit(0); }
}

process.on("SIGTERM", () => shutdown("SIGTERM Railway"));
setTimeout(() => shutdown("Auto restart"), REBOOT_DELAY);

// ================================
// DISCORD | CLIENT LOGIN
// ================================
client.login(process.env.BOT_TOKEN);
