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
        context["chat-text"] = channel.data.map(function(o) { return { admin: o.message.content.admin || null,
                                                                       line: o.message.content.line || null }; });
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
            var cookies = cookie.parse(req.headers["cookie"]);
            var name = cookies["name"];
            var userId = cookies["user-id"];
            var channelId = regChannel.exec(url.parse(req.url).pathname)[1];
            renderRoom(channelId, name, function(data) {
                var cookies = { "Conent-Length": data.length,
                                "Content-Type": "text/html" }
            
                if(name) { names[userId] = name; cookies["Set-Cookie"] = "name=" + name  + "; path=/;"; }
            
                res.writeHead(200, cookies);
                res.end(data, "utf8");
            });
        }
    });
})();

var names = {};
chn.onCreate(function(id, channel) {
    channel.onReceive(function(msg) {
        if("name" in msg.content) {
            names[msg.userId] = msg.content["name"];
            channel.onUserChange.trigger({ userId: msg.userId, event: "join" });
            msg.content = null; return;
        }
    });
    
    channel.onUserChange(function(e) {
        if(!names[e.userId]) { return; }
        
        var msg = { admin: { text: names[e.userId] + (e.event === "join" ? " just joined" : " just left") } };
		channel.send(0, msg);
    });
});

setInterval(function RoomReaper() { // Closes rooms with no visitors after around 60 seconds
    for(var i in chn.channels) {
        var channel = chn.channels[i], userCount = channel.users().length;
        channel.idle = channel.idle || 0;
        
        if(userCount === 0) { channel.idle += 1; } else { channel.idle = 0; }
        
        if(channel.idle > 2) { channel.destroy(); }
    }
}, 30000);

srv.server.listen(8002);
chn.start(srv);