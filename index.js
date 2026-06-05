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
  ApplicationCommandOptionType 
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
  
  // Timer (duration) wala option yahan add kiya hua hai
  await client.application.commands.create({
    name: 'giveaway',
    description: 'Launch a custom giveaway with a spin button',
    options: [
      {
        name: 'prize',
        description: 'What are you giving away? (e.g., 2 Funding Pips Accounts)',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'duration',
        description: 'Time in MINUTES (e.g., 60 for 1 hour, 1440 for 24 hours)',
        type: ApplicationCommandOptionType.Integer,
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
  
  if (interaction.isChatInputCommand() && interaction.commandName === 'giveaway') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: '🚨 You do not have permission to run this command.', ephemeral: true });
    }

    const prize = interaction.options.getString('prize');
    const durationMinutes = interaction.options.getInteger('duration');
    const rawRules = interaction.options.getString('rules') || 'React with 🎁 below to secure your entry!';
    
    // Timer calculation logic
    const endTimestamp = Math.floor(Date.now() / 1000) + (durationMinutes * 60);
    const formattedRules = rawRules.replace(/\\n/g, '\n');

    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${prize}`)
      .setDescription(`${formattedRules}\n\n**Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n\n*Waiting for the host to spin...*`)
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

    const totalEntries = reaction.count - 1; 
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

    const oldEmbed = giveawayMessage.embeds[0];
    const endedTimestamp = Math.floor(Date.now() / 1000); 

    const newEmbed = EmbedBuilder.from(oldEmbed)
      .setDescription(null) 
      .addFields(
        { name: 'Ended', value: `<t:${endedTimestamp}:R> (<t:${endedTimestamp}:f>)`, inline: false },
        { name: 'Hosted by', value: `<@${interaction.user.id}>`, inline: false },
        { name: 'Entries', value: `${totalEntries}`, inline: true },
        { name: 'Winners', value: winnerMentions, inline: true }
      )
      .setColor('#5865F2'); 

    const summaryButton = new ButtonBuilder()
      .setCustomId('giveaway_ended')
      .setLabel('Giveaway Ended 🎉')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const disabledRow = new ActionRowBuilder().addComponents(summaryButton);

    await giveawayMessage.edit({ embeds: [newEmbed], components: [disabledRow] });

    await interaction.reply({ 
      content: `🎉 Congratulations ${winnerMentions}! You won the **${oldEmbed.title}**!` 
    });
  }
});

client.login(process.env.BOT_TOKEN);