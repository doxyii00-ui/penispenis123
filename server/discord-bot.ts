import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import { storage } from './storage';
import { log } from './app';

// Discord bot configuration
// These are the channels that will be created on bot startup
const CHANNEL_CONFIG = [
  // lobby category
  { category: 'lobby', channels: ['il-witamy', 'il-weryfikacja'] },
  // info category
  { category: 'info', channels: ['il-regulamin', 'il-ogłoszenia'] },
  // konkursy category
  { category: 'konkursy', channels: ['il-konkursy'] },
  // boosty category
  { category: 'boosty', channels: ['il-boosty'] },
  // xd category
  { category: 'xd', channels: ['il-xd'] },
  // RESELLER category
  { category: 'RESELLER', channels: ['il-ressell-info', 'il-ressell-lista'] },
  // legitki category
  { category: 'legitki', channels: ['il-legit', 'il-opinie', 'il-czy-legit'] },
  // zakup category
  { category: 'zakup', channels: ['il-aplikacja', 'il-tickety'] },
];

let discordClient: Client | null = null;

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=discord',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken,
      },
    },
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  const accessToken =
    connectionSettings?.settings?.access_token ||
    connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Discord not connected');
  }
  return accessToken;
}

async function initializeDiscordBot() {
  try {
    const token = await getAccessToken();

    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
      ],
    });

    discordClient.once('ready', async () => {
      log('Discord bot logged in', 'discord-bot');
      
      if (!discordClient) return;

      // Get the guild (server)
      const guild = discordClient.guilds.cache.first();
      if (!guild) {
        log('No guild found', 'discord-bot');
        return;
      }

      log(`Connected to guild: ${guild.name}`, 'discord-bot');

      // Create or update channels
      for (const categoryConfig of CHANNEL_CONFIG) {
        // Create or get category
        let category = guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildCategory && c.name === categoryConfig.category
        );

        if (!category) {
          category = await guild.channels.create({
            name: categoryConfig.category,
            type: ChannelType.GuildCategory,
          });
          log(`Created category: ${categoryConfig.category}`, 'discord-bot');
        }

        // Create channels in category
        for (const channelName of categoryConfig.channels) {
          let channel = guild.channels.cache.find(
            (c) => c.name === channelName && c.parent?.id === category.id
          );

          if (!channel) {
            channel = await guild.channels.create({
              name: channelName,
              type: ChannelType.GuildText,
              parent: category.id,
              permissionOverwrites: [
                {
                  id: guild.id,
                  deny: [PermissionFlagsBits.SendMessages],
                  allow: [PermissionFlagsBits.ViewChannel],
                },
              ],
            });
            log(`Created channel: ${channelName}`, 'discord-bot');
          }

          // Store channel info in database
          await storage.createChannel({
            discordChannelId: channel.id,
            name: channelName,
            category: categoryConfig.category,
            readOnly: true,
          }).catch(() => {
            // Channel already exists in DB, that's fine
          });
        }
      }

      // Special: Find or create welcome channel and make it writable
      let welcomeChannel = guild.channels.cache.find((c) => c.name === 'il-witamy' && c.isTextBased());
      if (welcomeChannel && welcomeChannel.isTextBased() && 'permissionOverwrites' in welcomeChannel) {
        // Make welcome channel writable
        await welcomeChannel.permissionOverwrites.edit(guild.id, {
          SendMessages: true,
          ViewChannel: true,
        });
        log('Welcome channel set to writable', 'discord-bot');
      }
    });

    // Handle new members
    discordClient.on('guildMemberAdd', async (member) => {
      const guild = member.guild;
      const welcomeChannel = guild.channels.cache.find((c) => c.name === 'il-witamy');

      if (welcomeChannel && welcomeChannel.isTextBased()) {
        try {
          await welcomeChannel.send(
            `Witaj ${member.user.username}! 🎉 Zapraszamy na nasz serwer!`
          );
          log(`Welcome message sent to ${member.user.username}`, 'discord-bot');
        } catch (error) {
          log(`Error sending welcome message: ${error}`, 'discord-bot');
        }
      }
    });

    await discordClient.login(token);
    log('Discord bot initialized', 'discord-bot');
  } catch (error) {
    log(`Failed to initialize Discord bot: ${error}`, 'discord-bot');
    throw error;
  }
}

export async function startDiscordBot() {
  await initializeDiscordBot();
}

export function getDiscordClient() {
  return discordClient;
}
