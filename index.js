// index.js
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

// Channels
const CHANNEL_FREEGAMES = '1237671753833254946';
const CHANNEL_PROMOS = '1370860980594151534';
const CHANNEL_WELCOME = '1033462383798140981';
const STATS_CHANNEL_ID = '1465938751208558643';

// Stockage pour éviter les doublons
let postedGames = new Set();
let postedPromos = new Set();

// Crée le client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ====== Fonctions API ======
async function fetchFreeGames() {
    try {
        const url = 'https://www.gamerpower.com/api/giveaways?platform=epic-games-store';
        const res = await fetch(url);
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
        const url = 'https://www.cheapshark.com/api/1.0/deals?storeID=1&upperPrice=15';
        const res = await fetch(url);
        const data = await res.json();
        return data.filter(game => {
            const normalPrice = parseFloat(game.normalPrice);
            const salePrice = parseFloat(game.salePrice);
            const discountPercent = ((normalPrice - salePrice) / normalPrice) * 100;
            return discountPercent >= 40;
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

// ====== Post Games ======
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

// ====== Update Complet ======
async function updateAll() {
    console.log('📡 Updating free games and promos...');
    const freeChannel = await client.channels.fetch(CHANNEL_FREEGAMES);
    const promoChannel = await client.channels.fetch(CHANNEL_PROMOS);

    await postFreeGames(freeChannel);
    await postPromos(promoChannel);
    await updateStatsEmbed(freeChannel.guild);
    console.log('✅ Update completed.');
}

// ====== STATS ======
async function updateStatsEmbed(guild) {
    try {
        const channel = await guild.channels.fetch(STATS_CHANNEL_ID);
        if (!channel) return;

        // Supprime tous les messages existants
        const messages = await channel.messages.fetch({ limit: 10 });
        for (const [, msg] of messages) {
            await msg.delete().catch(() => {});
        }

        await guild.members.fetch();
        const totalMembers = guild.memberCount;
        const botCount = guild.members.cache.filter(m => m.user.bot).size;
        const humanCount = totalMembers - botCount;

        // Progress bar décorative
        const maxBlocks = 20;
        const filledBlocks = Math.round((totalMembers / 100) * maxBlocks);
        const emptyBlocks = maxBlocks - filledBlocks;
        const bar = '🟥'.repeat(filledBlocks > maxBlocks ? maxBlocks : filledBlocks) + '⬛'.repeat(emptyBlocks < 0 ? 0 : emptyBlocks);

        const embed = new EmbedBuilder()
            .setTitle('📊 **S E R V E R   S T A T S**')
            .setColor('#FF0000') // rouge YouTube
            .setDescription(
                `${bar}\n\n👥 **Total Members:** ${totalMembers}\n🧑 **Peoples:** ${humanCount}\n🤖 **Apps:** ${botCount}`
            )
            .setFooter({ text: 'SIIIN Stats' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[Stats] Error updating stats:', err);
    }
}

// ====== WELCOME CHANNEL ======
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
<#1189391329097166989> ► [Use this Template](https://discord.com/channels/1033462383798140978/1379581746466783385/1379584565466763307)
`;
        await welcomeChannel.send({ content: welcomeText });
        await updateStatsEmbed(member.guild);
    } catch (err) {
        console.error('[Welcome] Error sending message:', err);
    }
});

// ====== Update stats quand un membre quitte ======
client.on('guildMemberRemove', async member => {
    await updateStatsEmbed(member.guild);
});

// ====== Quand le bot est prêt avec Keep-alive ======
client.on('clientReady', async () => {
    console.log(`🤖 Bot connected: ${client.user.tag}`);

    // --- Envoie le message embed de ticket ---
    await sendTicketEmbed();

    // --- Log dans le salon Discord ---
    try {
        const LOG_CHANNEL_ID = "1354801906161025236";
        const BOT_VERSION = "3.0.0.A02012026"; // à mettre à jour à chaque release
        const BOT_CHANGELOG = `
• Ajout du système d’auto-reboot (24h)
• Fermeture propre Railway (SIGTERM)
• Optimisation des stats serveur
`;

        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle("🚀 Bot déployé / redémarré")
                .setColor("#00FF99")
                .setDescription(`**Version :** ${BOT_VERSION}\n\n**Changelog :**\n${BOT_CHANGELOG}`)
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        } else {
            console.warn("⚠️ Salon de logs introuvable !");
        }
    } catch (err) {
        console.error("❌ Impossible d’envoyer le log dans Discord :", err);
    }

    // Premier lancement
    updateAll();

    // Keep-alive log toutes les minutes
    setInterval(() => {
        console.log('🟢 Bot alive:', new Date().toLocaleTimeString());
    }, 60_000);

    // Update complet toutes les 10 minutes
    setInterval(updateAll, 10 * 60 * 1000);
});

// ====== Connexion ======
client.login(process.env.BOT_TOKEN);

// ====== TICKETS / SUPPORT (avec filtrage fichiers) ======
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const SUPPORT_CHANNEL_ID = "1468090646442279206"; // Salon avec le bouton
const TICKET_CATEGORY_ID = "1237716160842305566"; // Catégorie où créer le ticket
const STAFF_IDS = ["847798063821225985", "400331452245344268"]; // IDs du staff
const BOT_ID = "1465878128219128005"; // ID du bot

// Extensions autorisées
const ALLOWED_FILE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mov'];

// Fonction pour envoyer l'embed avec bouton "Ouvrir un ticket"
async function sendTicketEmbed() {
  const channel = await client.channels.fetch(SUPPORT_CHANNEL_ID);
  if (!channel) return console.warn("Salon support introuvable !");

  // Supprime les anciens messages du bot dans ce salon
  const messages = await channel.messages.fetch({ limit: 10 });
  const botMessages = messages.filter(msg => msg.author.id === client.user.id);
  for (const [, msg] of botMessages) await msg.delete().catch(() => {});

  const embed = new EmbedBuilder()
    .setTitle("🎫 Support / Tickets")
    .setDescription("**Push the button to create a ticket**.\nOur staff will answer as soon as possible.\n**Do not Tag us** or the ticket will be deleted !\n**Youtube links and images/videos allowed, other links/files blocked**")
    .setColor(0x00FF99);

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('open_ticket')
        .setLabel('Ouvrir un ticket')
        .setStyle(ButtonStyle.Primary)
    );

  await channel.send({ embeds: [embed], components: [row] });
  console.log("✅ Ticket embed envoyé !");
}

// ===== Gestion des interactions sur boutons (avec logs) =====
const LOG_CHANNEL_ID = "1354801906161025236"; // Salon de logs pour tickets

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const guild = interaction.guild;
  const user = interaction.user;
  const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

  // ===== Ouvrir un ticket =====
  if (interaction.customId === 'open_ticket') {
    const existing = guild.channels.cache.find(c => c.name === `ticket-${user.id}`);
    if (existing) return interaction.reply({ content: "❌ You already have an open Ticket !", ephemeral: true });

    const ticketChannel = await guild.channels.create({
      name: `ticket-${user.id}`,
      type: 0, // text channel
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles] },
        ...STAFF_IDS.map(id => ({ id: id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] })),
        { id: BOT_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎫 Ticket de ${user.username}`)
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
    await interaction.reply({ content: `✅ Ton ticket a été créé: ${ticketChannel}`, ephemeral: true });

    // --- Log ouverture ---
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle("📂 Ticket ouvert")
        .setColor(0x00FF99)
        .setDescription(`**Utilisateur :** ${user.tag} (${user.id})\n**Salon :** ${ticketChannel.name}`)
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    }
  }

  // ===== Fermer un ticket =====
  if (interaction.customId === 'close_ticket') {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;

    await interaction.editReply({ content: "🕐 Ticket will be deleted in 5 minutes." });

    // --- Log fermeture ---
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle("🗑️ Ticket fermé")
        .setColor(0xFF0000)
        .setDescription(`**Utilisateur :** ${user.tag} (${user.id})\n**Salon :** ${channel.name}`)
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    }

    setTimeout(async () => {
      await channel.delete().catch(() => {});
    }, 5 * 60 * 1000);
  }
});

