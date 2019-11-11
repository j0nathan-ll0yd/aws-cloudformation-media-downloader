var ytdl = require('ytdl-core');
var url = 'http://www.youtube.com/watch?v=K1HTMYxjF5Y';
//var url = 'http://www.youtube.com/watch?v=WKsjaOqDXgg';
var options = {};
ytdl.getInfo(url, options, function(err, info) {
    if (err) throw err;
    var format = ytdl.chooseFormat(info.formats, {quality: '22'});
    console.log(JSON.stringify(format));
    //console.log(JSON.stringify(info));
});
