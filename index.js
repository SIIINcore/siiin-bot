// index.js
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

// ====== CHANNELS ======
const CHANNEL_FREEGAMES = '1237671753833254946';
const CHANNEL_PROMOS = '1370860980594151534';
const CHANNEL_WELCOME = '1033462383798140981';
const STATS_CHANNEL_ID = '1465938751208558643';
const SUPPORT_CHANNEL_ID = "1468090646442279206";
const TICKET_CATEGORY_ID = "1237716160842305566";
const LOG_CHANNEL_ID = "1354801906161025236";
const STAFF_IDS = ["847798063821225985", "400331452245344268"];
const BOT_ID = "1465878128219128005";
const ALLOWED_FILE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mov'];

// Stockage pour éviter les doublons
let postedGames = new Set();
let postedPromos = new Set();

// ====== CLIENT ======
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ====== FUNCTIONS API ======
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

// ====== POSTING ======
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

// ====== STATS ======
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

// ====== UPDATE ALL ======
async function updateAll() {
    console.log('📡 Updating free games and promos...');
    const freeChannel = await client.channels.fetch(CHANNEL_FREEGAMES);
    const promoChannel = await client.channels.fetch(CHANNEL_PROMOS);

    await postFreeGames(freeChannel);
    await postPromos(promoChannel);
    await updateStatsEmbed(freeChannel.guild);
    console.log('✅ Update completed.');
}

// ====== WELCOME ======
client.on('guildMemberAdd', async member => {
    try {
        const welcomeChannel = await client.channels.fetch(CHANNEL_WELCOME);
        const welcomeText = `
# ───────────── ✦ W E L C O M E ✦ ─────────────

**<:CVW:1371269829847289876> SIIIN PATCHES & EXTRA**

${member}, Welcome to our server! <:CVW:1371269829847289876>

▫▫▫▫ **C H E C K** ▫▫▫▫

Enjoy your stay and check out the links below!

───────────── ✦ INFORMATION ✦ ─────────────
<:cryengine:1033530974107091035> [Information](https://discord.com/channels/1033462383798140978/1033506664810287134/1440058017545584871)
<:cryengine:1033530974107091035> [Rules](https://discord.com/channels/1033462383798140978/1177257234787471422/1239185655683088395)
<:cryengine:1033530974107091035> [Announcements](https://discord.com/channels/1033462383798140978/1237650687249092670)
<:cryengine:1033530974107091035> [Search](https://discord.com/channels/1033462383798140978/1376910830490095798/1376912016517763094)
<:cryengine:1033530974107091035> [Games List](https://discord.com/channels/1033462383798140978/1376904260842819685/1409551551818760204)
<:cryengine:1033530974107091035> [Crysis and Crysis Warhead](https://discord.com/channels/1033462383798140978/1371242516556415098/1371242762417995776)
<:cryengine:1033530974107091035> [Crysis Remastered](https://discord.com/channels/1033462383798140978/1372560937000763484/1372565847591092385)

───────────── ✦ PLATFORMS ✦ ─────────────
**STEAM | GOG | EA | UBISOFT | CD-ROM**

───────────── ✦ SUPPORT ✦ ─────────────
<#1468090646442279206> ► [Use this Template](https://discord.com/channels/1033462383798140978/1379581746466783385/1379584565466763307)
`;
        await welcomeChannel.send({ content: welcomeText });
        await updateStatsEmbed(member.guild);
    } catch (err) {
        console.error('[Welcome] Error sending message:', err);
    }
});

client.on('guildMemberRemove', async member => {
    await updateStatsEmbed(member.guild);
});

// ====== CLIENT READY ======
client.on('ready', async () => {
    console.log(`🤖 Bot connected: ${client.user.tag}`);

    await sendTicketEmbed();

    try {
        const BOT_VERSION = "3.0.0.A02012026.2"; //SIIINVERSION
        const BOT_CHANGELOG = `
• Autoreboot set (24h)
• Railway Host connect fixed (SIGTERM)
• Stats fixed
• Tickets system added and fixed
`;
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle("🚀 Bot déployé / redémarré")
                .setColor("#00FF99")
                .setDescription(`**Version :** ${BOT_VERSION}\n\n**Changelog :**\n${BOT_CHANGELOG}`)
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error("❌ Impossible d’envoyer le log dans Discord :", err);
    }

    updateAll();
    setInterval(() => console.log('🟢 Bot alive:', new Date().toLocaleTimeString()), 60_000);
    setInterval(updateAll, 10 * 60 * 1000);
});

