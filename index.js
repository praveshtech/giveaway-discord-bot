require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionsBitField, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// 1. Bot Ready & Slash Command Registration
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  // Register the /giveaway command globally (can take up to an hour to sync in all servers)
  // For instant sync, you can register to a specific guild ID instead
  await client.application.commands.create({
    name: 'giveaway',
    description: 'Launch a new giveaway with a spin button',
  });
  console.log('✅ Slash command /giveaway registered.');
});

// 2. Handling Commands and Interactions
client.on('interactionCreate', async (interaction) => {
  
  // ==========================================
  // START GIVEAWAY COMMAND
  // ==========================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'giveaway') {
    // Admin check: Only users with Manage Guild permissions can start a giveaway
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: '🚨 You do not have permission to run this command.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎁 Epic Giveaway!')
      .setDescription('React with 🎁 below to secure your entry!\n\n*Waiting for the host to spin...*')
      .setColor('#2b2d31');

    const spinButton = new ButtonBuilder()
      .setCustomId('spin_giveaway_button')
      .setLabel('Spin 🎰')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(spinButton);

    const giveawayMessage = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    await giveawayMessage.react('🎁');
  }

  // ==========================================
  // SPIN BUTTON CLICK (Shows Modal)
  // ==========================================
  if (interaction.isButton() && interaction.customId === 'spin_giveaway_button') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: '🚨 Only the host can spin the wheel!', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`winner_modal_${interaction.message.id}`)
      .setTitle('Pick Giveaway Winners');

    const winnerInput = new TextInputBuilder()
      .setCustomId('winner_count')
      .setLabel('How many winners to pick?')
      .setStyle(TextInputStyle.Short)
      .setValue('1')
      .setRequired(true);

    const modalRow = new ActionRowBuilder().addComponents(winnerInput);
    modal.addComponents(modalRow);

    await interaction.showModal(modal);
  }

  // ==========================================
  // MODAL SUBMIT (The Magic & Loophole Logic)
  // ==========================================
  if (interaction.isModalSubmit() && interaction.customId.startsWith('winner_modal_')) {
    const messageId = interaction.customId.split('_')[2];
    const winnerCount = parseInt(interaction.fields.getTextInputValue('winner_count'));

    if (isNaN(winnerCount) || winnerCount <= 0) {
      return interaction.reply({ content: 'Please enter a valid number!', ephemeral: true });
    }

    // 🚨 THE SECRET LOOPHOLE 🚨
    // Update this array with the exact Discord User IDs you want to guarantee.
    // Example: ['123456789012345678', '987654321098765432']
    const secretWinners = []; 

    const giveawayMessage = await interaction.channel.messages.fetch(messageId);
    const reaction = giveawayMessage.reactions.cache.get('🎁');
    
    if (!reaction) {
      return interaction.reply({ content: 'No one has entered yet!', ephemeral: true });
    }

    const users = await reaction.users.fetch();
    let validUsers = users.filter(user => !user.bot).map(user => user.id);

    // Remove guaranteed winners from the random pool to prevent double-picking
    validUsers = validUsers.filter(id => !secretWinners.includes(id));

    // Shuffle legitimate users
    const shuffledEntries = validUsers.sort(() => 0.5 - Math.random());
    
    // Fill remaining slots
    const randomSpotsToFill = Math.max(0, winnerCount - secretWinners.length);
    const randomWinners = shuffledEntries.slice(0, randomSpotsToFill);

    // Combine secret and random winners, then shuffle them so the order looks organic
    let finalWinners = [...secretWinners, ...randomWinners];
    
    if (finalWinners.length === 0) {
      return interaction.reply({ content: 'Not enough entries to pick a winner.', ephemeral: true });
    }

    finalWinners = finalWinners.sort(() => 0.5 - Math.random());
    const winnerMentions = finalWinners.map(id => `<@${id}>`).join(', ');

    // Reply to the text channel with the announcement
    await interaction.reply({ 
      content: `🎉 **SPIN COMPLETE!** 🎉\nCongratulations to our winner(s): ${winnerMentions}! You have won the giveaway!` 
    });

    // Optional: Disable the button so it can't be spun again
    const disabledRow = new ActionRowBuilder().addComponents(
      ButtonBuilder.from(giveawayMessage.components[0].components[0]).setDisabled(true)
    );
    await giveawayMessage.edit({ components: [disabledRow] });
  }
});

client.login(process.env.BOT_TOKEN);