// ===== Filtrage des messages et fichiers dans les tickets =====
client.on('messageCreate', async message => {
  if (!message.channel.name.startsWith('ticket-') || message.author.bot) return;

  const content = message.content;
  const attachments = message.attachments;

  // Regex pour links
  const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;
  const linkRegex = /(https?:\/\/[^\s]+)/i;

  // Bloque liens non-Youtube
  if (linkRegex.test(content) && !youtubeRegex.test(content)) {
    await message.delete().catch(() => {});
    const warnMsg = await message.channel.send(`<@${message.author.id}> ❌ Only YouTube links are allowed.`);
    setTimeout(() => warnMsg.delete().catch(() => {}), 7000);
    return;
  }

  // Vérifie les fichiers attachés
  attachments.forEach(att => {
    const ext = att.name?.substring(att.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      message.delete().catch(() => {});
      message.channel.send({ content: `<@${message.author.id}> ❌ File type not allowed.`, allowedMentions: { users: [message.author.id] } })
        .then(msg => setTimeout(() => msg.delete().catch(() => {}), 7000));
    }
  });
});

// ================================
// 🔄 AUTO-REBOOT RAILWAY (24H)
// ================================

const hours = Number(process.env.AUTO_REBOOT_HOURS || 24);
const REBOOT_DELAY = hours * 60 * 60 * 1000;

let shuttingDown = false;

console.log(`⏱️ Auto reboot activé toutes les ${hours}h`);

async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`🛑 Shutdown en cours (${reason})...`);

  try {
    if (client) {
      await client.destroy(); // fermeture propre Discord
    }
  } catch (err) {
    console.error("❌ Erreur lors de la fermeture du client :", err);
  } finally {
    process.exit(0);
  }
}

// Reboot déclenché par Railway
process.on("SIGTERM", () => shutdown("SIGTERM Railway"));

// Reboot automatique après X heures
setTimeout(() => {
  shutdown("Auto reboot programmé");
}, REBOOT_DELAY);


