require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('discord-player');
const { YouTubeExtractor } = require('@discord-player/extractor');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

const player = new Player(client);
player.extractors.register(YouTubeExtractor);

client.once('ready', () => {
    console.log(`✅ บอทออนไลน์แล้วในชื่อ ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!play')) {
        const query = message.content.replace('!play', '').trim();
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('🔊 กรุณาเข้าห้องเสียงก่อน');

        await message.channel.send('🔍 กำลังค้นหาเพลง...');

        try {
            const searchResult = await player.search(query, {
                requestedBy: message.author
            });

            if (!searchResult || !searchResult.tracks.length)
                return message.reply('❌ ไม่พบเพลงที่ค้นหา');

            const queue = await player.nodes.create(message.guild, {
                metadata: {
                    channel: message.channel
                }
            });

            if (!queue.connection) await queue.connect(voiceChannel);

            queue.addTrack(searchResult.tracks[0]);
            if (!queue.isPlaying()) await queue.node.play();

            return message.channel.send(`🎶 กำลังเล่น: **${searchResult.tracks[0].title}**`);
        } catch (error) {
            console.error(error);
            return message.reply('❌ เกิดข้อผิดพลาด');
        }
    }

    if (message.content === '!skip') {
        const queue = player.nodes.get(message.guild.id);
        if (!queue || !queue.isPlaying()) return message.reply('❌ ไม่มีเพลงที่กำลังเล่น');
        queue.node.skip();
        return message.reply('⏭️ ข้ามเพลงแล้ว');
    }

    if (message.content === '!stop') {
        const queue = player.nodes.get(message.guild.id);
        if (!queue || !queue.isPlaying()) return message.reply('❌ ไม่มีเพลงที่กำลังเล่น');
        queue.delete();
        return message.reply('⏹️ หยุดเล่นเพลงแล้ว');
    }
});

setInterval(() => { }, 1000 * 60 * 5); // ป้องกัน Render ปิด

client.login(process.env.DISCORD_TOKEN);
