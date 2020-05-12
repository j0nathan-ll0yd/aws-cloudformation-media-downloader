var ytdl = require('ytdl-core');
var url = 'https://www.youtube.com/watch?v=x8VgBfsRvsc';
ytdl.getInfo(url, function(err, info) {
    if (err) throw err;
    // var format = ytdl.chooseFormat(info.formats, {quality: '22'});
    //console.log(JSON.stringify(format));
    console.log(JSON.stringify(info));
});
