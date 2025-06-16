require('dotenv').config();
const {
    Client, GatewayIntentBits,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    EmbedBuilder
} = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior
} = require('@discordjs/voice');
const play = require('play-dl');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

const queue = new Map();

client.once('ready', () => {
    console.log(`✅ บอทออนไลน์แล้วในชื่อ ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.content === '!music') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_modal')
                .setLabel('🎵 ใส่ลิงก์ YouTube')
                .setStyle(ButtonStyle.Primary)
        );
        await message.reply({ content: 'มึงกรุณากดปุ่มด้านล่างเพื่อใส่ลิงก์เพลง 🎶', components: [row] });
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton() && interaction.customId === 'open_modal') {
        const modal = new ModalBuilder()
            .setCustomId('youtube_modal')
            .setTitle('🎶 เล่นเพลง YouTube')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('youtube_url')
                        .setLabel('ใส่ลิงก์หรือคำค้นหา YouTube')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                )
            );
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'youtube_modal') {
        const query = interaction.fields.getTextInputValue('youtube_url');
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.reply({ content: '🔊 กรุณาเข้าห้องเสียงก่อน', ephemeral: true });

        await interaction.deferReply();
        const serverQueue = queue.get(interaction.guild.id);

        if (serverQueue) {
            serverQueue.songs.push(query);
            return interaction.editReply(`➕ เพิ่มเข้าแถว: \`${query}\``);
        }

        const songQueue = {
            voiceChannel,
            connection: null,
            player: createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } }),
            songs: [query],
            playing: false
        };
        queue.set(interaction.guild.id, songQueue);

        try {
            songQueue.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator
            });
            songQueue.connection.subscribe(songQueue.player);
            playNext(interaction, songQueue);
        } catch (err) {
            console.error(err);
            queue.delete(interaction.guild.id);
            return interaction.editReply('❌ ไม่สามารถเชื่อมต่อห้องเสียงได้');
        }
    }
});

async function playNext(interaction, songQueue) {
    const query = songQueue.songs.shift();
    if (!query) {
        queue.delete(interaction.guild.id);
        songQueue.connection.destroy();
        return;
    }

    try {
        let videoUrl = query;
        if (!play.yt_validate(query)) {
            const results = await play.search(query, { limit: 1 });
            if (results.length === 0) return interaction.followUp('❌ ไม่พบผลลัพธ์');
            videoUrl = results[0].url;
        }

        const stream = await play.stream(videoUrl);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        songQueue.player.play(resource);

        const info = await play.video_info(videoUrl);
        const embed = new EmbedBuilder()
            .setTitle('🎶 กำลังเล่น')
            .setDescription(`[${info.video_details.title}](${info.video_details.url})`)
            .setThumbnail(info.video_details.thumbnails[0].url)
            .setColor(0x1DB954);

        interaction.followUp({ embeds: [embed] });

        songQueue.player.once(AudioPlayerStatus.Idle, () => {
            playNext(interaction, songQueue);
        });
    } catch (err) {
        console.error(err);
        interaction.followUp('❌ เกิดข้อผิดพลาดในการเล่นเพลง');
    }
}

// 🛡 ป้องกัน Render ปิด
setInterval(() => { }, 1000 * 60 * 5);

client.login(process.env.DISCORD_TOKEN);