var sys = require("sys");
var url = require("url");
var fs = require("fs");

var bind = require("./libraries/bind-js");
var srv = require("./libraries/xavlib/simple-router");
var chn = require("./libraries/xavlib/channel");

function renderRoom(channelId, name, callback) {
    fs.readFile("./chatroom.html", function(err, data) {
        if(err) { throw err; };
        
        var channel = chn.channels[channelId] || chn.create(channelId);
        var context = { "room-name": channelId, "initial-info-id": channel.lastInfoId };
        context["user-name"] = name;
        context["chat-text"] = channel.data.map(function(o) { return o.message.content; });
        context["reply"] = { "send-line": function(def) { return (name ? def : ""); }, 
                             "enter-name": function(def) { return (name ? "" : def); } };
        
        bind.to(data, context, callback);
    });
}

var cookie = { parse: function(data) {
    var parsed = {};
    (data || "").replace(/(\S*)=(\S*)(;\s*|$)/g, function(_, key, val) { parsed[key] = val; return _; });
    return parsed;
} };

srv.urls["/client.js"] = srv.staticFileHandler("./libraries/xavlib/channel/client.js", "application/x-javascript");

srv.urls["/json2.js"] = srv.staticFileHandler("./libraries/json2.js", "application/x-javascript");

srv.urls["/"] = srv.urls["/index.html"] = srv.staticFileHandler("./index.html", "text/html");

(function() {
    var regChannel = new RegExp("^/([a-zA-Z0-9_-]+)$");
    srv.patterns.push({
        test: function(req) { return regChannel.test(url.parse(req.url).pathname); },
        handler: function(req, res) {
            var name = cookie.parse(req.headers["cookie"])["name"];
            var channelId = regChannel.exec(url.parse(req.url).pathname)[1];
            renderRoom(channelId, name, function(data) {
                res.sendHeader(200, { "Conent-Length": data.length,
                                      "Content-Type": "text/html",
                                      "Set-Cookie": "name=" + name  + "; path=/;" });
                res.end(data, "utf8");
            });
        }
    });
})()

srv.server.listen(8002);
chn.start(srv);