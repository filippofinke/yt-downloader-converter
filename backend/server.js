/**
* @author Filippo Finke
*/
const http = require('http');
const fs = require('fs');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');

const WebSocketServer = require('websocket').server;

const MUSIC_PATH = "./../frontend/music/";
const VIDEO_PATH = "./../frontend/video/";


var server = http.createServer(function(request, response) {}).listen(8080, function() {});

wsServer = new WebSocketServer({
    httpServer: server
});

wsServer.on('request', function(request) {
    var connection = request.accept(null, request.origin);
    var ip = connection.remoteAddress;
    console.log("[" + ip + "] Connected!");

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            var url = message.utf8Data;
            if(ytdl.validateURL(url))
            {
            var id = ytdl.getVideoID(url);
            ytdl.getInfo(id, (err, info) => {
                if (err) throw err;
                var title = info.title;
                var newtitle = info.title.toLowerCase().replace(/[\W_]+/g," ").split(' ').join('_');
                var videopath = VIDEO_PATH + newtitle + '.mp4';
                var path = MUSIC_PATH + newtitle + '.mp3';
                console.log("[" + ip + "] " + id + " " + title);
                if (fs.existsSync(path)) {
                    console.log("[" + ip + "] " + title + " already downloaded!");
                    var obj = { title: title, status: "finished", videopath: videopath.replace("/frontend",""), path: path.replace("/frontend","") }
                    connection.send(JSON.stringify(obj));
                } else {
                    var stream = ytdl(id, {
                        quality: 'highest'
                    });
                    stream.pipe(fs.createWriteStream(videopath));
                    stream.once('response', () => {
                      var obj = {
                        title: title,
                        status: "starting"
                      }
                      connection.send(JSON.stringify(obj));
                      console.log("[" + ip + "] Started downloading " + title + "!");
                    });
                    stream.on('progress', (chunkLength, downloaded, total) => {
                      const percent = downloaded / total;
                      var obj = {
                        title: title,
                        percent: (percent * 100).toFixed(0),
                        status: "downloading"
                      }
                      connection.send(JSON.stringify(obj));
                    });
                    stream.on('end', () => {
                      console.log("[" + ip + "] Finished downloading " + title + "!");
                      console.log("[" + ip + "] Started converting " + title + "!");
                      var obj = {
                        title: title,
                        status: "starting to convert",
                        percent: 0
                      }
                      connection.send(JSON.stringify(obj));
                      var command = ffmpeg(videopath).inputFormat('mp4').toFormat('mp3').save(path);
                      command.on('progress', function(progress) {
                        var obj = {
                          title: title,
                          status: "converting",
                          percent: progress.percent.toFixed(0)
                        }
                        connection.send(JSON.stringify(obj));
                      });
                      command.on('end', function(stdout, stderr) {
                        var obj = {
                          title: title,
                          status: "finished",
                          videopath: videopath.replace("/frontend",""),
                          path: path.replace("/frontend","")
                        }
                        connection.send(JSON.stringify(obj));
                        console.log("[" + ip + "] Finished converting " + title + "!");
                      });
                  });
                }
            });
          }
        }
    });

    connection.on('close', function(connection) {
        console.log("[" + ip + "] Disconnected!");
    });
});
