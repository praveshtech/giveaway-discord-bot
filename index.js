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
  ApplicationCommandOptionType,
  ChannelType,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  AttachmentBuilder 
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent 
  ]
});

// ==========================================
// ⚙️ CONFIGURATION (CHANNEL ID SETTING)
// ==========================================
// Aapke 'giveaways-entry' channel ki ID 👇
const LOG_CHANNEL_ID = '1518225181472985148'; 


// Database set up
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
      description: 'Launch YouTube Word Giveaway with Private Entry Channel',
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
  // 1. COMMAND: /giveaway
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
  // 2. COMMAND: /giveaway2 (Ticket Giveaway)
  // ==========================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'giveaway2') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return interaction.reply({ content: '🚨 No permission.', ephemeral: true });

    const prize = interaction.options.getString('prize');
    const durationMinutes = interaction.options.getInteger('duration');
    const image = interaction.options.getAttachment('image');
    const rawRules = interaction.options.getString('rules') || 'Click "Participate" to open your verification channel!';
    const endTimestamp = Math.floor(Date.now() / 1000) + (durationMinutes * 60);

    const embed = new EmbedBuilder()
      .setTitle(`🎁 SPECIAL GIVEAWAY: ${prize}`)
      .setDescription(`${rawRules.replace(/\\n/g, '\n')}\n\n**Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n\n*Hit the participate button to submit your details and screenshots!*`)
      .setImage(image.url)
      .setColor('#ff0000') 
      .setFooter({ text: `Hosted by: ${interaction.user.username}` });

    const participateBtn = new ButtonBuilder().setCustomId('btn_participate').setLabel('Participate 📝').setStyle(ButtonStyle.Primary);
    const spinBtn = new ButtonBuilder().setCustomId('spin_giveaway_2').setLabel('Host Spin 🎰').setStyle(ButtonStyle.Danger);
    
    const row = new ActionRowBuilder().addComponents(participateBtn, spinBtn);

    await interaction.reply({ embeds: [embed], components: [row] });
  }

  // ==========================================
  // 3. PARTICIPATE BUTTON (With Admin Immunity)
  // ==========================================
  if (interaction.isButton() && interaction.customId === 'btn_participate') {
    const user = interaction.user;
    const guild = interaction.guild;
    const messageId = interaction.message.id;

    const data = loadEntries();
    
    // 🌟 ADMIN IMMUNITY: 'pravesh_kumar1' ko Anti-Spam check bypass milega 🌟
    if (user.username !== 'pravesh_kumar1' && data[messageId] && data[messageId].find(entry => entry.userId === user.id)) {
      return interaction.reply({ content: '🚨 You have already submitted your entry for this giveaway!', ephemeral: true });
    }

    const channelName = `entry-${user.username.toLowerCase()}`;
    const existingChannel = guild.channels.cache.find(c => c.name === channelName);
    if (existingChannel) {
      return interaction.reply({ content: `🚨 Your verification channel is already open here: <#${existingChannel.id}>`, ephemeral: true });
    }

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, 
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.ReadMessageHistory] }, 
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ReadMessageHistory] } 
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle('📝 Giveaway Verification Process')
      .setDescription(`Welcome <@${user.id}>! To secure your entry, please complete the following steps:\n\n**1️⃣ Provide Your Details:**\nSend your **Name, Email, and YouTube Secret Word** in a single message in this chat.\n\n**2️⃣ Upload Screenshots:**\n👉 Screenshot of subscribing to the NT YouTube Channel.\n👉 Screenshot of your comment on the video.\n👉 Other (Optional).\n\n*Once everything is uploaded, click 'Submit ✅'. If you wish to cancel, click 'Cancel ❌'.*`)
      .setColor('#2b2d31');

    const submitBtn = new ButtonBuilder().setCustomId(`submit_ticket_${messageId}`).setLabel('Submit ✅').setStyle(ButtonStyle.Success);
    const cancelBtn = new ButtonBuilder().setCustomId(`cancel_ticket_${messageId}`).setLabel('Cancel ❌').setStyle(ButtonStyle.Danger);
    
    const row = new ActionRowBuilder().addComponents(submitBtn, cancelBtn);

    await channel.send({ content: `<@${user.id}>`, embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Your secure entry channel has been created! Please submit your proofs here: <#${channel.id}>`, ephemeral: true });
  }

  // ==========================================
  // 4. SUBMIT TICKET BUTTON (Transcript File Logic)
  // ==========================================
  if (interaction.isButton() && interaction.customId.startsWith('submit_ticket_')) {
    const messageId = interaction.customId.split('_')[2];
    const channel = interaction.channel;
    const user = interaction.user;
    const guild = interaction.guild;

    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) {
      return interaction.reply({ content: '🚨 Setup Error: Entry log channel not found! Please verify the **LOG_CHANNEL_ID** inside your `index.js` file.', ephemeral: true });
    }

    await interaction.reply({ content: '⏳ Checking your details and images...', ephemeral: true });

    const messages = await channel.messages.fetch({ limit: 50 });
    const userMessages = messages.filter(m => m.author.id === user.id);

    let textData = [];
    let imageUrls = [];

    userMessages.forEach(msg => {
      if (msg.content) textData.push(msg.content);
      msg.attachments.forEach(attachment => {
        if (attachment.contentType && attachment.contentType.startsWith('image/')) {
          imageUrls.push(attachment.url);
        }
      });
    });

    if (textData.length === 0 || imageUrls.length === 0) {
      return interaction.editReply({ content: '🚨 Incomplete data! Please provide your Name/Email and upload at least 1 screenshot, then click Submit again.' });
    }

    try {
      // Background me ID save karna spin wheel ke liye
      const data = loadEntries();
      if (!data[messageId]) data[messageId] = [];
      data[messageId].push({ userId: user.id });
      saveEntries(data);

      const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Giveaway Entry - ${user.tag}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #313338; color: #dbdee1; padding: 20px; }
          .box { background-color: #2b2d31; padding: 25px; border-radius: 8px; max-width: 700px; margin: 0 auto; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
          h2 { color: #f2f3f5; border-bottom: 2px solid #1e1f22; padding-bottom: 10px; margin-top: 0; }
          .info { background: #1e1f22; padding: 15px; border-radius: 6px; font-size: 16px; margin-bottom: 20px; white-space: pre-wrap; word-wrap: break-word;}
          .images img { max-width: 100%; border-radius: 8px; margin-bottom: 15px; border: 2px solid #1e1f22; }
          .footer { text-align: center; font-size: 12px; color: #80848e; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>🎁 Giveaway Entry Transcript</h2>
          <p><strong>Discord User:</strong> ${user.tag} (ID: ${user.id})</p>
          
          <h3>📝 Details Provided:</h3>
          <div class="info">${textData.join('\n')}</div>
          
          <h3>📸 Uploaded Screenshots:</h3>
          <div class="images">
            ${imageUrls.map(url => `<a href="${url}" target="_blank"><img src="${url}" alt="User Proof"></a>`).join('<br>')}
          </div>
        </div>
        <div class="footer">Generated by NT Giveaway Bot</div>
      </body>
      </html>
      `;

      const buffer = Buffer.from(htmlContent, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `transcript_${user.username}.html` });

      await logChannel.send({ 
        content: `📄 **New Verified Entry by:** <@${user.id}>`,
        files: [attachment]
      });

      await interaction.editReply({ content: '✅ **Entry Successful!** Your details and proofs have been safely recorded. This channel will close in 5 seconds...' });

      setTimeout(() => {
        channel.delete().catch(() => {});
      }, 5000);

    } catch (error) {
      console.error("Transcript Error:", error);
      await interaction.editReply({ content: '🚨 **Error!** Bot could not send the transcript. Please ensure it has `Send Messages` and `Attach Files` permissions.' });
    }
  }

  // ==========================================
  // 5. CANCEL TICKET BUTTON
  // ==========================================
  if (interaction.isButton() && interaction.customId.startsWith('cancel_ticket_')) {
    const channel = interaction.channel;
    
    await interaction.reply({ content: '❌ You have canceled the process. This channel is being deleted...', ephemeral: true });
    
    setTimeout(() => {
      channel.delete().catch(() => {});
    }, 3000);
  }

  // ==========================================
  // 6. SPIN BUTTONS
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
  // 7. CALCULATING WINNERS
  // ==========================================
  if (interaction.isModalSubmit() && interaction.customId.startsWith('winner_modal_')) {
    const parts = interaction.customId.split('_');
    const messageId = parts[2];
    const spinType = parts.slice(3).join('_'); 
    const winnerCount = parseInt(interaction.fields.getTextInputValue('winner_count'));

    if (isNaN(winnerCount) || winnerCount <= 0) return interaction.reply({ content: 'Enter a valid number!', ephemeral: true });

    const secretWinners = []; 

    let validUsers = [];
    const giveawayMessage = await interaction.channel.messages.fetch(messageId);

    if (spinType === 'spin_giveaway_1') {
      const reaction = giveawayMessage.reactions.cache.get('🎁');
      if (!reaction) return interaction.reply({ content: 'No entries yet!', ephemeral: true });
      const users = await reaction.users.fetch();
      validUsers = users.filter(user => !user.bot).map(user => user.id);
    } else {
      const data = loadEntries();
      if (!data[messageId] || data[messageId].length === 0) return interaction.reply({ content: 'No one has submitted an entry yet!', ephemeral: true });
      validUsers = data[messageId].map(entry => entry.userId);
    }

    const totalEntriesCount = validUsers.length;

    validUsers = validUsers.filter(id => !secretWinners.includes(id));
    const shuffledEntries = validUsers.sort(() => 0.5 - Math.random());
    const randomSpotsToFill = Math.max(0, winnerCount - secretWinners.length);
    const randomWinners = shuffledEntries.slice(0, randomSpotsToFill);
    
    let finalWinners = [...secretWinners, ...randomWinners].sort(() => 0.5 - Math.random());
    if (finalWinners.length === 0) return interaction.reply({ content: 'Not enough entries.', ephemeral: true });

    const winnerMentions = finalWinners.map(id => `<@${id}>`).join(', ');

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
          { name: 'Total Entries', value: `${totalEntriesCount}`, inline: true }, 
          { name: 'Ended', value: `<t:${endedTimestamp}:R>`, inline: true }
        )
        .setColor('#5865F2')
        .setImage(null); 

      await giveawayMessage.edit({ embeds: [resultEmbed], components: [] });
      await interaction.channel.send(`🎉 Let's gooo! Congratulations ${winnerMentions}! You won the **${oldEmbed.title}**!`);
    }, 4000);
  }
});

client.login(process.env.BOT_TOKEN);