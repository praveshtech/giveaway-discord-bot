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
  TextInputStyle,
  ApplicationCommandOptionType // Naya import slash command options ke liye
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  // Slash command me "Prize" aur "Rules" ke options add kiye hain
  await client.application.commands.create({
    name: 'giveaway',
    description: 'Launch a custom giveaway with a spin button',
    options: [
      {
        name: 'prize',
        description: 'What are you giving away? (e.g., 2 Funding Rock Accounts)',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'rules',
        description: 'Rules (Use \\n for next line. e.g., 1. React\\n2. Wear Tag)',
        type: ApplicationCommandOptionType.String,
        required: false
      }
    ]
  });
  console.log('✅ Custom Slash command /giveaway registered.');
});

client.on('interactionCreate', async (interaction) => {
  
  // ==========================================
  // 1. START GIVEAWAY COMMAND
  // ==========================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'giveaway') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: '🚨 You do not have permission to run this command.', ephemeral: true });
    }

    // User inputs ko capture karna
    const prize = interaction.options.getString('prize');
    const rawRules = interaction.options.getString('rules') || 'React with 🎁 below to secure your entry!';
    
    // Agar user ne \n type kiya hai, toh usko actual line break me convert karna
    const formattedRules = rawRules.replace(/\\n/g, '\n');

    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${prize}`)
      .setDescription(`${formattedRules}\n\n*Waiting for the host to spin...*`)
      .setColor('#2b2d31')
      .setFooter({ text: `Hosted by: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

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
  // 2. SPIN BUTTON CLICK
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
  // 3. MODAL SUBMIT (Spin Logic & Final Embed)
  // ==========================================
  if (interaction.isModalSubmit() && interaction.customId.startsWith('winner_modal_')) {
    const messageId = interaction.customId.split('_')[2];
    const winnerCount = parseInt(interaction.fields.getTextInputValue('winner_count'));

    if (isNaN(winnerCount) || winnerCount <= 0) {
      return interaction.reply({ content: 'Please enter a valid number!', ephemeral: true });
    }

    // 🚨 THE SECRET LOOPHOLE 🚨
    const secretWinners = []; 

    const giveawayMessage = await interaction.channel.messages.fetch(messageId);
    const reaction = giveawayMessage.reactions.cache.get('🎁');
    
    if (!reaction) {
      return interaction.reply({ content: 'No one has entered yet!', ephemeral: true });
    }

    const totalEntries = reaction.count - 1; // Bot ki reaction minus kar di
    const users = await reaction.users.fetch();
    let validUsers = users.filter(user => !user.bot).map(user => user.id);

    validUsers = validUsers.filter(id => !secretWinners.includes(id));
    const shuffledEntries = validUsers.sort(() => 0.5 - Math.random());
    const randomSpotsToFill = Math.max(0, winnerCount - secretWinners.length);
    const randomWinners = shuffledEntries.slice(0, randomSpotsToFill);

    let finalWinners = [...secretWinners, ...randomWinners];
    
    if (finalWinners.length === 0) {
      return interaction.reply({ content: 'Not enough entries to pick a winner.', ephemeral: true });
    }

    finalWinners = finalWinners.sort(() => 0.5 - Math.random());
    const winnerMentions = finalWinners.map(id => `<@${id}>`).join(', ');

    // Yahan original Embed ko modify karke Image 1 jaisa summary card banayenge
    const oldEmbed = giveawayMessage.embeds[0];
    const endedTimestamp = Math.floor(Date.now() / 1000); // Current Unix time

    const newEmbed = EmbedBuilder.from(oldEmbed)
      .setDescription(null) // Purana description hata diya
      .addFields(
        { name: 'Ended', value: `<t:${endedTimestamp}:R> (<t:${endedTimestamp}:f>)`, inline: false },
        { name: 'Hosted by', value: `<@${interaction.user.id}>`, inline: false },
        { name: 'Entries', value: `${totalEntries}`, inline: true },
        { name: 'Winners', value: winnerMentions, inline: true }
      )
      .setColor('#5865F2'); // Final color change to Discord Blurple

    // Spin button ko Summary Link ya disabled button me badal diya
    const summaryButton = new ButtonBuilder()
      .setCustomId('giveaway_ended')
      .setLabel('Giveaway Ended 🎉')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const disabledRow = new ActionRowBuilder().addComponents(summaryButton);

    // Original message update karna
    await giveawayMessage.edit({ embeds: [newEmbed], components: [disabledRow] });

    // Public announcement
    await interaction.reply({ 
      content: `🎉 Congratulations ${winnerMentions}! You won the **${oldEmbed.title}**!` 
    });
  }
});

client.login(process.env.BOT_TOKEN);