// ====== LOGIN ======
client.login(process.env.BOT_TOKEN);

// ====== TICKETS ======
async function sendTicketEmbed() {
    const channel = await client.channels.fetch(SUPPORT_CHANNEL_ID);
    if (!channel) return console.warn("Unfound channel !");

    const messages = await channel.messages.fetch({ limit: 10 });
    for (const [, msg] of messages.filter(m => m.author.id === client.user.id)) {
        await msg.delete().catch(() => {});
    }

    const embed = new EmbedBuilder()
        .setTitle("🎫 Support / Tickets")
        .setDescription("**Push the button to create a ticket**.\nOur staff will answer as soon as possible.\n**Do not Tag us** or the ticket will be deleted !\n**Youtube links and images/videos allowed, other links/files blocked**")
        .setColor(0x00FF99);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('Open a ticket')
                .setStyle(ButtonStyle.Primary)
        );

    await channel.send({ embeds: [embed], components: [row] });
    console.log("✅ Ticket got created !");
}

// ====== INTERACTIONS ======
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const guild = interaction.guild;
    const user = interaction.user;
    const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

    if (interaction.customId === 'open_ticket') {
        const existing = guild.channels.cache.find(c => c.name === `ticket-${user.id}`);
        if (existing) return interaction.reply({ content: "❌ You already have an open Ticket !", ephemeral: true });

        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.id}`,
            type: 0,
            parent: TICKET_CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles] },
                ...STAFF_IDS.map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] })),
                { id: BOT_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle(`🎫 Ticket for ${user.username}`)
            .setDescription("Ticket successfully open !\nThe staff will come soon to check it out.\nPush **Close** Button to close the ticket.")
            .setColor(0x00FF99);

        const closeRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger)
            );

        await ticketChannel.send({ content: `<@${user.id}>`, embeds: [embed], components: [closeRow] });
        await interaction.reply({ content: `✅ Your ticket has been set: ${ticketChannel}`, ephemeral: true });

        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle("📂 Ticket openned")
                .setColor(0x00FF99)
                .setDescription(`**User :** ${user.tag} (${user.id})\n**Channel :** ${ticketChannel.name}`)
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }
    }

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

// ====== MESSAGE FILTER ======
client.on('messageCreate', async message => {
    if (!message.channel.name.startsWith('ticket-') || message.author.bot) return;

    const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;
    const linkRegex = /(https?:\/\/[^\s]+)/i;

    if (linkRegex.test(message.content) && !youtubeRegex.test(message.content)) {
        await message.delete().catch(() => {});
        const warnMsg = await message.channel.send(`<@${message.author.id}> ❌ Only YouTube links are allowed.`);
        setTimeout(() => warnMsg.delete().catch(() => {}), 7000);
        return;
    }

    message.attachments.forEach(att => {
        const ext = att.name?.substring(att.name.lastIndexOf('.')).toLowerCase();
        if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
            message.delete().catch(() => {});
            message.channel.send({ content: `<@${message.author.id}> ❌ File type not allowed.`, allowedMentions: { users: [message.author.id] } })
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 7000));
        }
    });
});

// ====== AUTO-REBOOT ======
const hours = Number(process.env.AUTO_REBOOT_HOURS || 24);
const REBOOT_DELAY = hours * 60 * 60 * 1000;
let shuttingDown = false;
console.log(`⏱️ Auto reboot activé toutes les ${hours}h`);

async function shutdown(reason) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`🛑 Shutdown en cours (${reason})...`);
    try { if (client) await client.destroy(); } catch (err) { console.error(err); }
    finally { process.exit(0); }
}

process.on("SIGTERM", () => shutdown("SIGTERM Railway"));
setTimeout(() => shutdown("Auto reboot programmé"), REBOOT_DELAY);
