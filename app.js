require('dotenv').config()
const _ = require('lodash')
const irc = require('irc')
const winston = require('winston')
const axios = require('axios')
const telegramBot = require('node-telegram-bot-api')
winston.add(winston.transports.File, { filename: 'messages.log' })

const twitchNickname = process.env.TWITCH_NICKNAME
const twitchPassword = process.env.TWITCH_PASSWORD
const telegramUserId = process.env.TELEGRAM_USER_ID
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
const channels = process.env.TWITCH_CHANNELS.split(',')
const game = process.env.GAME
const showLog = process.env.SHOW_LOG
const bot = new telegramBot(telegramBotToken, {polling: true})
const streamURL = _.template('https://api.twitch.tv/kraken/streams/${user}')

withHash = (channels) => _.map(channels, (channel) => '#' + channel)

const client = new irc.Client('irc.chat.twitch.tv', twitchNickname, { password: twitchPassword, channels: withHash(channels) })

checkChannels = () => {
  const requests = _.map(channels, (user) => axios.get(streamURL({user: user})))

  axios.all(requests).then((response) => {
    const onlineChannels = getOnline(response)
    if(!!!onlineChannels.length) return
    const names = getNames(onlineChannels)
    sendMessage(names)
  })
}

getOnline = (response) => _.filter(response, (res) => _.get(res, 'data.stream.game') === game)
getNames = (channels) => _.map(channels, (channel) => getNickname(channel))
getNickname = (data) => _.last(_.get(data, 'data.stream._links.self').split('/'))
sendMessage = (names) => bot.sendMessage(telegramUserId, messageText(names), { parse_mode: 'Markdown' })

messageText = (names) => {
  const link = _.template('[${name}](www.twitch.tv/${name})')
  return _.map(names, (name) => link({name: name})).join("\n")
}

client.addListener('message', (from, to, message) => {
  const reg = new RegExp('@' + twitchNickname)

  if(message.match(reg)){
    winston.info('%s@%s: %s', to, from, message)
    bot.sendMessage(telegramUserId, message)
  }
  if(showLog === 'true') console.log(to, '=>', from, ':', message)
})

client.addListener('error', (message) => {
  winston.error(message)
})

bot.onText(/\/streams/, (msg, match) => checkChannels())
