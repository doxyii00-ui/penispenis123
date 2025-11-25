import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { storage } from './storage';
import { log } from './app';

// Discord bot configuration
const CHANNEL_CONFIG = [
  { category: 'lobby', channels: ['witamy', 'weryfikacja'] },
  { category: 'info', channels: ['regulamin', 'ogłoszenia'] },
  { category: 'konkursy', channels: ['konkursy'] },
  { category: 'boosty', channels: ['boosty'] },
  { category: 'xd', channels: ['xd'] },
  { category: 'RESELLER', channels: ['ressell-info', 'ressell-lista'] },
  { category: 'legitki', channels: ['legit', 'opinie', 'czy-legit'] },
  { category: 'zakup', channels: ['aplikacja', 'tickety'] },
];

const ROLE_NAMES = {
  VERIFIED: 'Verified',
  UNVERIFIED: 'Unverified',
};

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
        GatewayIntentBits.MessageContent,
      ],
    });

    discordClient.once('ready', async () => {
      log('Discord bot logged in', 'discord-bot');
      
      if (!discordClient) return;

      const guild = discordClient.guilds.cache.first();
      if (!guild) {
        log('No guild found', 'discord-bot');
        return;
      }

      log(`Connected to guild: ${guild.name}`, 'discord-bot');

      // Create or get verified/unverified roles
      let verifiedRole = guild.roles.cache.find((r) => r.name === ROLE_NAMES.VERIFIED);
      if (!verifiedRole) {
        verifiedRole = await guild.roles.create({
          name: ROLE_NAMES.VERIFIED,
          reason: 'Verified members',
        });
        log(`Created role: ${ROLE_NAMES.VERIFIED}`, 'discord-bot');
      }

      let unverifiedRole = guild.roles.cache.find((r) => r.name === ROLE_NAMES.UNVERIFIED);
      if (!unverifiedRole) {
        unverifiedRole = await guild.roles.create({
          name: ROLE_NAMES.UNVERIFIED,
          reason: 'Unverified members',
        });
        log(`Created role: ${ROLE_NAMES.UNVERIFIED}`, 'discord-bot');
      }

      // Delete all existing channels and categories
      log('Deleting existing channels...', 'discord-bot');
      const oldChannelNames = ['il-witamy', 'il-weryfikacja', 'il-regulamin', 'il-ogłoszenia', 'il-konkursy', 'il-boosty', 'il-xd', 'il-ressell-info', 'il-ressell-lista', 'il-legit', 'il-opinie', 'il-czy-legit', 'il-aplikacja', 'il-tickety', 'witamy', 'weryfikacja', 'regulamin', 'ogłoszenia', 'konkursy', 'boosty', 'xd', 'ressell-info', 'ressell-lista', 'legit', 'opinie', 'czy-legit', 'aplikacja', 'tickety'];
      
      for (const channelName of oldChannelNames) {
        const channel = guild.channels.cache.find((c) => c.name === channelName && c.type !== ChannelType.GuildCategory);
        if (channel) {
          await channel.delete();
          log(`Deleted channel: ${channelName}`, 'discord-bot');
        }
      }

      const categoriesToDelete = ['lobby', 'info', 'konkursy', 'boosty', 'xd', 'RESELLER', 'legitki', 'zakup'];
      for (const categoryName of categoriesToDelete) {
        const category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === categoryName);
        if (category) {
          await category.delete();
          log(`Deleted category: ${categoryName}`, 'discord-bot');
        }
      }

      // Create channels with proper permissions
      log('Creating fresh channels...', 'discord-bot');
      for (const categoryConfig of CHANNEL_CONFIG) {
        const category = await guild.channels.create({
          name: categoryConfig.category,
          type: ChannelType.GuildCategory,
        });
        log(`Created category: ${categoryConfig.category}`, 'discord-bot');

        for (const channelName of categoryConfig.channels) {
          // Special handling for witamy and weryfikacja - visible to everyone but unverified can only see them
          const isSpecialChannel = channelName === 'witamy' || channelName === 'weryfikacja';

          let permissionOverwrites: any[] = [];
          
          if (isSpecialChannel) {
            // Witamy and weryfikacja are visible to everyone
            permissionOverwrites = [
              {
                id: guild.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
              },
            ];
          } else {
            // Other channels: only verified can see
            permissionOverwrites = [
              {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: verifiedRole.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
              },
            ];
          }

          const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites,
          });
          log(`Created channel: ${channelName}`, 'discord-bot');
        }
      }

      log('Channel setup complete', 'discord-bot');

      // Post verification message in weryfikacja channel
      const weryfikacjaChannel = guild.channels.cache.find((c) => c.name === 'weryfikacja' && c.isTextBased());
      if (weryfikacjaChannel && weryfikacjaChannel.isTextBased()) {
        try {
          const messages = await weryfikacjaChannel.messages.fetch({ limit: 10 });
          const existingVerifyMessage = messages.find((msg) => msg.author.id === discordClient!.user!.id && msg.content?.includes('Weryfikacja'));

          if (!existingVerifyMessage) {
            const verifyButton = new ButtonBuilder()
              .setCustomId('verify_button')
              .setLabel('Verify')
              .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder()
              .addComponents(verifyButton);

            const embed = new EmbedBuilder()
              .setTitle('Weryfikacja')
              .setDescription('Kliknij przycisk poniżej aby się zweryfikować i uzyskać dostęp do wszystkich kanałów.')
              .setColor(0x5865f2);

            await weryfikacjaChannel.send({
              embeds: [embed],
              components: [row as any],
            });

            log('Verification message posted in weryfikacja channel', 'discord-bot');
          }
        } catch (error) {
          log(`Error posting verification message: ${error}`, 'discord-bot');
        }
      }

      // Post ticket message in tickety channel
      const ticketyChannel = guild.channels.cache.find((c) => c.name === 'tickety' && c.isTextBased());
      if (ticketyChannel && ticketyChannel.isTextBased()) {
        try {
          const messages = await ticketyChannel.messages.fetch({ limit: 10 });
          const existingTicketMessage = messages.find((msg) => msg.author.id === discordClient!.user!.id && msg.content?.includes('Ticket'));

          if (!existingTicketMessage) {
            const ticketButton = new ButtonBuilder()
              .setCustomId('open_ticket_button')
              .setLabel('Otwórz Ticket')
              .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder()
              .addComponents(ticketButton);

            const embed = new EmbedBuilder()
              .setTitle('Ticket System')
              .setDescription('Kliknij przycisk poniżej aby otworzyć ticket w sprawie aplikacji lub pytań.')
              .setColor(0x5865f2);

            await ticketyChannel.send({
              embeds: [embed],
              components: [row as any],
            });

            log('Ticket message posted in tickety channel', 'discord-bot');
          }
        } catch (error) {
          log(`Error posting ticket message: ${error}`, 'discord-bot');
        }
      }

      // Register slash commands
      try {
        const commands = [
          new SlashCommandBuilder()
            .setName('ticket')
            .setDescription('Otwórz nowy ticket'),
        ];

        const rest = new REST({ version: '10' }).setToken(token);
        await rest.put(Routes.applicationGuildCommands(discordClient!.user!.id, guild.id), {
          body: commands.map((cmd) => cmd.toJSON()),
        });

        log('Slash commands registered', 'discord-bot');
      } catch (error) {
        log(`Error registering commands: ${error}`, 'discord-bot');
      }
    });

    // Handle new members
    discordClient.on('guildMemberAdd', async (member) => {
      const guild = member.guild;
      
      try {
        // Give unverified role
        const unverifiedRole = guild.roles.cache.find((r) => r.name === ROLE_NAMES.UNVERIFIED);
        if (unverifiedRole) {
          await member.roles.add(unverifiedRole);
          log(`Added unverified role to ${member.user.username}`, 'discord-bot');
        }

        // Send welcome message in witamy channel
        const welcomeChannel = guild.channels.cache.find((c) => c.name === 'witamy' && c.isTextBased());
        if (welcomeChannel && welcomeChannel.isTextBased()) {
          // Get member count
          const memberCount = guild.memberCount;

          // Create verification button
          const verifyButton = new ButtonBuilder()
            .setCustomId('verify_button')
            .setLabel('Verify')
            .setStyle(ButtonStyle.Primary);

          const row = new ActionRowBuilder()
            .addComponents(verifyButton);

          // Create welcome embed
          const embed = new EmbedBuilder()
            .setTitle('Witamy')
            .setDescription(`Cześć ${member}, witaj na naszym discordzie Baw się dobrze.\n\nJest nas teraz ${memberCount}, prosimy o zapoznanie się z regulaminem.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setColor(0x5865f2);

          await welcomeChannel.send({
            embeds: [embed],
            components: [row as any],
          });
          
          log(`Welcome message sent to ${member.user.username}`, 'discord-bot');
        }
      } catch (error) {
        log(`Error welcoming member: ${error}`, 'discord-bot');
      }
    });

    // Handle interactions (buttons, modals, commands)
    discordClient.on('interactionCreate', async (interaction) => {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'ticket') {
          const modal = new ModalBuilder()
            .setCustomId('ticket_modal')
            .setTitle('Otwórz Ticket');

          const subjectInput = new TextInputBuilder()
            .setCustomId('ticket_subject')
            .setLabel('Temat')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Np. Problem z aplikacją')
            .setRequired(true);

          const descriptionInput = new TextInputBuilder()
            .setCustomId('ticket_description')
            .setLabel('Opis')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Opisz swój problem...')
            .setRequired(true);

          const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput);
          const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

          modal.addComponents(firstRow, secondRow);
          await interaction.showModal(modal);
        }
      }

      // Handle button clicks
      if (interaction.isButton()) {
        if (interaction.customId === 'verify_button') {
          const member = interaction.member;
          if (!member || typeof member === 'string') return;

          try {
            const verifiedRole = interaction.guild?.roles.cache.find((r) => r.name === ROLE_NAMES.VERIFIED);
            const unverifiedRole = interaction.guild?.roles.cache.find((r) => r.name === ROLE_NAMES.UNVERIFIED);

            if (verifiedRole && unverifiedRole && member.roles && typeof member.roles.remove === 'function') {
              await member.roles.remove(unverifiedRole);
              await member.roles.add(verifiedRole);
              
              await interaction.reply({
                content: 'Gratulacje! Jesteś teraz zweryfikowany i możesz widzieć wszystkie kanały.',
                ephemeral: true,
              });
              
              log(`Verified member: ${member.user?.username}`, 'discord-bot');
            }
          } catch (error) {
            log(`Error verifying member: ${error}`, 'discord-bot');
            await interaction.reply({
              content: 'Coś poszło nie tak podczas weryfikacji.',
              ephemeral: true,
            });
          }
        }

        if (interaction.customId === 'open_ticket_button') {
          const modal = new ModalBuilder()
            .setCustomId('ticket_modal')
            .setTitle('Otwórz Ticket');

          const subjectInput = new TextInputBuilder()
            .setCustomId('ticket_subject')
            .setLabel('Temat')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Np. Problem z aplikacją')
            .setRequired(true);

          const descriptionInput = new TextInputBuilder()
            .setCustomId('ticket_description')
            .setLabel('Opis')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Opisz swój problem...')
            .setRequired(true);

          const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput);
          const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

          modal.addComponents(firstRow, secondRow);
          await interaction.showModal(modal);
        }
      }

      // Handle modal submissions
      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'ticket_modal') {
          const subject = interaction.fields.getTextInputValue('ticket_subject');
          const description = interaction.fields.getTextInputValue('ticket_description');
          const user = interaction.user;
          const guild = interaction.guild;

          try {
            await interaction.deferReply({ ephemeral: true });

            // Create a thread in tickety channel for the ticket
            const ticketyChannel = guild?.channels.cache.find((c) => c.name === 'tickety' && c.isTextBased());
            if (ticketyChannel && ticketyChannel.isTextBased()) {
              const thread = await ticketyChannel.threads.create({
                name: `${subject} - ${user.username}`,
                autoArchiveDuration: 1440,
              });

              const embed = new EmbedBuilder()
                .setTitle(`Ticket: ${subject}`)
                .setDescription(description)
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setColor(0x5865f2)
                .setTimestamp();

              await thread.send({
                embeds: [embed],
              });

              await interaction.editReply({
                content: `Ticket został utworzony! Przejdź do: ${thread.url}`,
              });

              log(`Ticket created: ${subject} by ${user.username}`, 'discord-bot');
            }
          } catch (error) {
            log(`Error creating ticket: ${error}`, 'discord-bot');
            await interaction.editReply({
              content: 'Coś poszło nie tak podczas tworzenia ticketu.',
            });
          }
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
