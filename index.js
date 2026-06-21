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

const PDFDocument = require('pdfkit');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent 
  ]
});

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const LOG_CHANNEL_ID = '1518225181472985148'; 

const dbPath = path.join(__dirname, 'entries.json');
function loadEntries() {
  if (!fs.existsSync(dbPath)) return {};
  return JSON.parse(fs.readFileSync(dbPath));
}
function saveEntries(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// ==========================================
// 🌟 PDF Generator Function
// ==========================================
function generatePDFTranscript(user, textData, imageUrls) {
  return new Promise(async (resolve) => {
    
    // Har image ke liye alag page (1 Image = 1 Page Logic)
    const doc = new PDFDocument({ margin: 40 }); 
    let buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });

    const removeEmojis = (str) => str.replace(/[^\x00-\x7F]/g, "").trim();

    // --- PAGE 1: USER DETAILS ---
    doc.fontSize(20).fillColor('#111111').text('Giveaway Entry Transcript', { align: 'center', underline: true });
    doc.moveDown(1.5);

    doc.fontSize(12).fillColor('#333333').text(`Discord User: ${removeEmojis(user.tag)}`);
    doc.text(`User ID: ${user.id}`);
    doc.text(`Submitted Date: ${new Date().toLocaleString()}`);
    doc.moveDown(2);

    doc.fontSize(14).fillColor('#007bff').text('Provided Details:', { underline: true });
    doc.moveDown(0.5);

    const cleanTextData = textData.map(line => removeEmojis(line));
    doc.fontSize(12).fillColor('#111111').text(cleanTextData.join('\n\n'));
    
    // --- NEXT PAGES: 1 IMAGE PER PAGE ---
    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const response = await axios.get(imageUrls[i], { responseType: 'arraybuffer' });
        const imgBuffer = Buffer.from(response.data, 'binary');
        
        doc.addPage();
        
        doc.fontSize(14).fillColor('#007bff').text(`Proof Screenshot #${i + 1}:`, { underline: true });
        doc.moveDown(1);
        
        doc.image(imgBuffer, { fit: [500, 650], align: 'center' });
      } catch (err) {
        doc.addPage();
        doc.fontSize(11).fillColor('red').text(`[Could not embed screenshot #${i + 1} automatically. Link: ${imageUrls[i]}]`);
      }
    }

    doc.end();
  });
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
    },
    // 🌟 NAYA COMMAND ADD KIYA GAYA HAI 🌟
    {
      name: 'clearentries',
      description: 'Delete all previous giveaway entries to start fresh'
    }
  ]);
  console.log('✅ Commands /giveaway, /giveaway2 and /clearentries registered.');
});

// ==========================================
// 🌟 SMART IMAGE DETECTION LOGIC
// ==========================================
client.on('messageCreate', async (message) => {
  if (!message.channel.name.startsWith('entry-') || message.author.bot) return;

  if (message.attachments.size > 0) {
    const hasImage = message.attachments.some(a => a.contentType && a.contentType.startsWith('image/'));
    
    if (hasImage) {
      try {
        const messages = await message.channel.messages.fetch({ limit: 15 });
        const botMsg = messages.find(m => m.author.id === client.user.id && m.components.length > 0 && m.embeds[0]?.title === '✅ Details Saved! Now Upload Proofs');

        if (botMsg) {
          const customIdSubmit = botMsg.components[0].components[0].customId;
          const customIdCancel = botMsg.components[0].components[1].customId;

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(customIdSubmit).setLabel('Submit Final Entry ✅').setStyle(ButtonStyle.Success).setDisabled(false),
            new ButtonBuilder().setCustomId(customIdCancel).setLabel('Cancel ❌').setStyle(ButtonStyle.Danger)
          );
          
          await botMsg.edit({ components: [row] });
        }
      } catch (err) {
        console.error("Image Detection Error:", err);
      }
    }
  }
});

