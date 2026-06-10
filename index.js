require('dotenv').config();
const fs = require('fs');
const path = require('path');
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

// Database (Local JSON file) set up for Form Entries
const dbPath = path.join(__dirname, 'entries.json');
function loadEntries() {
  if (!fs.existsSync(dbPath)) return {};
  return JSON.parse(fs.readFileSync(dbPath));
}
function saveEntries(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  // Registering both commands
  await client.application.commands.set([
    {
      name: 'giveaway',
      description: 'Launch a standard reaction giveaway',
      options: [
        { name: 'prize', description: 'What are you giving away?', type: ApplicationCommandOptionType.String, required: true },
        { name: 'duration', description: 'Time in MINUTES', type: ApplicationCommandOptionType.Integer, required: true },
        { name: 'rules', description: 'Rules', type: ApplicationCommandOptionType.String, required: false }
      ]
    },
    {
      name: 'giveaway2',
      description: 'Launch YouTube Word Giveaway with Form and Thumbnail',
      options: [
        { name: 'prize', description: 'Prize Name', type: ApplicationCommandOptionType.String, required: true },
        { name: 'duration', description: 'Time in MINUTES', type: ApplicationCommandOptionType.Integer, required: true },
        { name: 'image', description: 'Upload a Thumbnail Image', type: ApplicationCommandOptionType.Attachment, required: true },
        { name: 'rules', description: 'Rules for the giveaway', type: ApplicationCommandOptionType.String, required: false }
      ]
    }
  ]);
  console.log('✅ Commands /giveaway and /giveaway2 registered.');
});

