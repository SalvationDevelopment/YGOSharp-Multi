/*jslint  node: true, plusplus: true*/
'use strict';
var ygoserver, //port 8911 ygopro Server
    net = require('net'), //tcp connections
    router = require('./router'),
    enums = require('./translate_ygopro_enums'),
    translateYGOProAPI = require('./translate_ygopro_messages.js');

/**
 * Takes streamed broken up incoming data, stores it in a buffer, and as completed, returns complete messages.
 * @returns {DataStream} data stream with input method.
 */
function DataStream() {
    'use strict';
    var memory = new Buffer([]);

    /**
     * Take in new information, see if new messages can be generated.
     * @param {Buffer} buffer new information
     * @returns {Packet[]} new information in packet form
     */
    function input(buffer) {
        var incomplete = true,
            output = [],
            recordOfBuffer,
            frameLength;
        memory = Buffer.concat([memory, buffer]);
        while (incomplete === true && memory.length > 2) {
            frameLength = memory.readUInt16LE(0);
            if ((memory.length - 2) < frameLength) {
                incomplete = false;
            } else {
                recordOfBuffer = memory.slice(2).toJSON();
                output.push(recordOfBuffer);
                if (memory.length === (frameLength + 2)) {
                    memory = new Buffer([]);
                    incomplete = false;
                } else {
                    memory = memory.slice((frameLength + 2));
                }
            }
        }
        return output;
    }
    return {
        input
    };
}

/**
 * Disect a message header from YGOPro.
 * @param {Buffer} data YGOPro Protocol Message.
 * @returns {Message[]} Disected message in an array.
 */
function parsePackets(data) {
    'use strict';
    var message = new Buffer(data),
        task = [],
        packet = {
            message: message.slice(1),
            readposition: 0
        };
    packet.command = enums.STOC[message[0]];
    task.push(translateYGOProAPI(packet));
    return task;
}

function initiateSlave() {
    // When a user connects, create an instance and allow the to duel, clean up after.

    function handleTCP(socket) {
        var stream = new DataStream();
        socket.heartbeat = 0;
        socket.setNoDelay(true);
        socket.active_ygocore = false;
        socket.active = false;
        socket.on('data', function ygoproData(data) {

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