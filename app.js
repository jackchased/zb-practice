var ZShepherd = require('zigbee-shepherd'),
    ThingSpeakClient = require('thingspeakclient');

var client = new ThingSpeakClient();

client.attachChannel(339350, { writeKey:'7MD3GKU810YC6LJP', readKey:'1I5DCXIR02X5UGO4'});

var shepherd = new ZShepherd('/dev/ttyACM0', {
    net: {
        panId: 0x1234,
        channelList: [11]
    }
});

shepherd.on('ready', function () {
    console.log(shepherd.info());
    shepherd.permitJoin(0xff);
});

shepherd.on('permitJoining', function (time) {
    console.log(time);
});

shepherd.on('ind', function (msg) {
    switch(msg.type) {
        case 'devIncoming':
            devIncomingHdlr(msg);
        break;

        case 'devChange':
            devChangeHdlr(msg);
        break;
    }
});

shepherd.start(function (err) {
    if (err)
        console.log(err);
    else 
        console.log('shepherd is now running.');
});

var plug, tempSenser;

function devIncomingHdlr(msg) {
    console.log('Device: ' + msg.data + ' join the network!');

    msg.endpoints.forEach(function (ep) {
        if (ep.devId === 81) {
            plug = ep;

            plug.report('genOnOff', 'onOff', 3, 3, function (err) {
                if (err)
                    console.log(err);
            });
        }

        if (ep.devId === 770) {
            tempSenser = ep;

            tempSenser.report('msTemperatureMeasurement', 'measuredValue', 10, 10, 100, function (err) {
                if (!err)
                    console.log('Set Temp. report OK!');
            });

            setInterval(function () {
                var device = shepherd.list(tempSenser.getIeeeAddr()),
                    cInfo = tempSenser.dump().clusters,
                    tempVal = cInfo.msTemperatureMeasurement.attrs.measuredValue / 100;

                    if (!device || device[0].status !== 'online') return;

                    client.updateChannel(339350, { field1: tempVal });
            }, 16000);
        }
    });
}

function devChangeHdlr(msg) {
    var ep = msg.endpoints[0];

    if (ep.devId === 81 && msg.data.cid === 'genOnOff') {
        var status = msg.data.data.onOff ? 'On' : 'Off';
        console.log('Plug: ' + status);
    }

    if (ep.devId === 770 && msg.data.cid === 'msTemperatureMeasurement') {
        var tempVal = msg.data.data.measuredValue / 100;
        console.log('Temp: ' + tempVal + ' °C');

        tempChangedHdlr(tempVal);
    }
}

function tempChangedHdlr(tempVal) {
    if (!plug)
        return;

    if (tempVal > 28) {
        plug.functional('genOnOff', 'on', {}, function (err) {
            if (err) console.log(err);
        });
    } else {
        plug.functional('genOnOff', 'off', {}, function (err) {
            if (err) console.log(err);
        });
    }
}
