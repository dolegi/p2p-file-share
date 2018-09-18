import * as crypto from 'crypto'
let key
const socket = new WebSocket('ws://localhost:3004')
socket.onopen = () => console.log('Socket is open')
socket.onclose = () => console.log('Socket closed')

const receiveBox = document.getElementById('receivebox');

let localConnection, remoteConnection, channel

if (window.location.pathname === '/') {
  handleClient1(socket)
} else {
  key = window.location.pathname.slice(1)
  handleClient2(socket)
}

function handleClient1(socket) {
  socket.onmessage = ({ data }) => {
    const msg = JSON.parse(data)

    console.log(msg)
    switch(msg.Type) {
      case 'key':
        return console.log(window.location + msg.Key)
      case 'answer':
        return localConnection.setRemoteDescription(JSON.parse(msg.Data))
      case 'ice':
        return localConnection.addIceCandidate(JSON.parse(msg.Data))
    }
  }
  localConnection = new RTCPeerConnection({iceServers: [
    {urls: ['stun:stun.services.mozilla.com:3478'] },
  ]});
  channel = localConnection.createDataChannel('channel');
  channel.onopen = handleChannelStatusChange;
  channel.onclose = handleChannelStatusChange;
  channel.onmessage = handleReceiveMessage;

  localConnection.onicecandidate = e => {
    if (!e.candidate) {
      return
    }
    socket.send(JSON.stringify({
      Type: 'ice',
      Data: JSON.stringify(e.candidate),
      Key: key
    }))
  }

  localConnection.createOffer()
    .then(offer => localConnection.setLocalDescription(offer))
    .then(() => {
      const sendOffer = () => socket.send(JSON.stringify({
        Type: 'setOffer',
        Data: JSON.stringify(localConnection.localDescription)
      }))

      socket.readyState === socket.OPEN ? sendOffer() : socket.onopen = sendOffer
    })
}

function handleClient2(socket) {
  socket.onopen = () => {
    socket.send(JSON.stringify({
      Type: 'getOffer',
      Key: key
    }))
  }

  socket.onmessage = ({ data }) => {
    const msg = JSON.parse(data)

    console.log(msg)
    switch (msg.Type) {
      case 'offer':
        remoteConnection.setRemoteDescription(JSON.parse(msg.Data))
        remoteConnection.createAnswer()
          .then(answer => remoteConnection.setLocalDescription(answer))
          .then(() => {
            socket.send(JSON.stringify({
              Type: 'setAnswer',
              Data: JSON.stringify(remoteConnection.localDescription),
              Key: key
            }))
          })
        return
      case 'ice':
        return remoteConnection.addIceCandidate(JSON.parse(msg.Data))
    }
  }

  remoteConnection = new RTCPeerConnection({iceServers: [
    {urls: ['stun:stun.services.mozilla.com:3478' ]},
  ]});
  remoteConnection.ondatachannel = channelCallback;

  remoteConnection.onicecandidate = e => {
    if (!e.candidate) {
      return
    }
    socket.send(JSON.stringify({
      Type: 'ice',
      Data: JSON.stringify(e.candidate),
      Key: key
    }))
  }
}

function sendFile(file) {
  // const fileStr = abToStr(file)
  // const hash = crypto.createHmac('sha256', fileStr).digest('hex')
  // channel.send(JSON.stringify({ type: 'meta', hash }))
  // channel.send(JSON.stringify({ type: 'chunk', chunk: fileStr }))

  const fileLength = file.byteLength
  for (let i = 0; i < fileLength; i += 1024) {
    let chunkView
    if (fileLength < i + 1024) {
      chunkView = new DataView(file, i, i + (fileLength % 1024))
    } else {
      chunkView = new DataView(file, i, i + 1024)
    }
    sendChunk(chunkView)
  }
}

function sendChunk(chunkView) {
  const chunk = abToStr(chunkView.buffer)
  const hash = crypto.createHmac('sha256', chunk).digest('hex')
  channel.send(JSON.stringify({ type: 'hash', data: hash }))
  channel.send(JSON.stringify({ type: 'chunk', data: chunk }))
}

function channelCallback(event) {
  channel = event.channel;
  channel.onmessage = handleReceiveMessage;
  channel.onopen = handleChannelStatusChange;
  channel.onclose = handleChannelStatusChange;
}

function handleReceiveMessage(event) {
  const { type, data } = JSON.parse(event.data)

  console.log(type)
  console.log(data)

  // if (type === 'meta') {
  //   console.log(data.data)
  // } else {
  //   download(data.chunk, 'test.txt', 'txt')
  // }

  // const el = document.createElement('p');
  // const txtNode = document.createTextNode(event.data);

  // el.appendChild(txtNode);
  // receiveBox.appendChild(el);
}

function handleChannelStatusChange(event) {
  console.log('WebRTC channel status has changed to ' + channel.readyState);
}

function download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}

document.querySelector('.file-reader').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (file) {
    const arrayReader = new FileReader();
    arrayReader.readAsArrayBuffer(file);
    arrayReader.onload = function(event) {
      sendFile(event.target.result)
    }
  }
});

function abToStr(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}