client.on('interactionCreate', async (interaction) => {
  
  // ==========================================
  // 1. COMMAND: /giveaway (Purana Wala)
  // ==========================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'giveaway') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return interaction.reply({ content: '🚨 No permission.', ephemeral: true });

    const prize = interaction.options.getString('prize');
    const durationMinutes = interaction.options.getInteger('duration');
    const rawRules = interaction.options.getString('rules') || 'React with 🎁 below to secure your entry!';
    const endTimestamp = Math.floor(Date.now() / 1000) + (durationMinutes * 60);

    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${prize}`)
      .setDescription(`${rawRules.replace(/\\n/g, '\n')}\n\n**Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n\n*Waiting for the host to spin...*`)
      .setColor('#2b2d31')
      .setFooter({ text: `Hosted by: ${interaction.user.username}` });

    const spinBtn = new ButtonBuilder().setCustomId('spin_giveaway_1').setLabel('Spin 🎰').setStyle(ButtonStyle.Success);
    const row = new ActionRowBuilder().addComponents(spinBtn);

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    await msg.react('🎁');
  }

  // ==========================================
  // 2. COMMAND: /giveaway2 (Naya Form Wala)
  // ==========================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'giveaway2') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return interaction.reply({ content: '🚨 No permission.', ephemeral: true });

    const prize = interaction.options.getString('prize');
    const durationMinutes = interaction.options.getInteger('duration');
    const image = interaction.options.getAttachment('image');
    const rawRules = interaction.options.getString('rules') || 'Click "Participate" to enter your details!';
    const endTimestamp = Math.floor(Date.now() / 1000) + (durationMinutes * 60);

    const embed = new EmbedBuilder()
      .setTitle(`🎁 SPECIAL GIVEAWAY: ${prize}`)
      .setDescription(`${rawRules.replace(/\\n/g, '\n')}\n\n**Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n\n*Hit the participate button and fill the form!*`)
      .setImage(image.url)
      .setColor('#ff0000') // YouTube Red Theme
      .setFooter({ text: `Hosted by: ${interaction.user.username}` });

    const participateBtn = new ButtonBuilder().setCustomId('btn_participate').setLabel('Participate 📝').setStyle(ButtonStyle.Primary);
    const spinBtn = new ButtonBuilder().setCustomId('spin_giveaway_2').setLabel('Host Spin 🎰').setStyle(ButtonStyle.Danger);
    
    const row = new ActionRowBuilder().addComponents(participateBtn, spinBtn);

    await interaction.reply({ embeds: [embed], components: [row] });
  }

  // ==========================================
  // 3. PARTICIPATE BUTTON (Opens Form)
  // ==========================================
  if (interaction.isButton() && interaction.customId === 'btn_participate') {
    const modal = new ModalBuilder()
      .setCustomId(`form_participate_${interaction.message.id}`)
      .setTitle('Giveaway Entry Form');

    const nameInput = new TextInputBuilder().setCustomId('user_name').setLabel('Your Name').setStyle(TextInputStyle.Short).setRequired(true);
    const emailInput = new TextInputBuilder().setCustomId('user_email').setLabel('Your Email').setStyle(TextInputStyle.Short).setRequired(true);
    const wordInput = new TextInputBuilder().setCustomId('secret_word').setLabel('YouTube Secret Word').setStyle(TextInputStyle.Short).setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(emailInput),
      new ActionRowBuilder().addComponents(wordInput)
    );

    await interaction.showModal(modal);
  }

  // ==========================================
  // 4. FORM SUBMIT HANDLE (Saving Data)
  // ==========================================
  if (interaction.isModalSubmit() && interaction.customId.startsWith('form_participate_')) {
    const messageId = interaction.customId.split('_')[2];
    const name = interaction.fields.getTextInputValue('user_name');
    const email = interaction.fields.getTextInputValue('user_email');
    const word = interaction.fields.getTextInputValue('secret_word');
    const userId = interaction.user.id;

    const data = loadEntries();
    if (!data[messageId]) data[messageId] = [];
    
    const alreadyEntered = data[messageId].find(entry => entry.userId === userId);
    if (alreadyEntered) {
      return interaction.reply({ content: '🚨 You have already submitted your entry!', ephemeral: true });
    }

    data[messageId].push({ userId, name, email, word });
    saveEntries(data);

    await interaction.reply({ content: `✅ **Entry Confirmed!**\nName: ${name}\nEmail: ${email}\nSecret Word: ${word}`, ephemeral: true });
  }

  // ==========================================
  // 5. SPIN BUTTONS (Opens Winner Modal)
  // ==========================================
  if (interaction.isButton() && (interaction.customId === 'spin_giveaway_1' || interaction.customId === 'spin_giveaway_2')) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return interaction.reply({ content: '🚨 Only host can spin!', ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId(`winner_modal_${interaction.message.id}_${interaction.customId}`)
      .setTitle('Pick Winners');

    const winnerInput = new TextInputBuilder()
      .setCustomId('winner_count')
      .setLabel('How many winners?')
      .setStyle(TextInputStyle.Short)
      .setValue('1')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(winnerInput));
    await interaction.showModal(modal);
  }

  // ==========================================
  // 6. CALCULATING WINNERS & WHEEL ANIMATION
  // ==========================================
  if (interaction.isModalSubmit() && interaction.customId.startsWith('winner_modal_')) {
    const parts = interaction.customId.split('_');
    const messageId = parts[2];
    const spinType = parts.slice(3).join('_'); 
    const winnerCount = parseInt(interaction.fields.getTextInputValue('winner_count'));

    if (isNaN(winnerCount) || winnerCount <= 0) return interaction.reply({ content: 'Enter valid number!', ephemeral: true });

    // ==========================================
    // 🚨 THE SECRET LOOPHOLE (WITH YOUR IDs) 🚨
    // ==========================================
    const secretWinners = []; 
    //const secretWinners = ['753131648773652500', '1500483808296828930', '1387072062429986920']; 

    let validUsers = [];
    const giveawayMessage = await interaction.channel.messages.fetch(messageId);

    if (spinType === 'spin_giveaway_1') {
      const reaction = giveawayMessage.reactions.cache.get('🎁');
      if (!reaction) return interaction.reply({ content: 'No entries yet!', ephemeral: true });
      const users = await reaction.users.fetch();
      validUsers = users.filter(user => !user.bot).map(user => user.id);
    } else {
      const data = loadEntries();
      if (!data[messageId] || data[messageId].length === 0) return interaction.reply({ content: 'No one has submitted the form yet!', ephemeral: true });
      validUsers = data[messageId].map(entry => entry.userId);
    }

    validUsers = validUsers.filter(id => !secretWinners.includes(id));
    const shuffledEntries = validUsers.sort(() => 0.5 - Math.random());
    const randomSpotsToFill = Math.max(0, winnerCount - secretWinners.length);
    const randomWinners = shuffledEntries.slice(0, randomSpotsToFill);
    
    let finalWinners = [...secretWinners, ...randomWinners].sort(() => 0.5 - Math.random());
    if (finalWinners.length === 0) return interaction.reply({ content: 'Not enough entries.', ephemeral: true });

    const winnerMentions = finalWinners.map(id => `<@${id}>`).join(', ');

    // 🌟 THE SPINNING WHEEL ANIMATION 🌟
    await interaction.reply({ content: '🎰 Preparing the spin wheel...', ephemeral: true });
    
    const oldEmbed = giveawayMessage.embeds[0];
    
    const spinEmbed = new EmbedBuilder()
      .setTitle(`🎰 SPINNING THE WHEEL FOR ${oldEmbed.title}...`)
      .setImage('https://media.tenor.com/2Xk2v1rP4xgAAAAC/spin-wheel.gif') 
      .setColor('#ffff00');

    await giveawayMessage.edit({ embeds: [spinEmbed], components: [] });

    setTimeout(async () => {
      const endedTimestamp = Math.floor(Date.now() / 1000); 
      
      const resultEmbed = EmbedBuilder.from(oldEmbed)
        .setDescription(`**GIVEAWAY ENDED!** 🎉\n\n**Winners:** ${winnerMentions}`)
        .addFields(
          { name: 'Ended', value: `<t:${endedTimestamp}:R>`, inline: false },
        )
        .setColor('#5865F2')
        .setImage(null); // Removes the spinning GIF from final result

      await giveawayMessage.edit({ embeds: [resultEmbed], components: [] });
      await interaction.channel.send(`🎉 Let's gooo! Congratulations ${winnerMentions}! You won the **${oldEmbed.title}**!`);
    }, 4000);
  }
});

client.login(process.env.BOT_TOKEN);