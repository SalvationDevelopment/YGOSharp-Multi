/*jslint  node: true, plusplus: true*/
'use strict';
var ygoserver, //port 8911 ygopro Server
    net = require('net'), //tcp connections
    router = require('./router'),
    DataStream = require('./parseframes.js'); //understand YGOPro API.

function initiateSlave() {
    // When a user connects, create an instance and allow the to duel, clean up after.
    var parsePackets = require('./parsepackets.js'),
        ws;

    function handleTCP(socket) {
        var stream = new DataStream();
        socket.heartbeat = 0;
        socket.setNoDelay(true);
        socket.active_ygocore = false;
        socket.active = false;
        socket.on('data', function listener(data) {

            var frame,
                task,
                newframes = 0;
            socket.heartbeat++;
            if (socket.active_ygocore) {
                socket.active_ygocore.write(data);
            }
            frame = stream.input(data);
            for (newframes; frame.length > newframes; newframes++) {
                task = parsePackets('CTOS', new Buffer(frame[newframes]));
                router(data, socket, task);
            }
            frame = [];

        });
        socket.on('error', function(error) {
            //console.log('::CLIENT', error);
            if (socket.active_ygocore) {
                try {
                    socket.active_ygocore.end();
                } catch (e) {
                    console.log('::CLIENT ERROR Before connect', e);
                }
            }
        });
    }
    ygoserver = net.createServer(handleTCP);
    ygoserver.listen(8911);
    return ygoserver;
}

initiateSlave();