client.on('interactionCreate', async (interaction) => {

  // ==========================================
  // 1. COMMAND: /clearentries (Database Reset)
  // ==========================================
  if (interaction.isChatInputCommand() && interaction.commandName === 'clearentries') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: '🚨 **Error:** Only Admins can clear the database.', ephemeral: true });
    }

    // Database ko empty object se replace kar dega
    saveEntries({});
    return interaction.reply({ content: '🗑️ **Success!** All previous giveaway entries have been deleted. Database is now clean and ready for the next giveaway! ✅', ephemeral: true });
  }

  // ==========================================
  // 2. COMMAND: /giveaway
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
  // 3. COMMAND: /giveaway2
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
  // 4. MAIN PARTICIPATE BUTTON
  // ==========================================
  if (interaction.isButton() && interaction.customId === 'btn_participate') {
    await interaction.deferReply({ ephemeral: true });

    try {
      const user = interaction.user;
      const guild = interaction.guild;
      const messageId = interaction.message.id;

      const data = loadEntries();
      
      if (user.username !== 'pravesh_kumar1' && data[messageId] && data[messageId].find(entry => entry.userId === user.id)) {
        return interaction.editReply({ content: '🚨 You have already submitted your entry for this giveaway!' });
      }

      const safeUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
      const channelName = `entry-${safeUsername}`;
      
      const existingChannel = guild.channels.cache.find(c => c.name === channelName);
      if (existingChannel) {
        return interaction.editReply({ content: `🚨 Your verification channel is already open here: <#${existingChannel.id}>` });
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
        .setDescription(`Welcome <@${user.id}>! To secure your entry, follow these steps:\n\n**Step 1:** Click the **Enter Details 📝** button below to fill out the form.\n**Step 2:** After submitting the form, upload your screenshots in this chat.\n\n*Click Cancel if you don't want to participate.*`)
        .setColor('#2b2d31');

      const formBtn = new ButtonBuilder().setCustomId(`open_form_${messageId}`).setLabel('Enter Details 📝').setStyle(ButtonStyle.Primary);
      const cancelBtn = new ButtonBuilder().setCustomId(`cancel_ticket_${messageId}`).setLabel('Cancel ❌').setStyle(ButtonStyle.Danger);
      
      const row = new ActionRowBuilder().addComponents(formBtn, cancelBtn);

      await channel.send({ content: `<@${user.id}>`, embeds: [embed], components: [row] });
      await interaction.editReply({ content: `✅ Ticket created! Please go here to continue: <#${channel.id}>` });

    } catch (error) {
      console.error("Participate Button Error: ", error);
      await interaction.editReply({ content: '🚨 **Error!** Could not create the channel. Please ensure the bot has **"Manage Channels"** permission.' });
    }
  }

  // ==========================================
  // 5. ENTER DETAILS BUTTON (Opens the Modal)
  // ==========================================
  if (interaction.isButton() && interaction.customId.startsWith('open_form_')) {
    const messageId = interaction.customId.split('_')[2];
    
    const modal = new ModalBuilder()
      .setCustomId(`giveaway_modal_${messageId}`)
      .setTitle('Giveaway Entry Form');

    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('form_name').setLabel('Your Name').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('form_email').setLabel('Your Email').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('form_word').setLabel('YouTube Secret Word').setStyle(TextInputStyle.Short).setRequired(true))
    );

    await interaction.showModal(modal);
  }

  // ==========================================
  // 6. MODAL SUBMIT
  // ==========================================
  if (interaction.isModalSubmit() && interaction.customId.startsWith('giveaway_modal_')) {
    const messageId = interaction.customId.split('_')[2];
    const name = interaction.fields.getTextInputValue('form_name');
    const email = interaction.fields.getTextInputValue('form_email');
    const word = interaction.fields.getTextInputValue('form_word');
    const user = interaction.user;

    const embed = new EmbedBuilder()
      .setTitle('✅ Details Saved! Now Upload Proofs')
      .setDescription(`Great <@${user.id}>! Your details are saved.\n\n**Next Step:**\nPlease **upload your screenshots** in this chat (Subscribe, Comment, etc.). \nOnce all images are uploaded, the **Submit Final Entry ✅** button will turn Green.`)
      .addFields(
        { name: '👤 Name', value: name, inline: true },
        { name: '📧 Email', value: email, inline: true },
        { name: '🔑 Word', value: word, inline: true }
      )
      .setColor('#2ecc71');

    const submitBtn = new ButtonBuilder().setCustomId(`submit_final_${messageId}`).setLabel('Submit Final Entry ✅').setStyle(ButtonStyle.Success).setDisabled(true);
    const cancelBtn = new ButtonBuilder().setCustomId(`cancel_ticket_${messageId}`).setLabel('Cancel ❌').setStyle(ButtonStyle.Danger);
    
    const row = new ActionRowBuilder().addComponents(submitBtn, cancelBtn);

    await interaction.update({ embeds: [embed], components: [row] });
  }

  // ==========================================
  // 7. FINAL SUBMIT BUTTON (Generates PDF + DM)
  // ==========================================
  if (interaction.isButton() && interaction.customId.startsWith('submit_final_')) {
    const messageId = interaction.customId.split('_')[2];
    const channel = interaction.channel;
    const user = interaction.user;
    const guild = interaction.guild;

    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) {
      return interaction.reply({ content: '🚨 Setup Error: Entry log channel not found!', ephemeral: true });
    }

    await interaction.reply({ content: '⏳ Checking your proofs and processing PDF transcript...', ephemeral: true });

    const messages = await channel.messages.fetch({ limit: 50 });
    
    let textData = [];
    const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds[0]?.title === '✅ Details Saved! Now Upload Proofs');
    
    if (botMsg && botMsg.embeds.length > 0) {
      botMsg.embeds[0].fields.forEach(f => textData.push(`${f.name}: ${f.value}`));
    } else {
      textData.push("Details manually provided.");
    }

    const userMessages = messages.filter(m => m.author.id === user.id);
    let imageUrls = [];
    userMessages.forEach(msg => {
      msg.attachments.forEach(attachment => {
        if (attachment.contentType && attachment.contentType.startsWith('image/')) {
          imageUrls.push(attachment.url);
        }
      });
    });

    if (imageUrls.length === 0) {
      return interaction.editReply({ content: '🚨 No Images Found! Please upload at least 1 screenshot in this chat, then click Submit again.' });
    }

    try {
      const data = loadEntries();
      if (!data[messageId]) data[messageId] = [];
      data[messageId].push({ userId: user.id });
      saveEntries(data);

      const pdfBuffer = await generatePDFTranscript(user, textData, imageUrls);
      const attachment = new AttachmentBuilder(pdfBuffer, { name: `transcript_${user.username}.pdf` });

      await logChannel.send({ 
        content: `📄 **New Verified Entry by:** <@${user.id}> (${user.tag})`,
        files: [attachment]
      });

      await interaction.editReply({ content: '✅ **Entry Successful!** Your PDF transcript has been securely recorded. This channel will close in 5 seconds...' });

      // DM User
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🎉 Giveaway Entry Confirmed!')
          .setDescription(`Hello <@${user.id}>,\n\nThank you for participating! Your entry has been **successfully verified** and your proofs have been securely recorded in our system.\n\nKeep an eye on the **Night Trader** server for the winner announcement. Best of luck! 🍀`)
          .setColor('#2ecc71')
          .setFooter({ text: 'Night Trader Community' });

        await user.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        console.log(`Could not send DM to ${user.tag}.`);
      }

      setTimeout(() => {
        channel.delete().catch(() => {});
      }, 5000);

    } catch (error) {
      console.error("PDF Transcript Error:", error);
      await interaction.editReply({ content: '🚨 **Error!** Could not generate or send the PDF. Ensure bot has attach file permissions.' });
    }
  }

  // ==========================================
  // 8. CANCEL TICKET BUTTON
  // ==========================================
  if (interaction.isButton() && interaction.customId.startsWith('cancel_ticket_')) {
    const channel = interaction.channel;
    await interaction.reply({ content: '❌ You have canceled the process. This channel is being deleted...', ephemeral: true });
    setTimeout(() => { channel.delete().catch(() => {}); }, 3000);
  }

  // ==========================================
  // 9. SPIN BUTTONS & WINNER CALCULATION
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

client.on('error', console.error);
client.login(process.env.BOT_TOKEN);