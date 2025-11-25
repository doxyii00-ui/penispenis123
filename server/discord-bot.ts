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
