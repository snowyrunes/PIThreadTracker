var Discord = require('discord.js');
var logger = require('winston');
var auth = require('./auth.json');
var tauth = require('./tauth.json');
var tumblr = require('tumblr.js');
//var fs =require('fs');


// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

const bot = new Discord.Client();
bot.login(auth.token);

//Dictionaries
var methodDict = {};


bot.on('ready', () => {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.user.username + ' - (' + bot.user.id + ')');
});

bot.on('message', inMsg => {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with 'pi!' 
    var message = inMsg.content;
    var author = inMsg.author;
    var channel = inMsg.channel;
    var guild = inMsg.channel.guild;

    if (message.substring(0, 3) == 'tt!') {
        var args = message.split(" ");
        var cmd = args[0].toLowerCase().substring(3);

        args = args.splice(1);

        if (cmd == "getthreads"){
            var trackingChannel = null;
            //console.log(guild.channels);
            var guildChannels = guild.channels.array();

            for(var i=0; i< guildChannels.length; i++){
                if("thread-tracker" === guildChannels[i].name){
                    trackingChannel = guild.channels.get(guildChannels[i].id);
                }
            }

            if(null == trackingChannel){
                inMsg.channel.send("Could not find thread-tracker channel.");
                return;
            }

            trackingChannel.fetchMessages().then(
                messages => processChannelMessages(inMsg, messages, guild));
            

        }else {
            inMsg.channel.send(cmd + " is not a valid command");
            return;
        }

     }
});

var processChannelMessages = async function(inMsg, messages, guild){
    var userMsgs = messages.array().filter(m => m.author === inMsg.author);
    //console.log(userMsgs);

    if(userMsgs.length < 1){
        inMsg.channel.send("Error: Could not find tracking post in thread-tracker channel");
        return;
    }

    var fullContent = userMsgs.map(m => m.content).join('\n');

    //inMsg.channel.send("Getting Replies.... Please Wait.");
    var treplies = '';
    var creplies = '';

    if(fullContent.includes(".tumblr.com/post/")){
        treplies = await parseTumblr(inMsg, fullContent);
    }

    if(fullContent.includes("<#")){
        creplies = await parseChannels(inMsg, fullContent, guild);
    }

    inMsg.channel.send(creplies + "\n\n" +treplies);

}

var parseChannels = async function(inMsg, msgContent, guild){
    var reg = msgContent.match(/<#(.*)>/g);
    var trackedChannels = [];
    var channelReplies = [];

    for(var i = 0; i< reg.length; i++){
        trackedChannels.push(guild.channels.get(reg[i].substring(2, (reg[i].length -1))));
    }

    for(var ch=0; ch< trackedChannels.length; ch++){
        var messages = await trackedChannels[ch].fetchMessages({ limit: 1 });

        if(messages.array().length >= 1){
            var message = messages.array()[0];
            channelReplies.push("<#" + message.channel.id + ">: " + message.author.username + " posted last.");

        }else{
            channelReplies.push("Invalid channel.");

        }
        
    }

    return channelReplies.join("\n");
}


var parseTumblr = async function(inMsg, msgContent, guild){
    var reg = msgContent.match(/.tumblr.com\/post\/(.*)/g);
    var regB = msgContent.match(/\/(.*)\.tumblr\.com/g);
    var posts = [];
    var blogs = [];

    for(var i = 0; i< reg.length; i++){
        posts.push(reg[i].split("/")[2]);
        blogs.push(regB[i].substring(2));
    }

    var stringCat = "";


    client = tumblr.createClient({
        credentials: {
            consumer_key: tauth.consumer_key,
            consumer_secret: tauth.consumer_secret,
            token: tauth.token,
            token_secret: tauth.token_secret
        },
        returnPromises: true,
    });


    var tRepliesStringArr = await getTReplies(client, posts, blogs);
    return tRepliesStringArr.join("\n");
}


var getTReplies= async function(client, postArr, blogsArr){
    var scream = [];
    var st = ""

    for(var i = 0; i< postArr.length; i++){
            st = await getTRepliesLoop(client, postArr, blogsArr, i);
            //console.log(st);
            scream.push(st);
    }

    return scream;

}


var getTRepliesLoop = async function(client, postArr, blogsArr, index){
    

    var data = await client.blogPosts(blogsArr[index], { id: postArr[index], notes_info: true });
    var note = data.posts[0].notes.filter(n => "reblog" == n.type)[0];
    
    //console.log(note);

    var string = "Last Reblogged By: " + note.blog_name + "\nURL: " + note.blog_url + note.post_id + "\n";
    
    //console.log(string);
    return string;

}



