require('dotenv').config();
const {
    Client, GatewayIntentBits,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    EmbedBuilder
} = require('discord.js');
const { Player } = require('discord-player');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

const player = new Player(client);

client.once('ready', () => {
    console.log(`✅ บอทออนไลน์แล้วในชื่อ ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.content === '!music') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_modal')
                .setLabel('🎵 ใส่ลิงก์หรือชื่อเพลง')
                .setStyle(ButtonStyle.Primary)
        );
        await message.reply({ content: 'กดปุ่มเพื่อใส่ลิงก์หรือชื่อเพลง 🎶', components: [row] });
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton() && interaction.customId === 'open_modal') {
        const modal = new ModalBuilder()
            .setCustomId('music_modal')
            .setTitle('🎶 เปิดเพลง YouTube')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('music_query')
                        .setLabel('ชื่อเพลงหรือ URL YouTube')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                )
            );
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'music_modal') {
        const query = interaction.fields.getTextInputValue('music_query');
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.reply({ content: '🔊 กรุณาเข้าห้องเสียงก่อน', ephemeral: true });

        await interaction.deferReply();

        try {
            const searchResult = await player.search(query, {
                requestedBy: interaction.user
            });

            if (!searchResult || !searchResult.tracks.length)
                return interaction.editReply('❌ ไม่พบเพลงที่ค้นหา');

            const queue = await player.nodes.create(interaction.guild, {
                metadata: {
                    channel: interaction.channel
                }
            });

            if (!queue.connection)
                await queue.connect(voiceChannel);

            queue.addTrack(searchResult.tracks[0]);
            if (!queue.isPlaying()) await queue.node.play();

            const track = searchResult.tracks[0];
            const embed = new EmbedBuilder()
                .setTitle('🎶 กำลังเล่นเพลง')
                .setDescription(`[${track.title}](${track.url})`)
                .setThumbnail(track.thumbnail)
                .setColor(0x1DB954);

            interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error(err);
            interaction.editReply('❌ เกิดข้อผิดพลาดในการเล่นเพลง');
        }
    }
});

setInterval(() => { }, 1000 * 60 * 5); // ป้องกัน Render ปิด

client.login(process.env.DISCORD_TOKEN);