require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
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
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const queue = new Map();

client.once('ready', async () => {
    console.log(`✅ บอทออนไลน์แล้วในชื่อ ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('play')
            .setDescription('เล่นเพลงจาก YouTube (ลิงก์หรือคำค้นหา)')
            .addStringOption(option =>
                option.setName('query').setDescription('ลิงก์หรือคำค้นหา').setRequired(true)),
        new SlashCommandBuilder()
            .setName('skip')
            .setDescription('ข้ามเพลงที่กำลังเล่น'),
        new SlashCommandBuilder()
            .setName('stop')
            .setDescription('หยุดเล่นและล้างคิว')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ ลงทะเบียน Slash Command สำเร็จ');
    } catch (err) {
        console.error('❌ ลงทะเบียนคำสั่งล้มเหลว', err);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guild.id;
    const serverQueue = queue.get(guildId);

    if (interaction.commandName === 'play') {
        const query = interaction.options.getString('query');
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.reply('🔊 กรุณาเข้าห้องเสียงก่อน');

        await interaction.deferReply();

        if (serverQueue) {
            serverQueue.songs.push(query);
            return interaction.editReply(`➕ เพิ่มเข้าแถว: \`${query}\``);
        } else {
            const songQueue = {
                voiceChannel,
                connection: null,
                player: createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } }),
                songs: [query],
                playing: false
            };
            queue.set(guildId, songQueue);
            try {
                songQueue.connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId,
                    adapterCreator: interaction.guild.voiceAdapterCreator
                });
                songQueue.connection.subscribe(songQueue.player);
                playNext(interaction, songQueue);
            } catch (err) {
                console.error(err);
                queue.delete(guildId);
                return interaction.editReply('❌ ไม่สามารถเชื่อมต่อห้องเสียงได้');
            }
        }

    } else if (interaction.commandName === 'skip') {
        if (!serverQueue) return interaction.reply('❌ ไม่มีเพลงที่กำลังเล่น');
        serverQueue.player.stop();
        interaction.reply('⏭️ ข้ามเพลงแล้ว');

    } else if (interaction.commandName === 'stop') {
        if (!serverQueue) return interaction.reply('❌ ไม่มีเพลงที่กำลังเล่น');
        serverQueue.songs = [];
        serverQueue.player.stop();
        if (serverQueue.connection) serverQueue.connection.destroy();
        queue.delete(guildId);
        interaction.reply('⏹️ หยุดเล่นและออกจากห้องเสียงแล้ว');
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

setInterval(() => { }, 1000 * 60 * 5);

client.login(process.env.DISCORD_TOKEN);
