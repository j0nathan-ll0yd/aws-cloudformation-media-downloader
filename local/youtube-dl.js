var ytdl = require('ytdl-core');
var url = 'https://www.youtube.com/watch?v=x8VgBfsRvsc';
var HttpsProxyAgent = require('https-proxy-agent');
var proxy = process.env.http_proxy || 'http://162.223.88.228:8080';
var agent = new HttpsProxyAgent(proxy);
var options = {
    requestOptions: {
        agent: agent,
        maxReconnects: 10,
        maxRetries: 10,
        backoff: { inc: 100, max: 10000 },
    }
};
ytdl.getInfo(url, options, function(err, info) {
    if (err) throw err;
    // var format = ytdl.chooseFormat(info.formats, {quality: '22'});
    //console.log(JSON.stringify(format));
    console.log(JSON.stringify(info));
});
