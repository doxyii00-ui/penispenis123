import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import { storage } from './storage';
import { log } from './app';

// Discord bot configuration
// These are the channels that will be created on bot startup
const CHANNEL_CONFIG = [
  // lobby category
  { category: 'lobby', channels: ['witamy', 'weryfikacja'] },
  // info category
  { category: 'info', channels: ['regulamin', 'ogłoszenia'] },
  // konkursy category
  { category: 'konkursy', channels: ['konkursy'] },
  // boosty category
  { category: 'boosty', channels: ['boosty'] },
  // xd category
  { category: 'xd', channels: ['xd'] },
  // RESELLER category
  { category: 'RESELLER', channels: ['ressell-info', 'ressell-lista'] },
  // legitki category
  { category: 'legitki', channels: ['legit', 'opinie', 'czy-legit'] },
  // zakup category
  { category: 'zakup', channels: ['aplikacja', 'tickety'] },
];

let discordClient: Client | null = null;

async function getAccessToken() {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN environment variable not set');
  }

  return token;
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

      // Delete all existing channels (both old with "il-" prefix and new ones)
      log('Deleting existing channels...', 'discord-bot');
      const oldChannelNames = ['il-witamy', 'il-weryfikacja', 'il-regulamin', 'il-ogłoszenia', 'il-konkursy', 'il-boosty', 'il-xd', 'il-ressell-info', 'il-ressell-lista', 'il-legit', 'il-opinie', 'il-czy-legit', 'il-aplikacja', 'il-tickety', 'witamy', 'weryfikacja', 'regulamin', 'ogłoszenia', 'konkursy', 'boosty', 'xd', 'ressell-info', 'ressell-lista', 'legit', 'opinie', 'czy-legit', 'aplikacja', 'tickety'];
      
      // Delete all channels with old and new names
      for (const channelName of oldChannelNames) {
        const channel = guild.channels.cache.find((c) => c.name === channelName && c.type !== ChannelType.GuildCategory);
        if (channel) {
          await channel.delete();
          log(`Deleted channel: ${channelName}`, 'discord-bot');
        }
      }

      // Delete all categories
      const categoriesToDelete = ['lobby', 'info', 'konkursy', 'boosty', 'xd', 'RESELLER', 'legitki', 'zakup'];
      for (const categoryName of categoriesToDelete) {
        const category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === categoryName);
        if (category) {
          await category.delete();
          log(`Deleted category: ${categoryName}`, 'discord-bot');
        }
      }

      // Create or update channels
      log('Creating fresh channels...', 'discord-bot');
      for (const categoryConfig of CHANNEL_CONFIG) {
        // Create category
        const category = await guild.channels.create({
          name: categoryConfig.category,
          type: ChannelType.GuildCategory,
        });
        log(`Created category: ${categoryConfig.category}`, 'discord-bot');

        // Create channels in category
        for (const channelName of categoryConfig.channels) {
          const channel = await guild.channels.create({
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

      // Special: Find and make welcome channel writable
      let welcomeChannel = guild.channels.cache.find((c) => c.name === 'witamy' && c.isTextBased());
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
